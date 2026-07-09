// Puerto browser de gastos_*, pagos_gasto_*, gastos_vencimientos_*.

import { getDb } from '../db.js';
import {
  empresaActivaId, empresaScope, round2, descuentoImporte, transaction,
} from '../helpers.js';
import { normalizeDianaPct } from './documentos.js';

// Se importa lazy para evitar ciclos (proveedores lo usa como helper).
function _proveedoresGet(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM proveedores WHERE id = ?').get([id]);
}

function _gastoLineasNorm(data) {
  const arr = Array.isArray(data?.lineas) ? data.lineas : null;
  if (arr && arr.length > 0) {
    return arr.map((l) => ({
      codigo: l?.codigo ? String(l.codigo).trim() : null,
      concepto: l?.concepto ?? null,
      cantidad: Number(l?.cantidad) > 0 ? Number(l.cantidad) : 1,
      precio_unitario: Number(l?.precio_unitario) || 0,
      base_imponible: round2(l?.base_imponible),
      iva_pct: Number(l?.iva_pct) || 0,
      descuento_tipo: l?.descuento_tipo === 'eur' ? 'eur' : 'pct',
      descuento_valor: Number(l?.descuento_valor) || 0,
      diana_pct: normalizeDianaPct(l?.diana_pct),
      notas: l?.notas ?? null,
    })).filter((l) => l.base_imponible !== 0 || (l.concepto && l.concepto.trim()) || l.codigo);
  }
  return [{
    codigo: data?.producto_codigo ? String(data.producto_codigo).trim() : null,
    concepto: data?.concepto ?? null,
    cantidad: 1,
    base_imponible: round2(data?.base_imponible),
    iva_pct: Number(data?.iva_pct) || 0,
    descuento_tipo: 'pct',
    descuento_valor: 0,
    diana_pct: 0,
    notas: null,
  }];
}

function _gastoRecalc(g) {
  const lineas = _gastoLineasNorm(g);
  const buckets = new Map();
  for (const l of lineas) {
    const imp = Number(l.base_imponible) || 0;
    const pct = Number(l.iva_pct) || 0;
    const dl = descuentoImporte(imp, l.descuento_tipo, l.descuento_valor);
    const net = round2(imp - dl);
    buckets.set(pct, (buckets.get(pct) || 0) + net);
  }
  let subtotal = 0;
  for (const b of buckets.values()) subtotal += b;
  subtotal = round2(subtotal);
  const descG = descuentoImporte(subtotal, g.descuento_tipo, g.descuento_valor);
  const factor = subtotal !== 0
    ? (Math.abs(subtotal) > 0 ? Math.max(0, (subtotal - descG) / subtotal) : 1)
    : 1;
  let base = 0, iva = 0;
  for (const [pct, b] of buckets) {
    const bR = round2(b * factor);
    base += bR;
    iva += round2((bR * pct) / 100);
  }
  base = round2(base);
  iva = round2(iva);
  const irpfPct = Number(g.irpf_pct) || 0;
  const irpf = round2((base * irpfPct) / 100);
  const total = round2(base + iva - irpf);
  const ivaPct = base > 0 ? round2((iva / base) * 100) : (Number(g.iva_pct) || 0);
  return { base, ivaPct, iva, irpfPct, irpf, total, lineas };
}

function _gastoLineasReplace(gastoId, lineas) {
  const db = getDb();
  db.prepare('DELETE FROM gasto_lineas WHERE gasto_id = ?').run([gastoId]);
  lineas.forEach((l, i) => {
    db.prepare(`
      INSERT INTO gasto_lineas (gasto_id, orden, codigo, concepto, cantidad, precio_unitario, base_imponible, iva_pct, descuento_tipo, descuento_valor, diana_pct, notas)
      VALUES (:gid, :orden, :codigo, :concepto, :cant, :precio, :base, :iva, :dtipo, :dvalor, :diana, :notas)
    `).run({
      ':gid': gastoId, ':orden': i,
      ':codigo': l.codigo || null, ':concepto': l.concepto ?? null,
      ':cant': Number(l.cantidad) > 0 ? Number(l.cantidad) : 1,
      ':precio': Number(l.precio_unitario) || 0,
      ':base': round2(l.base_imponible), ':iva': Number(l.iva_pct) || 0,
      ':dtipo': l.descuento_tipo === 'eur' ? 'eur' : 'pct',
      ':dvalor': Number(l.descuento_valor) || 0,
      ':diana': normalizeDianaPct(l.diana_pct),
      ':notas': l.notas ?? null,
    });
  });
}

