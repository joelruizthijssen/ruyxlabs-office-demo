// Puerto browser de productos_*.

import { getDb } from '../db.js';
import { empresaActivaId, empresaScope, round2 } from '../helpers.js';

export function productosList({ query, includeArchived } = {}) {
  const db = getDb();
  const sc = empresaScope();
  let sql = `SELECT * FROM productos WHERE 1=1${sc.sql}`;
  const params = [...sc.params];
  if (!includeArchived) sql += ' AND archivado = 0';
  if (query && query.trim()) {
    sql += ' AND (LOWER(nombre) LIKE LOWER(?) OR LOWER(codigo) LIKE LOWER(?))';
    const like = `%${query.trim()}%`;
    params.push(like, like);
  }
  sql += ' ORDER BY nombre COLLATE NOCASE ASC';
  return db.prepare(sql).all(params);
}

export function productosGet(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM productos WHERE id = ?').get([id]);
}

export function productosGetByCodigo(codigo) {
  const db = getDb();
  const c = String(codigo || '').trim();
  if (!c) return null;
  const sc = empresaScope();
  return db.prepare(
    `SELECT * FROM productos WHERE LOWER(codigo) = LOWER(?)${sc.sql}
     ORDER BY archivado ASC, id ASC LIMIT 1`,
  ).get([c, ...sc.params]) || null;
}

function _codigoEnUso(codigo, excludeId) {
  const db = getDb();
  const c = String(codigo || '').trim();
  if (!c) return false;
  const sc = empresaScope();
  const row = db.prepare(
    `SELECT id FROM productos WHERE LOWER(codigo) = LOWER(?)${sc.sql} AND id != ? LIMIT 1`,
  ).get([c, ...sc.params, excludeId || -1]);
  return !!row;
}

function _precioVenta(data, current) {
  if (data?.precio_venta != null && data.precio_venta !== '') return Number(data.precio_venta) || 0;
  if (data?.precio_unitario != null && data.precio_unitario !== '') return Number(data.precio_unitario) || 0;
  return Number(current?.precio_venta ?? current?.precio_unitario) || 0;
}

export function productosCreate(data) {
  const db = getDb();
  const codigo = data?.codigo ? String(data.codigo).trim() : null;
  if (codigo && _codigoEnUso(codigo, null)) {
    return { error: `Ya existe un producto con el código "${codigo}". Los códigos no se pueden repetir.` };
  }
  const venta = _precioVenta(data, null);
  const info = db.prepare(`
    INSERT INTO productos (
      empresa_id, codigo, nombre, descripcion,
      precio_unitario, precio_compra, precio_venta, iva_pct, unidad,
      marca_id, proveedor,
      tarifa_1, tarifa_2, tarifa_3, tarifa_4,
      precio_compra_1, precio_compra_2, precio_compra_3, precio_compra_4
    ) VALUES (
      :empresa_id, :codigo, :nombre, :descripcion,
      :precio, :compra, :venta, :iva, :unidad,
      :marca_id, :proveedor,
      :t1, :t2, :t3, :t4,
      :pc1, :pc2, :pc3, :pc4
    )
  `).run({
    ':empresa_id': empresaActivaId(),
    ':codigo': codigo,
    ':nombre': (data?.nombre || '').trim() || 'Sin nombre',
    ':descripcion': data?.descripcion ?? null,
    ':precio': venta, ':compra': Number(data?.precio_compra) || 0, ':venta': venta,
    ':iva': data?.iva_pct == null || data.iva_pct === '' ? null : Number(data.iva_pct),
    ':unidad': data?.unidad || 'ud',
    ':marca_id': data?.marca_id ? Number(data.marca_id) : null,
    ':proveedor': data?.proveedor ?? null,
    ':t1': Number(data?.tarifa_1) || 0, ':t2': Number(data?.tarifa_2) || 0,
    ':t3': Number(data?.tarifa_3) || 0, ':t4': Number(data?.tarifa_4) || 0,
    ':pc1': Number(data?.precio_compra_1) || 0,
    ':pc2': Number(data?.precio_compra_2) || 0,
    ':pc3': Number(data?.precio_compra_3) || 0,
    ':pc4': Number(data?.precio_compra_4) || 0,
  });
  return productosGet(info.lastInsertRowid);
}

