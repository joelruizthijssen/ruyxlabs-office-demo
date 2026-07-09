// Helpers compartidos para documentos (factura + presupuesto): totales,
// recalculos, subitems. Portados 1:1 desde repository.cjs.

import { getDb } from '../db.js';
import { round2, descuentoImporte, reRate } from '../helpers.js';

// Nucleo de calculo del documento: base/IVA/RE a partir de las lineas (con
// descuento por linea) + descuento global.
export function documentoTotales(lineas, ivaGlobal, opts) {
  const incluyeIva = opts?.incluyeIva !== false;
  const conRecargo = !!opts?.recargoEquivalencia;
  const buckets = new Map();
  for (const l of lineas) {
    const imp = Number(l.importe) || 0;
    const pct = l.iva_pct == null ? (Number(ivaGlobal) || 0) : (Number(l.iva_pct) || 0);
    const dl = descuentoImporte(imp, l.descuento_tipo, l.descuento_valor);
    const net = round2(imp - dl);
    buckets.set(pct, (buckets.get(pct) || 0) + net);
  }
  let subtotal = 0;
  for (const b of buckets.values()) subtotal += b;
  subtotal = round2(subtotal);
  const descG = descuentoImporte(subtotal, opts?.descGlobalTipo, opts?.descGlobalValor);
  const factor = subtotal > 0 ? Math.max(0, (subtotal - descG) / subtotal) : 1;
  let base = 0;
  let iva = 0;
  let recargoEq = 0;
  for (const [pct, b] of buckets) {
    const bR = round2(b * factor);
    base += bR;
    iva += incluyeIva ? round2((bR * pct) / 100) : 0;
    if (conRecargo) recargoEq += round2((bR * reRate(pct)) / 100);
  }
  return { base: round2(base), iva: round2(iva), recargoEq: round2(recargoEq) };
}

export function kindTables(kind) {
  if (kind === 'factura') {
    return { lineaTbl: 'lineas_factura', subTbl: 'sublineas_factura', docTbl: 'facturas', docFk: 'factura_id' };
  }
  return { lineaTbl: 'lineas_presupuesto', subTbl: 'sublineas_presupuesto', docTbl: 'presupuestos', docFk: 'presupuesto_id' };
}

export function recalcularImporteLineaSiTieneSubs(linea_id, kind) {
  const db = getDb();
  const t = kindTables(kind);
  const linea = db.prepare(`SELECT id, ${t.docFk} FROM ${t.lineaTbl} WHERE id = ?`).get([linea_id]);
  if (!linea) return null;
  const docId = linea[t.docFk];
  const doc = db.prepare(`SELECT modo_detallado FROM ${t.docTbl} WHERE id = ?`).get([docId]);
  if (!doc || !doc.modo_detallado) return docId;
  const sumRow = db.prepare(
    `SELECT COALESCE(SUM(importe), 0) AS s, COUNT(*) AS c FROM ${t.subTbl} WHERE linea_id = ?`,
  ).get([linea_id]);
  if (sumRow.c === 0) return docId;
  const newImporte = round2(sumRow.s);
  db.prepare(`UPDATE ${t.lineaTbl} SET importe = ? WHERE id = ?`).run([newImporte, linea_id]);
  return docId;
}

export function recalcularTotalesPresupuesto(presupuesto_id) {
  const db = getDb();
  const p = db.prepare(
    'SELECT iva_porcentaje, descuento_tipo, descuento_valor FROM presupuestos WHERE id = ?',
  ).get([presupuesto_id]);
  if (!p) return;
  const ivaGlobal = Number(p.iva_porcentaje) || 0;
  const lineas = db.prepare(
    `SELECT importe, iva_pct, descuento_tipo, descuento_valor FROM lineas_presupuesto WHERE presupuesto_id = ?`,
  ).all([presupuesto_id]);
  const { base, iva } = documentoTotales(lineas, ivaGlobal, {
    incluyeIva: true,
    descGlobalTipo: p.descuento_tipo,
    descGlobalValor: p.descuento_valor,
  });
  const total = round2(base + iva);
  db.prepare(`
    UPDATE presupuestos SET base_imponible = :base, iva_importe = :iva, total = :total,
      updated_at = datetime('now') WHERE id = :id
  `).run({ ':base': base, ':iva': iva, ':total': total, ':id': presupuesto_id });
}

