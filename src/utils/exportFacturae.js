// Generador de Facturae XML 3.2.2 — formato electronico oficial de
// facturacion de la AEAT, aceptado como estandar de intercambio por la
// mayoria de plataformas certificadas (BeeL, FacturaDirecta, Quipu, Holded
// import, etc.).
//
// IMPORTANTE: NO firmamos. La firma electronica avanzada (XAdES) la añade
// la plataforma destino al importar. Generamos solo el XML estructurado.
//
// Spec: https://www.facturae.gob.es
// Schema: http://www.facturae.gob.es/formato/Versiones/Facturaev3_2_2.xml

// ---- helpers ----

function xmlEscape(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function _round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Detecta si un NIF/CIF es persona fisica (F) o juridica (J).
// CIF empresas: empieza por A,B,C,D,E,F,G,H,J,N,P,Q,R,S,U,V,W + 7 digitos
// + dig. control. DNI/NIE: 8 digitos + letra (DNI) o X/Y/Z + 7 digitos +
// letra (NIE). Default a F si no se reconoce.
function personType(nif) {
  if (!nif) return 'F';
  const clean = String(nif).replace(/[\s-]/g, '').toUpperCase();
  if (/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[A-J0-9]$/.test(clean)) return 'J';
  return 'F';
}

// Parte un nombre completo en Name + FirstSurname + SecondSurname segun
// convencion espanyola (1er nombre, resto = apellidos). Heuristica simple:
//   1 word  -> Name
//   2 words -> Name + FirstSurname
//   3 words -> Name + FirstSurname + SecondSurname
//   4+      -> Name + FirstSurname + (resto unidos como SecondSurname)
function splitNombre(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { name: '', first: '', second: '' };
  if (parts.length === 1) return { name: parts[0], first: '', second: '' };
  if (parts.length === 2) return { name: parts[0], first: parts[1], second: '' };
  if (parts.length === 3) {
    return { name: parts[0], first: parts[1], second: parts[2] };
  }
  return {
    name: parts[0],
    first: parts[1],
    second: parts.slice(2).join(' '),
  };
}

// Formatos numericos exigidos por el schema:
function fmtAmount(n) {
  return _round2(n).toFixed(2);
}
function fmtRate(n) {
  return (Number(n) || 0).toFixed(2);
}
function fmtQty(n) {
  return (Number(n) || 0).toFixed(8);
}

// Address en Espanya: si falta CP/Ciudad/Provincia (campos opcionales en
// nuestro modelo), generamos un bloque vacio o con placeholders. Algunas
// plataformas exigen los 3, otras se contentan con uno; advertimos en la UI.
function addressInSpainXml(direccion, cp, ciudad, provincia) {
  return `        <AddressInSpain>
          <Address>${xmlEscape(direccion || '')}</Address>
          <PostCode>${xmlEscape(cp || '')}</PostCode>
          <Town>${xmlEscape(ciudad || '')}</Town>
          <Province>${xmlEscape(provincia || '')}</Province>
          <CountryCode>ESP</CountryCode>
        </AddressInSpain>`;
}

function partyXml({ tag, nif, nombre, direccion, cp, ciudad, provincia }) {
  const ptype = personType(nif);
  const id = (nif || '').replace(/[\s-]/g, '').toUpperCase();
  let body;
  if (ptype === 'J') {
    body = `      <LegalEntity>
        <CorporateName>${xmlEscape(nombre || '')}</CorporateName>
${addressInSpainXml(direccion, cp, ciudad, provincia)}
      </LegalEntity>`;
  } else {
    const { name, first, second } = splitNombre(nombre);
    // SecondSurname es opcional; lo incluimos solo si existe para no meter
    // tags vacios que el validador rechaza en algunos perfiles.
    const secondTag = second
      ? `        <SecondSurname>${xmlEscape(second)}</SecondSurname>\n`
      : '';
    body = `      <Individual>
        <Name>${xmlEscape(name)}</Name>
        <FirstSurname>${xmlEscape(first)}</FirstSurname>
${secondTag}${addressInSpainXml(direccion, cp, ciudad, provincia)}
      </Individual>`;
  }
  return `    <${tag}>
      <TaxIdentification>
        <PersonTypeCode>${ptype}</PersonTypeCode>
        <ResidenceTypeCode>R</ResidenceTypeCode>
        <TaxIdentificationNumber>${xmlEscape(id)}</TaxIdentificationNumber>
      </TaxIdentification>
${body}
    </${tag}>`;
}

// ---- builder principal ----

export function buildFacturaeXML({ factura, lineas, cliente, settings }) {
  const f = factura || {};
  const c = cliente || {};
  const s = settings || {};
  const ls = Array.isArray(lineas) && lineas.length > 0 ? lineas : [];

  // Calculos: el campo factura.iva_porcentaje gobierna el tipo IVA del
  // documento (un solo tipo por factura — limitacion conocida del modelo
  // actual; para casos multi-IVA habria que extender el editor).
  const ivaPct = Number(f.iva_porcentaje) || 0;
  const baseTotal = ls.reduce((sum, l) => sum + (Number(l.importe) || 0), 0);
  const ivaTotal = (baseTotal * ivaPct) / 100;
  const total = baseTotal + ivaTotal;

  const fecha = (f.fecha || '').slice(0, 10); // YYYY-MM-DD

  // SellerParty (emisor — autonomo)
  const seller = partyXml({
    tag: 'SellerParty',
    nif: s.emisor_nif,
    nombre: s.emisor_nombre,
    direccion: s.emisor_direccion,
    cp: s.emisor_cp,
    ciudad: s.emisor_ciudad,
    provincia: s.emisor_provincia,
  });

  // BuyerParty (cliente)
  const buyer = partyXml({
    tag: 'BuyerParty',
    nif: c.nif,
    nombre: c.nombre,
    direccion: c.direccion,
    cp: c.cp,
    ciudad: c.ciudad,
    provincia: c.provincia,
  });

  // Items (lineas)
  const itemsXml = ls
    .map((l) => {
      const titulo = (l.titulo || '').trim();
      const desc = (l.descripcion || '').trim();
      const concepto = titulo || desc.slice(0, 80) || 'Concepto';
      const cantidad = Number(l.cantidad) > 0 ? Number(l.cantidad) : 1;
      const importe = _round2(l.importe);
      const precioUnit =
        l.precio_unitario != null
          ? _round2(l.precio_unitario)
          : cantidad > 0
            ? _round2(importe / cantidad)
            : 0;
      const cuotaLinea = _round2((importe * ivaPct) / 100);
      return `      <InvoiceLine>
        <ItemDescription>${xmlEscape(concepto)}</ItemDescription>
        <Quantity>${fmtQty(cantidad)}</Quantity>
        <UnitPriceWithoutTax>${fmtAmount(precioUnit)}</UnitPriceWithoutTax>
        <TotalCost>${fmtAmount(importe)}</TotalCost>
        <GrossAmount>${fmtAmount(importe)}</GrossAmount>
        <TaxesOutputs>
          <Tax>
            <TaxTypeCode>01</TaxTypeCode>
            <TaxRate>${fmtRate(ivaPct)}</TaxRate>
            <TaxableBase>
              <TotalAmount>${fmtAmount(importe)}</TotalAmount>
            </TaxableBase>
            <TaxAmount>
              <TotalAmount>${fmtAmount(cuotaLinea)}</TotalAmount>
            </TaxAmount>
          </Tax>
        </TaxesOutputs>
      </InvoiceLine>`;
    })
    .join('\n');

  // TaxesOutputs a nivel factura (suma agregada por tipo IVA — aqui solo
  // tenemos uno).
  const taxesOutputsXml = `      <TaxesOutputs>
        <Tax>
          <TaxTypeCode>01</TaxTypeCode>
          <TaxRate>${fmtRate(ivaPct)}</TaxRate>
          <TaxableBase>
            <TotalAmount>${fmtAmount(baseTotal)}</TotalAmount>
          </TaxableBase>
          <TaxAmount>
            <TotalAmount>${fmtAmount(ivaTotal)}</TotalAmount>
          </TaxAmount>
        </Tax>
      </TaxesOutputs>`;

  const numeroFactura = xmlEscape(f.numero || '');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fe:Facturae xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:fe="http://www.facturae.gob.es/formato/Versiones/Facturaev3_2_2.xml">
  <FileHeader>
    <SchemaVersion>3.2.2</SchemaVersion>
    <Modality>I</Modality>
    <InvoiceIssuerType>EM</InvoiceIssuerType>
    <Batch>
      <BatchIdentifier>${numeroFactura}</BatchIdentifier>
      <InvoicesCount>1</InvoicesCount>
      <TotalInvoicesAmount>
        <TotalAmount>${fmtAmount(total)}</TotalAmount>
      </TotalInvoicesAmount>
      <TotalOutstandingAmount>
        <TotalAmount>${fmtAmount(total)}</TotalAmount>
      </TotalOutstandingAmount>
      <TotalExecutableAmount>
        <TotalAmount>${fmtAmount(total)}</TotalAmount>
      </TotalExecutableAmount>
      <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
    </Batch>
  </FileHeader>
  <Parties>
${seller}
${buyer}
  </Parties>
  <Invoices>
    <Invoice>
      <InvoiceHeader>
        <InvoiceNumber>${numeroFactura}</InvoiceNumber>
        <InvoiceDocumentType>FC</InvoiceDocumentType>
        <InvoiceClass>OO</InvoiceClass>
      </InvoiceHeader>
      <InvoiceIssueData>
        <IssueDate>${xmlEscape(fecha)}</IssueDate>
        <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
        <TaxCurrencyCode>EUR</TaxCurrencyCode>
        <LanguageName>es</LanguageName>
      </InvoiceIssueData>
${taxesOutputsXml}
      <InvoiceTotals>
        <TotalGrossAmount>${fmtAmount(baseTotal)}</TotalGrossAmount>
        <TotalGrossAmountBeforeTaxes>${fmtAmount(baseTotal)}</TotalGrossAmountBeforeTaxes>
        <TotalTaxOutputs>${fmtAmount(ivaTotal)}</TotalTaxOutputs>
        <TotalTaxesWithheld>0.00</TotalTaxesWithheld>
        <InvoiceTotal>${fmtAmount(total)}</InvoiceTotal>
        <TotalOutstandingAmount>${fmtAmount(total)}</TotalOutstandingAmount>
        <TotalExecutableAmount>${fmtAmount(total)}</TotalExecutableAmount>
      </InvoiceTotals>
      <Items>
${itemsXml}
      </Items>
    </Invoice>
  </Invoices>
</fe:Facturae>
`;

  return xml;
}

// Validacion ligera de PRE-condiciones — comprueba que los campos clave
// estan presentes para que el XML salga util. Devuelve array de avisos.
export function checkFacturaePrereq({ factura, lineas, cliente, settings }) {
  const avisos = [];
  if (!cliente) avisos.push('La factura no tiene cliente asignado.');
  if (!Array.isArray(lineas) || lineas.length === 0) {
    avisos.push('La factura no tiene líneas.');
  }
  if (!settings?.emisor_nif) avisos.push('Falta NIF del emisor en Ajustes.');
  if (!settings?.emisor_nombre)
    avisos.push('Falta nombre del emisor en Ajustes.');
  if (!settings?.emisor_cp || !settings?.emisor_ciudad) {
    avisos.push(
      'Faltan CP/Ciudad del emisor en Ajustes (Facturae los pide separados).',
    );
  }
  if (cliente && !cliente.nif) avisos.push('El cliente no tiene NIF.');
  if (cliente && (!cliente.cp || !cliente.ciudad)) {
    avisos.push('El cliente no tiene CP/Ciudad rellenados.');
  }
  return avisos;
}

export function facturaeFilename(factura) {
  const numero = factura?.numero || 'sin-numero';
  // .xsig es para Facturae FIRMADO (XAdES). Como aqui no firmamos, usamos
  // .xml estandar — extension que aceptan todas las plataformas certificadas
  // al importar (BeeL, FacturaDirecta, etc.).
  const safe = numero.replace(/[\\/:*?"<>|]/g, '-');
  return `Facturae_${safe}.xml`;
}
