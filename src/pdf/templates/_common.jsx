// Helpers compartidos entre plantillas.
// Cada plantilla controla su propia decoracion + posiciones absolutas, pero
// todas comparten la misma logica para calcular totales, formatear lineas
// y pintar bloques recurrentes (emisor, cliente, totales).

import { View, Text, Image } from '@react-pdf/renderer';
import {
  formatEUR, formatFechaES, calcTotales, round2, descuentoImporte,
} from '../../utils/format.js';

// Separacion vertical entre lineas del cuerpo (gap entre rows). Antes 12pt
// en todas las plantillas; subido a 16/14 para que respire mas. Las plantillas
// que envuelven cada linea en un wrapper externo lo aplican via marginBottom;
// las que aplican styles.lineRow directamente lo meten en su StyleSheet.
export const LINE_GAP_PRES = 16;
export const LINE_GAP_FAC = 14;

// v1.2.36: layout de tabla en facturas. Columnas fijas para UNID/PRECIO/DTO/
// IMPORTE; DESCRIPCION ocupa el resto via flex:1. Pedido madre para que la
// factura tenga una columna por dato en vez del subline gris.
// Tamaños calibrados para que en A4 portrait queden 4 cells (216pt) a la
// derecha + DESCRIPCION ocupando ~360-370pt. En paisaje sobra espacio para
// que DESC respire.
export const FACT_COL = {
  unid:   36,
  precio: 60,
  dto:    44,
  imp:    76,
};

// Paginacion manual: en lugar de dejar que @react-pdf calcule el salto por
// altura (que produce paginas con espaciado irregular y a veces lineas
// recortadas), contamos un "peso" por linea y forzamos salto cuando el
// acumulado de la pagina supera el limite. Asi cada pagina tiene siempre
// el mismo aspecto visual independientemente del contenido.
//
// Peso de una linea = 1 (titulo) + 1 si tiene descripcion + N por cada
// subitem (si modo_detallado y no se ocultan). Una linea sin nada extra
// pesa 1; una con descripcion + 3 subitems pesa 5.
const PAGE_WEIGHT_LIMIT = 28;

// Footer "Página X de Y". `fixed` para que aparezca en todas las paginas.
// Si solo hay 1 pagina, no pinta nada (no aporta info y queda mejor limpio).
// Cada plantilla pasa su propio `style` con la posicion (bottom/right) que
// encaja con su pie.
export function PageNumberFooter({ style }) {
  return (
    <Text
      style={style}
      fixed
      render={({ pageNumber, totalPages }) =>
        totalPages > 1 ? `Página ${pageNumber} de ${totalPages}` : ''
      }
    />
  );
}

export function computeLineBreaks(lineas, modoDetallado, ocultarSubitemsFactura) {
  const breaks = new Set();
  let pageWeight = 0;
  const ls = Array.isArray(lineas) ? lineas : [];
  for (let i = 0; i < ls.length; i += 1) {
    const l = ls[i];
    // v1.2.29: descripcion ahora se imprime completa (antes truncada). Su
    // peso debe estimarse por numero de lineas reales (newline + wrap aprox
    // cada 80 chars) para que el salto de pagina lo respete.
    const descRaw = (l.descripcion || '').trim();
    let descCount = 0;
    if (descRaw) {
      const explicitLines = descRaw.split(/\r?\n/).length;
      const wrappedLines = Math.ceil(descRaw.length / 80);
      descCount = Math.max(explicitLines, wrappedLines);
    }
    const subs = Array.isArray(l.sublineas) ? l.sublineas : [];
    const showSubs = !!modoDetallado && subs.length > 0 && !ocultarSubitemsFactura;
    const subsCount = showSubs ? subs.length : 0;
    const weight = 1 + descCount + subsCount;
    if (i > 0 && pageWeight + weight > PAGE_WEIGHT_LIMIT) {
      breaks.add(i);
      pageWeight = weight;
    } else {
      pageWeight += weight;
    }
  }
  return breaks;
}