export function recalcularTotalesFactura(factura_id) {
  const db = getDb();
  const f = db.prepare(
    'SELECT iva_porcentaje, irpf_pct, cliente_id, descuento_tipo, descuento_valor FROM facturas WHERE id = ?',
  ).get([factura_id]);
  if (!f) return;
  const ivaGlobal = Number(f.iva_porcentaje) || 0;
  const irpfPct = Number(f.irpf_pct) || 0;
  const cli = f.cliente_id
    ? db.prepare('SELECT recargo_equivalencia AS re, intracomunitario AS ic FROM clientes WHERE id = ?').get([f.cliente_id])
    : null;
  const intracom = !!(cli && cli.ic);
  const reActivo = !intracom && !!(cli && cli.re);
  const lineas = db.prepare(
    `SELECT importe, iva_pct, descuento_tipo, descuento_valor FROM lineas_factura WHERE factura_id = ?`,
  ).all([factura_id]);
  const { base, iva, recargoEq } = documentoTotales(lineas, ivaGlobal, {
    incluyeIva: !intracom,
    recargoEquivalencia: reActivo,
    descGlobalTipo: f.descuento_tipo,
    descGlobalValor: f.descuento_valor,
  });
  const irpf = round2((base * irpfPct) / 100);
  const total = round2(base + iva - irpf + recargoEq);
  db.prepare(`
    UPDATE facturas SET base_imponible = :base, iva_importe = :iva,
      recargo_eq_importe = :re, total = :total, intracomunitario = :intracom,
      updated_at = datetime('now') WHERE id = :id
  `).run({ ':base': base, ':iva': iva, ':re': recargoEq, ':total': total,
    ':intracom': intracom ? 1 : 0, ':id': factura_id });
}

export function facturaBloqueada(id) {
  const db = getDb();
  const row = db.prepare('SELECT estado, deleted_at FROM facturas WHERE id = ?').get([id]);
  if (!row || row.deleted_at) return false;
  return row.estado !== 'borrador';
}

export function presupuestoBloqueado(id) {
  const db = getDb();
  const row = db.prepare('SELECT estado, deleted_at FROM presupuestos WHERE id = ?').get([id]);
  if (!row || row.deleted_at) return false;
  return row.estado === 'convertido';
}

// Normaliza diana_pct a REAL 0-100 (o negativo para signo E).
export function normalizeDianaPct(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  if (n > 100) return 100;
  if (n < -100) return -100;
  return round2(n);
}

// --- Sublineas genericos (mismo CRUD para factura y presupuesto) ---

function _validarSubDocEditable(linea_id, kind) {
  const db = getDb();
  const t = kindTables(kind);
  const row = db.prepare(`SELECT ${t.docFk} AS docId FROM ${t.lineaTbl} WHERE id = ?`).get([linea_id]);
  if (!row) throw new Error('Linea no encontrada');
  if (kind === 'factura') {
    if (facturaBloqueada(row.docId)) throw new Error('Factura bloqueada (pasa a borrador para editar)');
  } else {
    if (presupuestoBloqueado(row.docId)) throw new Error('Presupuesto convertido a factura, no editable');
  }
  return row.docId;
}

export function sublineasList(kind, linea_id) {
  const db = getDb();
  const t = kindTables(kind);
  return db.prepare(`SELECT * FROM ${t.subTbl} WHERE linea_id = ? ORDER BY orden ASC, id ASC`)
    .all([linea_id]);
}