export function productosUpdate(id, data) {
  const db = getDb();
  const current = productosGet(id);
  if (!current) return null;
  const m = { ...current, ...data };
  const codigoNuevo = m.codigo ? String(m.codigo).trim() : null;
  if (codigoNuevo && _codigoEnUso(codigoNuevo, id)) {
    return { error: `Ya existe otro producto con el código "${codigoNuevo}". Los códigos no se pueden repetir.` };
  }
  const venta = _precioVenta(data, current);
  db.prepare(`
    UPDATE productos SET codigo = :codigo, nombre = :nombre, descripcion = :descripcion,
      precio_unitario = :precio, precio_compra = :compra, precio_venta = :venta,
      iva_pct = :iva, unidad = :unidad, marca_id = :marca_id, proveedor = :proveedor,
      tarifa_1 = :t1, tarifa_2 = :t2, tarifa_3 = :t3, tarifa_4 = :t4,
      precio_compra_1 = :pc1, precio_compra_2 = :pc2, precio_compra_3 = :pc3, precio_compra_4 = :pc4,
      actualizado_at = datetime('now') WHERE id = :id
  `).run({
    ':id': id, ':codigo': codigoNuevo,
    ':nombre': (m.nombre || '').trim() || 'Sin nombre',
    ':descripcion': m.descripcion ?? null,
    ':precio': venta, ':compra': Number(m.precio_compra) || 0, ':venta': venta,
    ':iva': m.iva_pct == null || m.iva_pct === '' ? null : Number(m.iva_pct),
    ':unidad': m.unidad || 'ud',
    ':marca_id': m.marca_id ? Number(m.marca_id) : null,
    ':proveedor': m.proveedor ?? null,
    ':t1': Number(m.tarifa_1) || 0, ':t2': Number(m.tarifa_2) || 0,
    ':t3': Number(m.tarifa_3) || 0, ':t4': Number(m.tarifa_4) || 0,
    ':pc1': Number(m.precio_compra_1) || 0, ':pc2': Number(m.precio_compra_2) || 0,
    ':pc3': Number(m.precio_compra_3) || 0, ':pc4': Number(m.precio_compra_4) || 0,
  });
  return productosGet(id);
}

export function productosArchive(id, archived = true) {
  const db = getDb();
  db.prepare(`UPDATE productos SET archivado = ?, actualizado_at = datetime('now') WHERE id = ?`)
    .run([archived ? 1 : 0, id]);
  return productosGet(id);
}

export function productosDelete(id) {
  const db = getDb();
  db.prepare('DELETE FROM productos WHERE id = ?').run([id]);
  return { ok: true };
}