export function gastosList({ anio, trimestre, desde, hasta, proveedorId } = {}) {
  const db = getDb();
  const sc = empresaScope('g');
  const baseCols = `g.*,
    COALESCE((SELECT SUM(importe) FROM pagos_gasto WHERE gasto_id = g.id), 0) AS pagado_total`;
  let periodSql = '';
  const periodParams = [];
  if (desde && hasta) {
    periodSql = ' AND g.fecha >= ? AND g.fecha < ?';
    periodParams.push(desde, hasta);
  } else if (anio && trimestre) {
    const startMonth = (Number(trimestre) - 1) * 3 + 1;
    const endMonth = Number(trimestre) * 3;
    const startDate = `${anio}-${String(startMonth).padStart(2, '0')}-01`;
    const nextTrim = Number(trimestre) === 4
      ? `${Number(anio) + 1}-01-01`
      : `${anio}-${String(endMonth + 1).padStart(2, '0')}-01`;
    periodSql = ' AND g.fecha >= ? AND g.fecha < ?';
    periodParams.push(startDate, nextTrim);
  } else if (anio) {
    periodSql = ' AND g.fecha >= ? AND g.fecha < ?';
    periodParams.push(`${anio}-01-01`, `${Number(anio) + 1}-01-01`);
  }
  let provSql = '';
  const provParams = [];
  if (proveedorId) {
    const pv = _proveedoresGet(Number(proveedorId));
    provSql = ' AND (g.proveedor_id = ? OR g.proveedor = ?)';
    provParams.push(Number(proveedorId), pv?.nombre ?? '');
  }
  return db.prepare(`
    SELECT ${baseCols} FROM gastos g
    WHERE g.deleted_at IS NULL${periodSql}${provSql}${sc.sql}
    ORDER BY g.fecha DESC, g.id DESC
  `).all([...periodParams, ...provParams, ...sc.params]);
}

export function gastosGet(id) {
  const db = getDb();
  const g = db.prepare('SELECT * FROM gastos WHERE id = ?').get([id]);
  if (!g) return null;
  const lineas = db.prepare(
    'SELECT * FROM gasto_lineas WHERE gasto_id = ? ORDER BY orden ASC, id ASC',
  ).all([id]);
  g.lineas = lineas.length > 0 ? lineas : [{
    id: null, gasto_id: id, orden: 0,
    codigo: g.producto_codigo || null, concepto: g.concepto || null,
    base_imponible: g.base_imponible || 0, iva_pct: g.iva_pct || 0,
    descuento_tipo: 'pct', descuento_valor: 0, diana_pct: 0,
  }];
  const pagos = db.prepare(
    'SELECT * FROM pagos_gasto WHERE gasto_id = ? ORDER BY fecha ASC, id ASC',
  ).all([id]);
  g.pagos = pagos;
  g.pagado_total = round2(pagos.reduce((s, p) => s + (Number(p.importe) || 0), 0));
  g.vencimientos = db.prepare(
    'SELECT * FROM gastos_vencimientos WHERE gasto_id = ? ORDER BY fecha ASC, id ASC',
  ).all([id]);
  return g;
}