export function sublineasCreate(kind, linea_id, data) {
  const db = getDb();
  _validarSubDocEditable(linea_id, kind);
  const t = kindTables(kind);
  const maxRow = db.prepare(`SELECT COALESCE(MAX(orden), -1) AS m FROM ${t.subTbl} WHERE linea_id = ?`)
    .get([linea_id]);
  const orden = (maxRow.m ?? -1) + 1;
  const cantidad = data?.cantidad != null && data.cantidad !== '' ? Number(data.cantidad) : null;
  const precio = data?.precio_unitario != null && data.precio_unitario !== '' ? round2(data.precio_unitario) : null;
  let importe;
  if (data?.importe != null && data.importe !== '') importe = round2(data.importe);
  else if (cantidad != null && precio != null) importe = round2(cantidad * precio);
  else importe = 0;
  const info = db.prepare(`
    INSERT INTO ${t.subTbl} (linea_id, orden, descripcion, cantidad, precio_unitario, importe)
    VALUES (:lid, :orden, :desc, :cantidad, :precio, :importe)
  `).run({
    ':lid': linea_id, ':orden': orden, ':desc': data?.descripcion ?? '',
    ':cantidad': cantidad, ':precio': precio, ':importe': importe,
  });
  const docId = recalcularImporteLineaSiTieneSubs(linea_id, kind);
  if (docId != null) {
    if (kind === 'factura') recalcularTotalesFactura(docId);
    else recalcularTotalesPresupuesto(docId);
  }
  return db.prepare(`SELECT * FROM ${t.subTbl} WHERE id = ?`).get([info.lastInsertRowid]);
}

export function sublineasUpdate(kind, sub_id, data) {
  const db = getDb();
  const t = kindTables(kind);
  const current = db.prepare(`SELECT * FROM ${t.subTbl} WHERE id = ?`).get([sub_id]);
  if (!current) return null;
  _validarSubDocEditable(current.linea_id, kind);
  const m = { ...current, ...data };
  const cantidad = m.cantidad != null && m.cantidad !== '' ? Number(m.cantidad) : null;
  const precio = m.precio_unitario != null && m.precio_unitario !== '' ? round2(m.precio_unitario) : null;
  let importe;
  if (data?.importe != null && data.importe !== '') importe = round2(data.importe);
  else if (cantidad != null && precio != null) importe = round2(cantidad * precio);
  else importe = round2(m.importe);
  db.prepare(`
    UPDATE ${t.subTbl} SET descripcion = :desc, cantidad = :cantidad,
      precio_unitario = :precio, importe = :importe WHERE id = :id
  `).run({ ':id': sub_id, ':desc': m.descripcion ?? '', ':cantidad': cantidad, ':precio': precio, ':importe': importe });
  const docId = recalcularImporteLineaSiTieneSubs(current.linea_id, kind);
  if (docId != null) {
    if (kind === 'factura') recalcularTotalesFactura(docId);
    else recalcularTotalesPresupuesto(docId);
  }
  return db.prepare(`SELECT * FROM ${t.subTbl} WHERE id = ?`).get([sub_id]);
}

export function sublineasDelete(kind, sub_id) {
  const db = getDb();
  const t = kindTables(kind);
  const current = db.prepare(`SELECT linea_id FROM ${t.subTbl} WHERE id = ?`).get([sub_id]);
  if (!current) return { ok: false };
  _validarSubDocEditable(current.linea_id, kind);
  db.prepare(`DELETE FROM ${t.subTbl} WHERE id = ?`).run([sub_id]);
  const docId = recalcularImporteLineaSiTieneSubs(current.linea_id, kind);
  if (docId != null) {
    if (kind === 'factura') recalcularTotalesFactura(docId);
    else recalcularTotalesPresupuesto(docId);
  }
  return { ok: true };
}

export function sublineasReorder(kind, linea_id, ids_en_orden) {
  const db = getDb();
  if (!Array.isArray(ids_en_orden)) return { ok: false };
  _validarSubDocEditable(linea_id, kind);
  const t = kindTables(kind);
  db.exec('BEGIN');
  try {
    ids_en_orden.forEach((id, i) => {
      db.prepare(`UPDATE ${t.subTbl} SET orden = :orden WHERE id = :id AND linea_id = :lid`)
        .run({ ':id': id, ':orden': i, ':lid': linea_id });
    });
    db.exec('COMMIT');
    return { ok: true };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