// Detalle: movimientos de venta/compra por codigo. Simplificado para demo:
// solo lo esencial. La UI de escritorio usa filtros por anio/tipo — los
// respetamos con la misma firma.
export function productosDetalle(id, opts = {}) {
  const db = getDb();
  const producto = productosGet(id);
  if (!producto) return null;
  const codigo = String(producto.codigo || '').trim();
  if (!codigo) {
    return {
      producto, movimientos: [], anios: [],
      agregados: { total_vendido: 0, total_comprado: 0, n_movs: 0 },
    };
  }
  const tipo = ['salida', 'entrada'].includes(opts.tipo) ? opts.tipo : 'todo';
  const anio = opts.anio ? String(opts.anio) : null;
  const sc = empresaScope();
  const scF = { sql: sc.sql.replace(/empresa_id/g, 'f.empresa_id'), params: sc.params };
  const scG = { sql: sc.sql.replace(/empresa_id/g, 'g.empresa_id'), params: sc.params };

  const salidas = db.prepare(`
    SELECT f.id AS factura_id, f.numero AS doc_numero, f.fecha AS fecha,
           f.estado AS estado, f.subtipo AS subtipo,
           (SELECT nombre FROM clientes WHERE id = f.cliente_id) AS contraparte,
           lf.cantidad AS cantidad, lf.precio_unitario AS precio,
           lf.importe AS importe, lf.titulo AS descripcion_linea
    FROM lineas_factura lf
    JOIN facturas f ON f.id = lf.factura_id
    WHERE f.deleted_at IS NULL
      AND (f.subtipo IS NULL OR f.subtipo IN ('factura','rectificativa','nota_contado','proforma'))
      AND LOWER(lf.codigo) = LOWER(?)${scF.sql}
    ORDER BY f.fecha DESC, f.id DESC
  `).all([codigo, ...scF.params]);

  const entradasLineas = db.prepare(`
    SELECT g.id AS gasto_id, g.fecha AS fecha,
           g.numero_factura_proveedor AS doc_numero,
           g.proveedor AS contraparte, g.subtipo AS subtipo,
           NULL AS cantidad, gl.base_imponible AS importe,
           gl.concepto AS descripcion_linea
    FROM gasto_lineas gl
    JOIN gastos g ON g.id = gl.gasto_id
    WHERE g.deleted_at IS NULL AND LOWER(gl.codigo) = LOWER(?)${scG.sql}
    ORDER BY g.fecha DESC, g.id DESC
  `).all([codigo, ...scG.params]);

  const entradasLegacy = db.prepare(`
    SELECT g.id AS gasto_id, g.fecha AS fecha,
           g.numero_factura_proveedor AS doc_numero,
           g.proveedor AS contraparte, g.subtipo AS subtipo,
           NULL AS cantidad, g.base_imponible AS importe,
           g.concepto AS descripcion_linea
    FROM gastos g
    WHERE g.deleted_at IS NULL AND LOWER(g.producto_codigo) = LOWER(?)
      AND NOT EXISTS (SELECT 1 FROM gasto_lineas gl WHERE gl.gasto_id = g.id)${scG.sql}
    ORDER BY g.fecha DESC, g.id DESC
  `).all([codigo, ...scG.params]);

  const movs = [];
  for (const s of salidas) {
    movs.push({
      tipo: 'salida', fecha: s.fecha, doc_numero: s.doc_numero,
      contraparte: s.contraparte || '', cantidad: Number(s.cantidad) || 0,
      importe: Number(s.importe) || 0, descripcion: s.descripcion_linea || '',
      ref_id: s.factura_id, ref_tipo: 'factura', subtipo: s.subtipo || null,
    });
  }
  for (const e of [...entradasLineas, ...entradasLegacy]) {
    movs.push({
      tipo: 'entrada', fecha: e.fecha, doc_numero: e.doc_numero,
      contraparte: e.contraparte || '',
      cantidad: e.cantidad != null ? Number(e.cantidad) : null,
      importe: Number(e.importe) || 0, descripcion: e.descripcion_linea || '',
      ref_id: e.gasto_id, ref_tipo: 'gasto', subtipo: e.subtipo || null,
    });
  }
  movs.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  const aniosSet = new Set();
  for (const m of movs) if (m.fecha) aniosSet.add(m.fecha.slice(0, 4));
  const anios = Array.from(aniosSet).sort((a, b) => (a < b ? 1 : -1));

  const filtrados = movs.filter((m) => {
    if (anio && (!m.fecha || !m.fecha.startsWith(anio))) return false;
    if (tipo !== 'todo' && m.tipo !== tipo) return false;
    return true;
  });

  let totalVendido = 0, totalComprado = 0;
  for (const m of filtrados) {
    if (m.tipo === 'salida') totalVendido += m.importe;
    else if (m.tipo === 'entrada') totalComprado += m.importe;
  }

  return {
    producto, movimientos: filtrados, anios,
    agregados: {
      total_vendido: round2(totalVendido),
      total_comprado: round2(totalComprado),
      n_movs: filtrados.length,
    },
    filtros: { anio: anio || null, tipo },
  };
}