export function gastosCreate(data) {
  const db = getDb();
  const { base, ivaPct, iva, irpfPct, irpf, total, lineas } = _gastoRecalc(data || {});
  const conceptoCab = data?.concepto ?? (lineas[0]?.concepto ?? null);
  const codigoCab = data?.producto_codigo
    ? String(data.producto_codigo).trim() : (lineas[0]?.codigo || null);
  let proveedorTexto = data?.proveedor ?? null;
  if (data?.proveedor_id) {
    const pv = _proveedoresGet(Number(data.proveedor_id));
    if (pv?.nombre) proveedorTexto = pv.nombre;
  }
  const subtipo = data?.subtipo === 'abono' ? 'abono' : 'gasto';
  const info = db.prepare(`
    INSERT INTO gastos (
      empresa_id, fecha, fecha_vencimiento, proveedor, proveedor_id, concepto, categoria, numero_factura_proveedor,
      base_imponible, iva_pct, iva_importe, irpf_pct, irpf_importe,
      total, deducible, notas, marca_id, producto_codigo, subtipo,
      descuento_tipo, descuento_valor
    ) VALUES (
      :empresa_id, :fecha, :fecha_venc, :proveedor, :proveedor_id, :concepto, :categoria, :nfp,
      :base, :iva_pct, :iva_importe, :irpf_pct, :irpf_importe,
      :total, :deducible, :notas, :marca_id, :producto_codigo, :subtipo,
      :dtipo, :dvalor
    )
  `).run({
    ':empresa_id': empresaActivaId(),
    ':fecha': data?.fecha || new Date().toISOString().slice(0, 10),
    ':fecha_venc': data?.fecha_vencimiento || null,
    ':proveedor': proveedorTexto,
    ':proveedor_id': data?.proveedor_id ? Number(data.proveedor_id) : null,
    ':concepto': conceptoCab, ':categoria': data?.categoria ?? null,
    ':nfp': data?.numero_factura_proveedor ? String(data.numero_factura_proveedor).trim() : null,
    ':base': base, ':iva_pct': ivaPct, ':iva_importe': iva,
    ':irpf_pct': irpfPct, ':irpf_importe': irpf,
    ':total': total,
    ':deducible': data?.deducible == null ? 1 : (data.deducible ? 1 : 0),
    ':notas': data?.notas ?? null,
    ':marca_id': data?.marca_id ? Number(data.marca_id) : null,
    ':producto_codigo': codigoCab, ':subtipo': subtipo,
    ':dtipo': data?.descuento_tipo === 'eur' ? 'eur' : 'pct',
    ':dvalor': Number(data?.descuento_valor) || 0,
  });
  _gastoLineasReplace(info.lastInsertRowid, lineas);
  return gastosGet(info.lastInsertRowid);
}

export function gastosUpdate(id, data) {
  const db = getDb();
  const current = gastosGet(id);
  if (!current) return null;
  const m = { ...current, ...data };
  const { base, ivaPct, iva, irpfPct, irpf, total, lineas } = _gastoRecalc(m);
  const conceptoCab = (data?.concepto ?? m.concepto) ?? (lineas[0]?.concepto ?? null);
  const codigoCab = (data?.producto_codigo ?? m.producto_codigo)
    ? String(data?.producto_codigo ?? m.producto_codigo).trim()
    : (lineas[0]?.codigo || null);
  let proveedorTexto = m.proveedor ?? null;
  if (m.proveedor_id) {
    const pv = _proveedoresGet(Number(m.proveedor_id));
    if (pv?.nombre) proveedorTexto = pv.nombre;
  }
  const subtipo = m.subtipo === 'abono' ? 'abono' : 'gasto';
  db.prepare(`
    UPDATE gastos SET fecha = :fecha, fecha_vencimiento = :fecha_venc,
      proveedor = :proveedor, proveedor_id = :proveedor_id, concepto = :concepto,
      categoria = :categoria, numero_factura_proveedor = :nfp,
      base_imponible = :base, iva_pct = :iva_pct, iva_importe = :iva_importe,
      irpf_pct = :irpf_pct, irpf_importe = :irpf_importe, total = :total,
      deducible = :deducible, notas = :notas, marca_id = :marca_id,
      producto_codigo = :producto_codigo, subtipo = :subtipo,
      descuento_tipo = :dtipo, descuento_valor = :dvalor,
      updated_at = datetime('now') WHERE id = :id
  `).run({
    ':id': id, ':fecha': m.fecha, ':fecha_venc': m.fecha_vencimiento || null,
    ':proveedor': proveedorTexto,
    ':proveedor_id': m.proveedor_id ? Number(m.proveedor_id) : null,
    ':concepto': conceptoCab, ':categoria': m.categoria ?? null,
    ':nfp': m.numero_factura_proveedor ? String(m.numero_factura_proveedor).trim() : null,
    ':base': base, ':iva_pct': ivaPct, ':iva_importe': iva,
    ':irpf_pct': irpfPct, ':irpf_importe': irpf, ':total': total,
    ':deducible': m.deducible ? 1 : 0, ':notas': m.notas ?? null,
    ':marca_id': m.marca_id ? Number(m.marca_id) : null,
    ':producto_codigo': codigoCab, ':subtipo': subtipo,
    ':dtipo': m.descuento_tipo === 'eur' ? 'eur' : 'pct',
    ':dvalor': Number(m.descuento_valor) || 0,
  });
  _gastoLineasReplace(id, lineas);
  return gastosGet(id);
}

