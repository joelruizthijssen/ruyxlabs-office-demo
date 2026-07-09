// Generador de archivos XLSX en formato compatible con la importacion de
// "Facturas de venta" de Holded.
//
// Holded espera UNA fila por linea de factura, repitiendo los campos de
// cabecera (numero, fecha, cliente, NIF) en cada fila. Holded agrupa por
// numero al importar. Los nombres exactos de columnas pueden variar entre
// versiones de Holded — si la importacion falla, en el wizard de Holded el
// usuario puede mapear columnas manualmente.

import * as XLSX from 'xlsx';

// Fecha YYYY-MM-DD -> DD/MM/YYYY (formato espanyol que Holded reconoce).
function fechaEs(yyyymmdd) {
  if (!yyyymmdd || typeof yyyymmdd !== 'string') return '';
  const m = yyyymmdd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return yyyymmdd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function _round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Construye un workbook XLSX con una hoja "Facturas". Cada linea de la
// factura genera una fila. Si la factura no tiene lineas, devuelve una sola
// fila con el total en la columna "Importe".
//
// Columnas (en orden — coincide con la plantilla "Importar facturas de
// venta" de Holded a fecha de mayo 2026):
//   Codigo, Fecha emision, Cliente, NIF, Email, Direccion, CP, Ciudad,
//   Provincia, Pais, Concepto, Cantidad, Precio unitario, % IVA, Importe
export function buildHoldedXlsxBuffer({ factura, lineas, cliente }) {
  const f = factura || {};
  const c = cliente || {};
  const ls = Array.isArray(lineas) && lineas.length > 0 ? lineas : null;

  const headers = [
    'Codigo',
    'Fecha emision',
    'Cliente',
    'NIF',
    'Email',
    'Direccion',
    'CP',
    'Ciudad',
    'Provincia',
    'Pais',
    'Concepto',
    'Cantidad',
    'Precio unitario',
    '% IVA',
    'Importe',
  ];

  const cabeceraComun = {
    Codigo: f.numero || '',
    'Fecha emision': fechaEs(f.fecha),
    Cliente: c.nombre || '',
    NIF: c.nif || '',
    Email: c.email || '',
    Direccion: c.direccion || '',
    CP: c.cp || '',
    Ciudad: c.ciudad || '',
    Provincia: c.provincia || '',
    Pais: 'España',
    '% IVA': Number(f.iva_porcentaje) || 0,
  };

  const rows = [];

  if (ls) {
    for (const l of ls) {
      const titulo = (l.titulo || '').trim();
      const desc = (l.descripcion || '').trim();
      const concepto = titulo || desc.slice(0, 80) || '—';
      // En la app trabajamos casi siempre con cantidad=1 y precio_unitario=
      // importe (los formularios solo expone "importe" directo). Si la fila
      // tiene cantidad+precio, los respetamos.
      const cantidad = Number(l.cantidad) || 1;
      const precioUnit = _round2(
        l.precio_unitario != null ? l.precio_unitario : l.importe,
      );
      const importe = _round2(l.importe);
      rows.push({
        ...cabeceraComun,
        Concepto: concepto,
        Cantidad: cantidad,
        'Precio unitario': precioUnit,
        Importe: importe,
      });
    }
  } else {
    // Factura sin lineas: una fila con concepto generico. La importacion en
    // Holded probablemente fallara o quedara vacia, pero al menos el archivo
    // no esta vacio.
    rows.push({
      ...cabeceraComun,
      Concepto: f.asunto || 'Sin descripcion',
      Cantidad: 1,
      'Precio unitario': _round2(f.total),
      Importe: _round2(f.total),
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });

  // Ancho de columnas razonable para que se vea bien al abrirlo en Excel.
  ws['!cols'] = [
    { wch: 12 }, // Codigo
    { wch: 12 }, // Fecha
    { wch: 24 }, // Cliente
    { wch: 14 }, // NIF
    { wch: 26 }, // Email
    { wch: 28 }, // Direccion
    { wch: 8 },  // CP
    { wch: 18 }, // Ciudad
    { wch: 16 }, // Provincia
    { wch: 10 }, // Pais
    { wch: 36 }, // Concepto
    { wch: 9 },  // Cantidad
    { wch: 14 }, // Precio
    { wch: 8 },  // % IVA
    { wch: 12 }, // Importe
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Facturas');

  // bookType xlsx + type array → Uint8Array que podemos pasar via IPC.
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buf;
}

// Sugiere un nombre de fichero seguro para Windows (sin / : * ? etc.).
export function holdedFilename(factura) {
  const numero = factura?.numero || 'sin-numero';
  const safe = numero.replace(/[\\/:*?"<>|]/g, '-');
  return `Holded_factura_${safe}.xlsx`;
}