export function deriveDocData({ tipo, doc, lineas, cliente, settings }) {
  const d = doc || {};
  const s = settings || {};
  const ls = lineas || [];
  const ivaPct = Number(d.iva_porcentaje) || 0;
  const irpfPct = Number(d.irpf_pct) || 0;
  // Operacion intracomunitaria (solo facturas): si el cliente esta marcado
  // como intracomunitario — o la factura ya se emitio asi (snapshot
  // `d.intracomunitario`) — la entrega va SIN IVA con inversion del sujeto
  // pasivo (el comprador autoliquida el IVA en su pais). Es el estandar de
  // un preparador; VIES es solo informativo (ver constraints legales).
  const reverseCharge = tipo === 'factura'
    && !!((cliente && cliente.intracomunitario) || d.intracomunitario);
  // Si `iva_incluido === 0` (o es intracomunitaria) el documento se emite sin
  // IVA: el PDF no muestra la fila de IVA y debajo del total aparece la nota.
  const incluyeIva = d.iva_incluido !== 0 && !reverseCharge;
  // Recargo de equivalencia: activo si el cliente esta en ese regimen. No
  // aplica nunca a operaciones intracomunitarias (exentas).
  const reActivo = !reverseCharge && !!(cliente && cliente.recargo_equivalencia);
  const {
    base, iva, total, irpf, ivaBreakdown, recargoEq,
    subtotalBruto, descuentoLineas, descuentoGlobal,
  } = calcTotales(
    ls, ivaPct, irpfPct, {
      incluyeIva,
      recargoEquivalencia: reActivo,
      descuentoGlobalTipo: d.descuento_tipo,
      descuentoGlobalValor: d.descuento_valor,
    },
  );
  const descuentoTotal = round2((descuentoLineas || 0) + (descuentoGlobal || 0));
  // Nota legal al pie de los totales cuando es operacion intracomunitaria.
  const notaFiscal = reverseCharge
    ? 'Operación intracomunitaria exenta de IVA. Inversión del sujeto pasivo '
      + '(art. 196 Directiva 2006/112/CE; art. 84.Uno.2.º Ley 37/1992 del IVA).'
    : null;
  // Marca del documento: su nombre comercial y logo van a la cabecera; el
  // nombre fiscal sigue constando (en EmisorBlock, mas pequeno) por ley.
  const marca = d.marca || null;
  const marcaNombre = marca?.nombre_comercial || null;
  // v1.2.31: documento_interno se calcula mas abajo, pero lo necesitamos en
  // sOut. Lo precalculamos aqui.
  const _docInternoFlag = tipo === 'factura' && !!d.documento_interno;
  const sOut = marca
    ? { ...s, _marcaNombre: marcaNombre, _docInterno: _docInternoFlag }
    : { ...s, _docInterno: _docInternoFlag };
  const brandColor = marca?.brand_color || s.brand_color || '#1abc9c';
  const logoUrl = (marca && marca.logo_data_url) || s.logo_data_url || null;
  const firmaUrl = s.firma_data_url || null;
  // QR EPC SEPA: data URL pre-calculada en el editor (asincrono, no se puede
  // hacer dentro del render del PDF). Solo aplica a facturas.
  const qrDataUrl = tipo === 'factura' ? (s.qr_data_url || null) : null;
  // v1.2.25: formato pedido madre — direccion entera en una linea, CP+ciudad
  // en otra, pais en una tercera. Mantengo dirLine1/dirLine2 con la logica
  // antigua para compatibilidad con plantillas que aun los usan, pero ahora
  // EmisorBlock prefiere emisorLines (array) si esta presente.
  const dirParts = (s.emisor_direccion || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const dirLine1 = dirParts
    .slice(0, dirParts.length > 1 ? -1 : undefined)
    .join(', ');
  const dirLine2 = dirParts.length > 1 ? dirParts[dirParts.length - 1] : '';
  // Lineas del emisor en el orden pedido:
  //   1. Direccion (sin partir por comas)
  //   2. CP + Ciudad
  //   3. Pais (solo si esta rellenado en ajustes)
  // El nombre fiscal y el NIF van antes, los renderiza EmisorBlock.
  const cpCiudadEmisor = [s.emisor_cp, s.emisor_ciudad].filter(Boolean).join(' ');
  const emisorLines = [
    (s.emisor_direccion || '').trim(),
    cpCiudadEmisor,
    (s.emisor_pais || '').trim(),
  ].filter(Boolean);
  // Vencimiento: si esta rellenado, lo mostramos en cabecera y bajo totales.
  const fechaVencimientoTxt = d.fecha_vencimiento
    ? formatFechaES(d.fecha_vencimiento)
    : '';
  // Toggle "marcar_borrador" controla si el PDF de factura sale con prefijo
  // "BORRADOR DE FACTURA" (true, modo Verifactu post-2027) o solo "FACTURA"
  // (false, modo "uso interno" o pre-2027). Default false. NO aplica a
  // proforma ni nota_contado (que ya son documentos no fiscales por
  // naturaleza).
  // Subtipo de factura: factura | proforma | nota_contado | rectificativa.
  // v1.2.27: fallback — si el subtipo es null/vacio/'factura' pero el numero
  // empieza por NC-/PRO-/RECT-, deducimos. Asi las facturas viejas con bug
  // historico (subtipo='factura' aunque sea NC-) se renderizan correctamente.
  const numeroStr = String(d.numero || '');
  let subtipo = d.subtipo || 'factura';
  if (subtipo === 'factura') {
    if (numeroStr.startsWith('NC-')) subtipo = 'nota_contado';
    else if (numeroStr.startsWith('PRO-')) subtipo = 'proforma';
    else if (numeroStr.startsWith('RECT-')) subtipo = 'rectificativa';
  }
  // El watermark "BORRADOR" y el pie obligatorio solo aplican a facturas
  // normales (NO a proforma ni nota_contado, que ya son no-fiscales).
  const marcarBorrador = !!s.marcar_borrador && subtipo === 'factura';
  // v1.2.31: documento_interno por factura. Cuando esta a 1, el PDF sale
  // como "RESUMEN DE TRABAJOS" SIN numero y SIN datos del emisor (lo
  // veremos al render emisor en cada plantilla). La BD sigue guardando
  // numero/datos/etc. normalmente; solo cambia el render.
  const docInterno = tipo === 'factura' && !!d.documento_interno;
  let tituloDoc;
  if (docInterno) {
    tituloDoc = 'RESUMEN DE TRABAJOS';
  } else if (tipo === 'presupuesto') {
    tituloDoc = 'PRESUPUESTO';
  } else if (subtipo === 'proforma') {
    tituloDoc = 'FACTURA PROFORMA';
  } else if (subtipo === 'nota_contado') {
    // v1.2.25: pedido madre — venta al contado se titula "CONTADO" (mas corto
    // y claro) y el numero NC- no aparece en el PDF (cabeceraNumero='' abajo).
    tituloDoc = 'CONTADO';
  } else if (subtipo === 'rectificativa') {
    tituloDoc = 'FACTURA RECTIFICATIVA';
  } else {
    tituloDoc = marcarBorrador ? 'BORRADOR DE FACTURA' : 'FACTURA';
  }
  // Numero a la derecha/junto al titulo: siempre corto "Nº YYYY/NN" porque
  // el titulo grande ya dice "FACTURA" o "PRESUPUESTO" — repetirlo es ruido.
  // EXCEPCION pedida por la madre v1.2.23: en NOTA DE CONTADO no imprimimos el
  // numero (sigue saliendo en listados de la app). Son "vales" sin numero.
  // v1.2.31: en documento interno tampoco se imprime numero.
  const cabeceraNumero = (subtipo === 'nota_contado' || docInterno)
    ? ''
    : `Nº ${d.numero ?? ''}`.trim();
  // v1.2.32: titulos largos como "RESUMEN DE TRABAJOS" (19 chars), "FACTURA
  // RECTIFICATIVA" (21) o "BORRADOR DE FACTURA" (19) se cortaban en 2 lineas
  // en plantillas con fontSize grande. Marcamos como largo todo titulo > 15
  // chars para que las plantillas reduzcan su fontSize en el render.
  const tituloLargo = (tituloDoc || '').length > 15;
  // v1.2.32: label DESCUENTO con el % aplicado cuando el descuento global
  // del documento es porcentual. Si es en EUR fijos o si solo hay descuentos
  // por linea, queda como "DESCUENTO" a secas (el % seria ambiguo).
  let descuentoLabel = 'DESCUENTO';
  const dtoGlobalTipo = d.descuento_tipo === 'eur' ? 'eur' : 'pct';
  const dtoGlobalValor = Number(d.descuento_valor) || 0;
  if (dtoGlobalTipo === 'pct' && dtoGlobalValor > 0) {
    descuentoLabel = `DESCUENTO ${dtoGlobalValor}%`;
  }
  const tableHeaderLeft = tipo === 'factura' ? 'CONCEPTO' : 'DESCRIPCION';
  const fechaTxt = `${(d.ciudad_emision || '').toUpperCase()}${
    d.ciudad_emision ? ', ' : ''
  }${formatFechaES(d.fecha)}`;
  const cpCiudad = cliente
    ? [cliente.cp, cliente.ciudad].filter(Boolean).join(' ')
    : '';
  // Hitos de pago: solo aplica a presupuestos. La factura no tiene hitos
  // (sus hitos son N facturas independientes, no un calendario).
  const hitos = tipo === 'presupuesto' && Array.isArray(d.hitos) ? d.hitos : [];
  // v1.2.36: cobros marcados para mostrar como "pago a cuenta" en el PDF.
  // Solo aplica a facturas (en proformas no tiene sentido). Se pasa la lista
  // filtrada para que TotalsBlock no tenga que filtrar de nuevo.
  const cobrosPdf = (tipo === 'factura' && Array.isArray(d.cobros))
    ? d.cobros.filter((c) => !!c.mostrar_en_pdf)
    : [];
  return {
    tipo,
    d, s: sOut, ls,
    ivaPct, base, iva, total, irpf, irpfPct, ivaBreakdown,
    recargoEq,
    subtotalBruto, descuentoLineas, descuentoGlobal, descuentoTotal,
    brandColor, logoUrl, firmaUrl, qrDataUrl,
    dirLine1, dirLine2, emisorLines,
    tituloDoc, tituloLargo, cabeceraNumero, tableHeaderLeft,
    descuentoLabel,
    fechaTxt, cpCiudad, fechaVencimientoTxt,
    notasPublicas: (d.notas_publicas || '').trim() || null,
    marcarBorrador,
    subtipo,
    incluyeIva,
    notaFiscal,
    hitos,
    cobrosPdf,
  };
}

// Render emisor block. `styles` debe tener: emisorNombre, emisorLine.
// Si se pasa firmaUrl, se renderiza una pequeña imagen de la firma escaneada
// debajo de las lineas de texto (ancho fijo 110pt, alto auto).
// Si `settings.ocultar_emisor` esta activo, el NOMBRE del emisor no se
// muestra (el resto — NIF, direccion, firma — siguen visibles). Pensado
// para uso interno cuando el usuario no quiere firmar el documento.
export function EmisorBlock({ s, dirLine1, dirLine2, emisorLines, styles, firmaUrl }) {
  // v1.2.31: documento_interno por factura — oculta NOMBRE + NIF + direccion
  // + IBAN + SWIFT + firma. Pensado para "Resumen de trabajos" sin identidad
  // fiscal del emisor. Distinto de `ocultar_emisor` (settings global), que
  // solo oculta el nombre.
  if (s._docInterno) {
    return null;
  }
  const ocultarNombre = !!s.ocultar_emisor;
  const marcaNombre = s._marcaNombre || null;
  // v1.2.25: el formato pedido es: direccion / CP+ciudad / pais. Si la
  // plantilla nos pasa emisorLines, lo usamos; si no, lo construimos aqui
  // mismo desde `s` para no tener que editar las 9 plantillas a la vez.
  const lineasDerivadas = (() => {
    const dir = (s.emisor_direccion || '').trim();
    const cpCiu = [s.emisor_cp, s.emisor_ciudad].filter(Boolean).join(' ');
    const pais = (s.emisor_pais || '').trim();
    return [dir, cpCiu, pais].filter(Boolean);
  })();
  const lineasDireccion = Array.isArray(emisorLines) && emisorLines.length > 0
    ? emisorLines
    : (lineasDerivadas.length > 0
        ? lineasDerivadas
        : [dirLine1, dirLine2].filter(Boolean));
  // Prefijo "VAT" en el NIF: el cliente internacional lo espera; un cliente
  // nacional no tiene problema con verlo asi. Si el NIF ya lo trae (raro),
  // no lo duplicamos.
  const nifTxt = s.emisor_nif
    ? (/^vat\s+/i.test(s.emisor_nif) ? s.emisor_nif : `VAT ${s.emisor_nif}`)
    : null;
  return (
    <>
      {marcaNombre ? (
        <Text style={styles.emisorNombre}>{marcaNombre}</Text>
      ) : (!ocultarNombre && s.emisor_nombre ? (
        <Text style={styles.emisorNombre}>{s.emisor_nombre}</Text>
      ) : null)}
      {/* v1.2.38: nombre fiscal (obligatorio en factura) ahora con el mismo
          tamaño y peso que el nombre comercial. Pedido madre: "El texto del
          apartado facturado (Equine America) igual de grande que Eleonora
          Thijssen" — antes el fiscal salia en gris pequeño (fontSize 8) como
          subtitulo del comercial. */}
      {marcaNombre && !ocultarNombre && s.emisor_nombre ? (
        <Text style={styles.emisorNombre}>
          {s.emisor_nombre}
        </Text>
      ) : null}
      {nifTxt ? (
        <Text style={styles.emisorLine}>{nifTxt}</Text>
      ) : null}
      {lineasDireccion.map((ln, i) => (
        <Text key={`emi-${i}`} style={styles.emisorLine}>{ln}</Text>
      ))}
      {/* v1.2.26: IBAN + SWIFT/BIC debajo de la direccion. Solo si rellenados.
          Pedido madre para facturas internacionales. */}
      {s.emisor_iban ? (
        <Text style={[styles.emisorLine, { marginTop: 3 }]}>
          {`IBAN: ${s.emisor_iban}`}
        </Text>
      ) : null}
      {s.emisor_swift ? (
        <Text style={styles.emisorLine}>
          {`SWIFT/BIC: ${s.emisor_swift}`}
        </Text>
      ) : null}
      {firmaUrl ? (
        <Image
          src={firmaUrl}
          style={{ width: 110, marginTop: 6, objectFit: 'contain' }}
        />
      ) : null}
    </>
  );
}

// Bloque "Calendario de pagos" para presupuestos con hitos. Se renderiza
// despues de las lineas en el cuerpo. Compacto: titulo + tabla 3 columnas
// (descripcion, %, importe). Si no hay hitos, devuelve null.
export function CalendarioPagosBlock({ hitos, base, brandColor }) {
  if (!Array.isArray(hitos) || hitos.length === 0) return null;
  const baseNum = Number(base) || 0;
  return (
    <View style={{ marginTop: 18 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          borderBottomWidth: 0.7,
          borderBottomColor: brandColor || '#888',
          paddingBottom: 4,
          marginBottom: 6,
        }}
      >
        <Text style={{
          fontSize: 9, fontFamily: 'Helvetica-Bold',
          letterSpacing: 1.2, color: '#3a3a3a',
        }}>
          CALENDARIO DE PAGOS
        </Text>
        <Text style={{
          fontSize: 8, color: '#7a7a7a',
        }}>
          {hitos.length} {hitos.length === 1 ? 'hito' : 'hitos'}
        </Text>
      </View>
      {hitos.map((h, i) => {
        const pct = Number(h.importe_pct) || 0;
        const importe = Math.round(baseNum * pct) / 100;
        const offset = Number(h.fecha_offset_dias) || 0;
        const offsetTxt = offset === 0
          ? 'a la aceptación'
          : offset === 1 ? '+1 día'
          : `+${offset} días`;
        return (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 3,
            }}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontSize: 9.5, color: '#2a2a2a' }}>
                {`${i + 1}. ${h.descripcion || `Hito ${i + 1}`}`}
              </Text>
              <Text style={{ fontSize: 8, color: '#888', marginTop: 1 }}>
                {offsetTxt}
              </Text>
            </View>
            <Text style={{ width: 40, fontSize: 9.5, textAlign: 'right', color: '#5a5a5a' }}>
              {`${pct}%`}
            </Text>
            <Text style={{ width: 70, fontSize: 9.5, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: '#1a1a1a' }}>
              {formatEUR(importe)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// v1.2.39: QR SEPA retirado. La madre reporto que no funcionaba al
// escanearlo desde apps bancarias (formato EPC no soportado por todos
// los bancos espanoles + iban con espacios/caracteres extranos rompian
// el parser). Mantenemos la firma del componente y la generacion del
// data URL en el editor para no romper imports/build.
//
// v1.2.42: fix real de los totales a la derecha. El intento de v1.2.41
// (View width 80) no funciono con justify-content:'space-between' cuando
// el bloque totales tiene ancho mayor que el resto de espacio disponible:
// el flexbox de @react-pdf a veces colapsa el space-between si un hijo
// es mucho mayor que el otro. Solucion: spacer con flexGrow:1 que absorbe
// TODO el espacio libre y empuja el totalsBox al borde derecho pase lo
// que pase con justify-content de los distintos templates.
//
// Historia:
// - v1.2.39 quito el QR (madre reporto que no funcionaba en apps de banco).
// - v1.2.41 devolvia View width 80 → totales seguian en el centro/izquierda.
// - v1.2.42 flexGrow:1 → totales siempre a la derecha.
export function SepaQrBlock(_props) {
  return <View style={{ flexGrow: 1 }} />;
  // eslint-disable-next-line no-unreachable
  return (
    <View style={{ alignItems: 'center', marginTop: 6 }}>
      <Image src={null} style={{ width: 72, height: 72 }} />
      <Text style={{ fontSize: 7, color: '#555', marginTop: 2, textAlign: 'center' }}>
        Pago por transferencia
      </Text>
      <Text style={{ fontSize: 6, color: '#888', textAlign: 'center' }}>
        Escanea con tu app del banco
      </Text>
    </View>
  );
}

// Render cliente content. `styles` debe tener: clienteLine, clienteWarning.
export function ClienteContent({
  tipo, cliente, cpCiudad, asuntoFallback, styles,
}) {
  if (cliente) {
    return (
      <>
        {cliente.nombre ? (
          <Text style={styles.clienteLine}>{cliente.nombre}</Text>
        ) : null}
        {cliente.nif ? (
          <Text style={styles.clienteLine}>{cliente.nif}</Text>
        ) : null}
        {cliente.direccion ? (
          <Text style={styles.clienteLine}>{cliente.direccion}</Text>
        ) : null}
        {tipo === 'factura'
          ? cpCiudad
            ? <Text style={styles.clienteLine}>{cpCiudad}</Text>
            : null
          : cliente.ciudad
            ? <Text style={styles.clienteLine}>{cliente.ciudad}</Text>
            : null}
        {/* v1.2.31: condiciones de pago de la ficha del cliente, bajo la
            direccion. Si el cliente no las tiene rellenadas, no sale nada. */}
        {cliente.condiciones_pago ? (
          <Text style={[styles.clienteLine, { fontSize: 9, color: '#5a5a5a', marginTop: 4 }]}>
            {cliente.condiciones_pago}
          </Text>
        ) : null}
      </>
    );
  }
  if (tipo === 'factura') {
    return <Text style={styles.clienteWarning}>FALTA CLIENTE</Text>;
  }
  return <Text style={styles.clienteLine}>{asuntoFallback || ''}</Text>;
}

// Estilos inline compartidos para subitems. Mismos en todas las plantillas
// (no merece la pena particularizarlos por plantilla).
const SUB_ROW = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginTop: 4,
  paddingLeft: 12,
};
const SUB_DESC = { flex: 1, fontSize: 9, paddingRight: 10, color: '#4a4a4a', lineHeight: 1.35 };
const SUB_IMP = { width: 70, textAlign: 'right', fontSize: 9, color: '#3a3a3a' };
// Wrapper de los subitems: añade un margen superior generoso para separar
// del titulo de la linea. Sin esto, el primer subitem queda pegado al titulo.
const SUBS_WRAP = { marginTop: 6 };

// Anyade el desglose 'cantidad x precio_unitario' al final de la descripcion
// SOLO si el subitem tiene ambos valores. Asi en el PDF queda algo como
// "Lijado (3 x 50,00 EUR)" en lugar de solo "Lijado".
function _subitemTexto(s) {
  const desc = (s.descripcion || '').trim() || '—';
  const c = s.cantidad;
  const p = s.precio_unitario;
  const cSet = c !== null && c !== undefined && c !== '';
  const pSet = p !== null && p !== undefined && p !== '';
  if (cSet && pSet) {
    return `${desc} (${Number(c)} × ${formatEUR(p)})`;
  }
  return desc;
}

function _renderSubitems(subs) {
  return (
    <View style={SUBS_WRAP}>
      {subs.map((s, j) => (
        <View key={s.id ?? `sub-${j}`} style={SUB_ROW}>
          <Text style={SUB_DESC}>{_subitemTexto(s)}</Text>
          <Text style={SUB_IMP}>{formatEUR(s.importe)}</Text>
        </View>
      ))}
    </View>
  );
}

// Render una linea del cuerpo. `styles` debe tener: lineRow, lineTitulo,
// lineDesc, lineConcepto, lineImp.
//
// Si `modoDetallado` es true y la linea trae sublineas, las renderiza
// indentadas debajo del titulo. El importe del titulo a la derecha sigue
// siendo el total de la linea (suma de subitems calculada en backend).
// `ocultarSubitemsFactura` (opcional) fuerza a no renderizar subitems si
// estamos en tipo='factura', aunque modoDetallado siga activo. Util para
// enviar al cliente una factura sin el desglose interno que si tiene el
// presupuesto original.
export function renderLineRow(tipo, l, i, styles, modoDetallado, ocultarSubitemsFactura) {
  const tit = (l.titulo || '').trim();
  const desc = (l.descripcion || '').trim();
  const subs = Array.isArray(l.sublineas) ? l.sublineas : [];
  const ocultarPorFactura = !!ocultarSubitemsFactura && tipo === 'factura';
  const showSubs = !!modoDetallado && subs.length > 0 && !ocultarPorFactura;

  if (tipo === 'factura') {
    // v1.2.36: layout TABLA en facturas — 5 columnas: DESCRIPCION (flex:1) +
    // UNID + PRECIO U + DTO + IMPORTE. Sustituye el subline gris "N ud × P €"
    // y el "DTO -X%" inline de v1.2.34 por columnas explicitas. Pedido madre
    // ("cambiar modo de poner las lineas en facturas... ahora paso captura").
    // - DESC mantiene flex:1 con concepto en bold + descripcion debajo en gris.
    // - UNID/PRECIO/DTO en gris-medio, alineados a la derecha.
    // - IMPORTE en negrita (lineImp).
    // - Cuando hay dto de linea, IMPORTE muestra el NET; DTO muestra "-X%" o "-X€".
    const concepto = tit || desc || '—';
    const descBajoTitulo = tit && desc ? desc : null;
    const cant = Number(l.cantidad);
    const precio = Number(l.precio_unitario);
    const dtoTipo = l.descuento_tipo === 'eur' ? 'eur' : 'pct';
    const dtoVal = Number(l.descuento_valor) || 0;
    const tieneDto = dtoVal > 0;
    const importeGross = Number(l.importe) || 0;
    const c = Number.isFinite(cant) && cant > 0 ? cant : 1;
    const tienePrecio = Number.isFinite(precio) && precio > 0;
    const p = tienePrecio ? precio : (c > 0 ? importeGross / c : importeGross);
    const importeNet = tieneDto
      ? round2(importeGross - descuentoImporte(importeGross, dtoTipo, dtoVal))
      : importeGross;
    const cantTxt = `${c}`;
    const precioTxt = formatEUR(p);
    const dtoTxt = tieneDto
      ? (dtoTipo === 'eur' ? `−${formatEUR(dtoVal)}` : `−${dtoVal}%`)
      : '';
    // Estilos de cells numericas: si la plantilla declara `lineCellNum`, lo
    // usamos; si no, derivamos del concepto generico (lineTitulo sin bold).
    const numCellBase = styles.lineCellNum || {
      fontSize: (styles.lineTitulo?.fontSize || 10) - 0.5,
      color: '#3a3a3a',
    };
    return (
      <View key={l.id ?? i} style={styles.lineRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.lineTitulo}>{concepto}</Text>
          {descBajoTitulo ? (
            <Text style={{ fontSize: 9, color: '#5a5a5a', marginTop: 2, lineHeight: 1.4 }}>
              {descBajoTitulo}
            </Text>
          ) : null}
          {showSubs ? _renderSubitems(subs) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Text style={[numCellBase, { width: FACT_COL.unid, textAlign: 'right' }]}>
            {cantTxt}
          </Text>
          <Text style={[numCellBase, { width: FACT_COL.precio, textAlign: 'right' }]}>
            {precioTxt}
          </Text>
          <Text style={[numCellBase, { width: FACT_COL.dto, textAlign: 'right' }]}>
            {dtoTxt}
          </Text>
          <Text style={[styles.lineImp, { width: FACT_COL.imp }]}>
            {formatEUR(importeNet)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View key={l.id ?? i} style={styles.lineRow}>
      <View style={{ flex: 1, paddingRight: 16 }}>
        {tit ? <Text style={styles.lineTitulo}>{tit}</Text> : null}
        {desc ? <Text style={styles.lineDesc}>{desc}</Text> : null}
        {showSubs ? _renderSubitems(subs) : null}
      </View>
      <Text style={styles.lineImp}>{formatEUR(l.importe)}</Text>
    </View>
  );
}

// v1.2.36: cells del header de tabla para FACTURAS (5 columnas). Se llama
// dentro del <View styles.tableHeader> de cada plantilla. Devuelve un
// fragmento. La plantilla puede pasar colorOverride para teñir los textos
// (Cabecera/Lateral lo usan con v.brandColor).
export function FacturaTableHeaderCells({ styles, tableHeaderLeft, colorOverride }) {
  // thNum es opcional — si la plantilla no lo declara, usamos thImp como
  // base (mismo tamaño y peso que IMPORTE pero alineamos a la derecha).
  const thNum = styles.thNum || styles.thImp;
  const tint = colorOverride ? { color: colorOverride } : null;
  return (
    <>
      <Text style={[styles.thDesc, { flex: 1 }, tint]}>{tableHeaderLeft}</Text>
      <View style={{ flexDirection: 'row' }}>
        <Text style={[thNum, { width: FACT_COL.unid, textAlign: 'right' }, tint]}>UNID.</Text>
        <Text style={[thNum, { width: FACT_COL.precio, textAlign: 'right' }, tint]}>PRECIO U.</Text>
        <Text style={[thNum, { width: FACT_COL.dto, textAlign: 'right' }, tint]}>DTO.</Text>
        <Text style={[styles.thImp, { width: FACT_COL.imp }, tint]}>IMPORTE</Text>
      </View>
    </>
  );
}

// Render bloque de totales. `styles` debe tener: totalRow, totalLabel,
// totalValue, totalDivider, totalLabelBig, totalValueBig.
// Si `dividerColor` se pasa, sobreescribe el background del divider (algunas
// plantillas pintan el divider con el color principal).
//
// Soporta:
// - IVA por linea: si la factura tiene varios tipos de IVA, los desglosa
//   ("IVA 21% sobre 100,00 EUR ... 21,00 EUR" + "IVA 10% sobre 50,00 EUR ... 5,00 EUR").
// - IRPF: si irpfPct > 0, anyade una linea con la retencion (en negativo).
// - "Sin IVA" (incluyeIva=false): suprime la fila de IVA y anyade una nota
//   "IVA no incluido" debajo del total para que quede explicito.
export function TotalsBlock({
  tipo,
  ivaPct, base, iva, total, irpf, irpfPct, ivaBreakdown, incluyeIva,
  recargoEq, notaFiscal,
  subtotalBruto, descuentoTotal, descuentoLineas, descuentoGlobal,
  styles, dividerColor,
  // v1.2.25: extras opcionales. Si una plantilla los pasa, los renderiza
  // debajo del total. Util para no tocar las 9 plantillas con bloques nuevos.
  fechaVencimientoTxt, notasPublicas,
  // v1.2.32: label del descuento — incluye el % cuando el descuento global
  // es porcentual. Default 'DESCUENTO' a secas.
  descuentoLabel = 'DESCUENTO',
  // v1.2.36: cobros marcados como "mostrar en PDF" (pago a cuenta). Si la
  // lista no esta vacia, debajo del TOTAL aparece un bloque en rojo con
  // cada cobro (fecha + importe) y una linea PENDIENTE con el restante.
  cobrosPdf,
}) {
  const dividerStyle = dividerColor
    ? [styles.totalDivider, { backgroundColor: dividerColor }]
    : styles.totalDivider;
  const sinIva = incluyeIva === false;
  // v1.2.34: SUBTOTAL/DESCUENTO solo aparecen cuando el descuento es GLOBAL
  // (a nivel documento). Si el descuento es de linea, cada linea ya lo
  // muestra inline ("N ud × precio −X%") y su importe a la derecha es el
  // NET, asi que sumarlos da directo la BASE IMPONIBLE — no hace falta el
  // bloque subtotal/descuento.
  // Esto solo aplica a FACTURAS (donde renderLineRow ya muestra NET con
  // dto inline). En presupuestos el render mantiene el comportamiento
  // anterior — lineas muestran GROSS — asi que el bloque subtotal/descuento
  // sigue apareciendo como antes para no romper la suma visual.
  const esFactura = tipo === 'factura';
  const dGlobal = Number(descuentoGlobal) || 0;
  const dLineas = Number(descuentoLineas) || 0;
  const conDescuentoGlobal = esFactura
    ? (dGlobal > 0 || (dLineas === 0 && Number(descuentoTotal) > 0))
    : (Number(descuentoTotal) > 0);
  // Subtotal a mostrar cuando hay global: gross menos dto de linea (= sum
  // de los NETs de cada linea). Asi descuento global se resta de aqui y da
  // base imponible. Cuando no hay dto linea, coincide con subtotalBruto.
  // En presupuestos siempre mostramos subtotalBruto (preserva comportamiento).
  const subtotalParaMostrar = esFactura
    ? round2((Number(subtotalBruto) || 0) - dLineas)
    : Number(subtotalBruto) || 0;
  const breakdown = Array.isArray(ivaBreakdown) && ivaBreakdown.length > 0
    ? ivaBreakdown
    : (sinIva ? [] : [{ pct: ivaPct, base, importe: iva }]);
  return (
    <>
      {conDescuentoGlobal ? (
        <>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>SUBTOTAL</Text>
            <Text style={styles.totalValue}>{formatEUR(subtotalParaMostrar)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{descuentoLabel}</Text>
            <Text style={styles.totalValue}>
              {`− ${formatEUR(
                esFactura ? (dGlobal > 0 ? dGlobal : descuentoTotal) : descuentoTotal,
              )}`}
            </Text>
          </View>
        </>
      ) : null}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>BASE IMPONIBLE</Text>
        <Text style={styles.totalValue}>{formatEUR(base)}</Text>
      </View>
      {breakdown.map((b) => (
        <View key={`iva-${b.pct}`} style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            {`IVA ${b.pct}%${breakdown.length > 1 ? ` s/ ${formatEUR(b.base)}` : ''}`}
          </Text>
          <Text style={styles.totalValue}>{formatEUR(b.importe)}</Text>
        </View>
      ))}
      {Number(irpfPct) > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{`IRPF ${irpfPct}%`}</Text>
          <Text style={styles.totalValue}>{`− ${formatEUR(irpf || 0)}`}</Text>
        </View>
      ) : null}
      {Number(recargoEq) > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>RECARGO DE EQUIVALENCIA</Text>
          <Text style={styles.totalValue}>{`+ ${formatEUR(recargoEq || 0)}`}</Text>
        </View>
      ) : null}
      <View style={dividerStyle} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabelBig}>TOTAL</Text>
        <Text style={styles.totalValueBig}>{formatEUR(total)}</Text>
      </View>
      {Array.isArray(cobrosPdf) && cobrosPdf.length > 0 ? (() => {
        // v1.2.36: pago a cuenta — bloque en rojo debajo del TOTAL. Una fila
        // por cobro mostrado (fecha + importe negativo), seguido de una fila
        // PENDIENTE con el restante (total - sum cobros). Madre lo pidio asi:
        // "Una fila por cobro mostrado + PENDIENTE: 561,00 €".
        const sumCobros = cobrosPdf.reduce(
          (s, c) => s + (Number(c.importe) || 0), 0,
        );
        const pendiente = round2((Number(total) || 0) - sumCobros);
        return (
          <View style={{ marginTop: 6 }}>
            {cobrosPdf.map((c, i) => (
              <View key={`pc-${c.id ?? i}`} style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: '#b91c1c' }]}>
                  {`PAGO A CUENTA (${formatFechaES(c.fecha)})`}
                </Text>
                <Text style={[styles.totalValue, { color: '#b91c1c' }]}>
                  {`− ${formatEUR(c.importe)}`}
                </Text>
              </View>
            ))}
            <View style={[styles.totalRow, { marginTop: 2 }]}>
              <Text style={[styles.totalLabelBig, { color: '#b91c1c' }]}>
                PENDIENTE
              </Text>
              <Text style={[styles.totalValueBig, { color: '#b91c1c' }]}>
                {formatEUR(pendiente)}
              </Text>
            </View>
          </View>
        );
      })() : null}
      {notaFiscal ? (
        <Text style={{
          fontSize: 8,
          color: '#6a6a6a',
          textAlign: 'right',
          marginTop: 4,
          fontStyle: 'italic',
        }}>
          {notaFiscal}
        </Text>
      ) : sinIva ? (
        <Text style={{
          fontSize: 8.5,
          color: '#6a6a6a',
          textAlign: 'right',
          marginTop: 4,
          fontStyle: 'italic',
        }}>
          IVA no incluido
        </Text>
      ) : null}
      {fechaVencimientoTxt ? (
        <Text style={{
          fontSize: 9,
          color: '#3a3a3a',
          textAlign: 'right',
          marginTop: 6,
        }}>
          {`Vencimiento (Payment Terms): ${fechaVencimientoTxt}`}
        </Text>
      ) : null}
      {notasPublicas ? (
        <View style={{ marginTop: 10 }}>
          <Text style={{
            fontSize: 8.5,
            color: '#5a5a5a',
            fontFamily: 'Helvetica-Bold',
            letterSpacing: 0.8,
            marginBottom: 3,
          }}>
            NOTAS
          </Text>
          <Text style={{ fontSize: 9, color: '#2a2a2a', lineHeight: 1.4 }}>
            {notasPublicas}
          </Text>
        </View>
      ) : null}
    </>
  );
}

export { formatEUR, formatFechaES };