export function gastosDelete(id) {
  const db = getDb();
  const info = db.prepare(
    "UPDATE gastos SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
  ).run([id]);
  return { ok: info.changes > 0 };
}

// --- Pagos a gastos ---

export function pagosGastoList(gasto_id) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM pagos_gasto WHERE gasto_id = ? ORDER BY fecha ASC, id ASC',
  ).all([gasto_id]);
}

export function pagosGastoCreate(gasto_id, data) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO pagos_gasto (gasto_id, fecha, importe, metodo, notas, vencimiento_id)
    VALUES (:gid, :fecha, :importe, :metodo, :notas, :venc)
  `).run({
    ':gid': gasto_id,
    ':fecha': data?.fecha || new Date().toISOString().slice(0, 10),
    ':importe': round2(data?.importe ?? 0),
    ':metodo': data?.metodo ?? null, ':notas': data?.notas ?? null,
    ':venc': data?.vencimiento_id ? Number(data.vencimiento_id) : null,
  });
  return db.prepare('SELECT * FROM pagos_gasto WHERE id = ?').get([info.lastInsertRowid]);
}

export function pagosGastoUpdate(id, data) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM pagos_gasto WHERE id = ?').get([id]);
  if (!current) return null;
  const m = { ...current, ...data };
  db.prepare(`
    UPDATE pagos_gasto SET fecha = :fecha, importe = :importe,
      metodo = :metodo, notas = :notas, vencimiento_id = :venc WHERE id = :id
  `).run({
    ':id': id, ':fecha': m.fecha, ':importe': round2(m.importe ?? 0),
    ':metodo': m.metodo ?? null, ':notas': m.notas ?? null,
    ':venc': m.vencimiento_id ? Number(m.vencimiento_id) : null,
  });
  return db.prepare('SELECT * FROM pagos_gasto WHERE id = ?').get([id]);
}

export function pagosGastoDelete(id) {
  const db = getDb();
  db.prepare('DELETE FROM pagos_gasto WHERE id = ?').run([id]);
  return { ok: true };
}

// --- Vencimientos ---

export function gastosVencimientosList(gasto_id) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM gastos_vencimientos WHERE gasto_id = ? ORDER BY fecha ASC, id ASC',
  ).all([gasto_id]);
}

export function gastosVencimientosCreate(gasto_id, data) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO gastos_vencimientos (gasto_id, fecha, importe, notas)
    VALUES (:gid, :fecha, :importe, :notas)
  `).run({
    ':gid': gasto_id,
    ':fecha': data?.fecha || new Date().toISOString().slice(0, 10),
    ':importe': round2(data?.importe ?? 0),
    ':notas': data?.notas ?? null,
  });
  return db.prepare('SELECT * FROM gastos_vencimientos WHERE id = ?').get([info.lastInsertRowid]);
}

export function gastosVencimientosUpdate(id, data) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM gastos_vencimientos WHERE id = ?').get([id]);
  if (!current) return null;
  const m = { ...current, ...data };
  db.prepare(`
    UPDATE gastos_vencimientos SET fecha = :fecha, importe = :importe,
      notas = :notas WHERE id = :id
  `).run({
    ':id': id, ':fecha': m.fecha, ':importe': round2(m.importe ?? 0),
    ':notas': m.notas ?? null,
  });
  return db.prepare('SELECT * FROM gastos_vencimientos WHERE id = ?').get([id]);
}

export function gastosVencimientosDelete(id) {
  const db = getDb();
  db.prepare('DELETE FROM gastos_vencimientos WHERE id = ?').run([id]);
  return { ok: true };
}
