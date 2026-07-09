// Puerto browser de home_*, fiscal_*, search_global, informes_*, diana_*.
// Notif y recurrencias van en stubs sencillos (raramente son crítica para demo).

import { getDb } from '../db.js';
import { empresaActivaId, empresaScope, round2 } from '../helpers.js';

// --- Home ---

export function homeDashboard() {
  const db = getDb();
  const meses = [];
  const today = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    meses.push({ ym: `${yyyy}-${mm}`, total: 0, count: 0 });
  }
  const sc = empresaScope();
  const ingresosRows = db.prepare(`
    SELECT substr(fecha, 1, 7) AS ym,
           COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
    FROM facturas
    WHERE deleted_at IS NULL AND estado IN ('emitida','cobrada')
      AND fecha >= ?${sc.sql}
    GROUP BY ym ORDER BY ym ASC
  `).all([meses[0].ym + '-01', ...sc.params]);
  for (const row of ingresosRows) {
    const m = meses.find((x) => x.ym === row.ym);
    if (m) { m.total = Number(row.total) || 0; m.count = row.count; }
  }

  const scF = empresaScope('f');
  const topClientes = db.prepare(`
    SELECT c.id, c.nombre, COALESCE(SUM(f.total), 0) AS total, COUNT(f.id) AS facturas
    FROM clientes c
    JOIN facturas f ON f.cliente_id = c.id
    WHERE c.deleted_at IS NULL AND f.deleted_at IS NULL
      AND f.estado IN ('emitida','cobrada')${scF.sql}
    GROUP BY c.id ORDER BY total DESC LIMIT 5
  `).all(scF.params);

  const yyyy = today.getFullYear();
  const estadosRows = db.prepare(`
    SELECT estado, COUNT(*) AS count, COALESCE(SUM(total), 0) AS suma
    FROM facturas
    WHERE deleted_at IS NULL AND substr(fecha, 1, 4) = ?${sc.sql}
    GROUP BY estado
  `).all([String(yyyy), ...sc.params]);
  const estados = { borrador: 0, emitida: 0, cobrada: 0 };
  const estadosSuma = { borrador: 0, emitida: 0, cobrada: 0 };
  for (const r of estadosRows) {
    if (r.estado in estados) {
      estados[r.estado] = r.count;
      estadosSuma[r.estado] = Number(r.suma) || 0;
    }
  }
  return {
    ingresos_mensuales: meses,
    top_clientes: topClientes.map((c) => ({
      id: c.id, nombre: c.nombre,
      total: Number(c.total) || 0, facturas: c.facturas,
    })),
    estados_facturas: { count: estados, suma: estadosSuma, anio: yyyy },
  };
}

export function homeStats() {
  const db = getDb();
  const sc = empresaScope();
  const presupuestosMes = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS suma
    FROM presupuestos WHERE deleted_at IS NULL
      AND fecha >= date('now', 'start of month')
      AND fecha < date('now', 'start of month', '+1 month')${sc.sql}
  `).get(sc.params);
  const facturasAnio = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS suma
    FROM facturas WHERE deleted_at IS NULL AND estado IN ('emitida','cobrada')
      AND fecha >= date('now', 'start of year')${sc.sql}
  `).get(sc.params);
  const facturasPendientes = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS suma
    FROM facturas WHERE deleted_at IS NULL AND estado = 'emitida'${sc.sql}
  `).get(sc.params);
  const VENCIDAS_DIAS = 30;
  const facturasVencidas = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS suma
    FROM facturas WHERE deleted_at IS NULL AND estado = 'emitida'
      AND fecha < date('now', '-${VENCIDAS_DIAS} days')${sc.sql}
  `).get(sc.params);
  const facturadoAnio = db.prepare(`
    SELECT COALESCE(SUM(total), 0) AS suma FROM facturas
    WHERE deleted_at IS NULL AND estado IN ('emitida','cobrada')
      AND fecha >= date('now', 'start of year')${sc.sql}
  `).get(sc.params);
  const totalClientes = db.prepare(`
    SELECT COUNT(*) AS count FROM clientes WHERE deleted_at IS NULL${sc.sql}
  `).get(sc.params);
  return {
    presupuestos_mes: presupuestosMes,
    facturas_anio: facturasAnio,
    facturas_pendientes: facturasPendientes,
    facturas_vencidas: { ...facturasVencidas, dias: VENCIDAS_DIAS },
    facturado_anio: facturadoAnio.suma,
    total_clientes: totalClientes.count,
  };
}

export function homeRecientes(limit = 5) {
  const db = getDb();
  const scP = empresaScope('p');
  const scF = empresaScope('f');
  return db.prepare(`
    SELECT * FROM (
      SELECT 'presupuesto' AS tipo, p.id, p.numero, p.fecha, p.total, p.estado,
             p.created_at, c.nombre AS cliente_nombre, p.asunto
        FROM presupuestos p LEFT JOIN clientes c ON c.id = p.cliente_id
        WHERE p.deleted_at IS NULL${scP.sql}
      UNION ALL
      SELECT 'factura' AS tipo, f.id, f.numero, f.fecha, f.total, f.estado,
             f.created_at, c.nombre AS cliente_nombre, NULL AS asunto
        FROM facturas f LEFT JOIN clientes c ON c.id = f.cliente_id
        WHERE f.deleted_at IS NULL${scF.sql}
    ) ORDER BY created_at DESC LIMIT ?
  `).all([...scP.params, ...scF.params, limit]);
}

export function homeInforme({ desde, hasta }) {
  const db = getDb();
  if (!desde || !hasta) throw new Error('Rango de fechas obligatorio');
  const sc = empresaScope('f');
  const scG = empresaScope();
  const facturas = db.prepare(`
    SELECT f.id, f.numero, f.fecha, f.cliente_id, f.estado,
           f.base_imponible, f.iva_importe, f.total, c.nombre AS cliente_nombre
    FROM facturas f LEFT JOIN clientes c ON c.id = f.cliente_id
    WHERE f.deleted_at IS NULL AND f.fecha BETWEEN ? AND ?
      AND f.estado IN ('emitida','cobrada')${sc.sql}
    ORDER BY f.fecha ASC, f.numero ASC
  `).all([desde, hasta, ...sc.params]);
  const totalBase = facturas.reduce((s, f) => s + (f.base_imponible || 0), 0);
  const totalIva  = facturas.reduce((s, f) => s + (f.iva_importe || 0), 0);
  const total     = facturas.reduce((s, f) => s + (f.total || 0), 0);
  const cobrado   = facturas.filter((f) => f.estado === 'cobrada')
    .reduce((s, f) => s + (f.total || 0), 0);
  const pendiente = total - cobrado;
  const meses = new Map();
  for (const f of facturas) {
    const ym = f.fecha.slice(0, 7);
    const cur = meses.get(ym) || { ym, total: 0, count: 0 };
    cur.total += f.total || 0; cur.count += 1;
    meses.set(ym, cur);
  }
  const start = new Date(`${desde}T00:00:00`);
  const end = new Date(`${hasta}T00:00:00`);
  const mensual = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const ym = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    mensual.push(meses.get(ym) || { ym, total: 0, count: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const porCliente = new Map();
  for (const f of facturas) {
    if (!f.cliente_id) continue;
    const cur = porCliente.get(f.cliente_id) || {
      id: f.cliente_id, nombre: f.cliente_nombre || '—', total: 0, facturas: 0,
    };
    cur.total += f.total || 0;
    cur.facturas += 1;
    porCliente.set(f.cliente_id, cur);
  }
  const topClientes = Array.from(porCliente.values())
    .sort((a, b) => b.total - a.total).slice(0, 5);
  const gastosRow = db.prepare(`
    SELECT COALESCE(SUM(base_imponible), 0) AS base,
           COALESCE(SUM(iva_importe), 0) AS iva,
           COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
    FROM gastos WHERE deleted_at IS NULL AND deducible = 1
      AND fecha BETWEEN ? AND ?${scG.sql}
  `).get([desde, hasta, ...scG.params]);
  return {
    rango: { desde, hasta },
    agregados: {
      base: totalBase, iva: totalIva, total, cobrado, pendiente,
      n_facturas: facturas.length,
      gastos_base: Number(gastosRow.base) || 0,
      gastos_iva: Number(gastosRow.iva) || 0,
      gastos_total: Number(gastosRow.total) || 0,
      n_gastos: gastosRow.count || 0,
      beneficio_estimado: totalBase - (Number(gastosRow.base) || 0),
    },
    mensual, top_clientes: topClientes,
    facturas: facturas.map((f) => ({
      id: f.id, numero: f.numero, fecha: f.fecha,
      cliente: f.cliente_nombre || '—', total: f.total || 0, estado: f.estado,
    })),
  };
}

// --- Fiscal ---

export function fiscalResumen({ anio, trimestre, desde, hasta } = {}) {
  const db = getDb();
  const now = new Date();
  const y = Number(anio) || now.getFullYear();
  const t = Number(trimestre) || (Math.floor(now.getMonth() / 3) + 1);
  let startDate, nextTrim, customPeriodo = false;
  if (desde && hasta) {
    startDate = desde;
    const d = new Date(`${hasta}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    nextTrim = d.toISOString().slice(0, 10);
    customPeriodo = true;
  } else {
    const startMonth = (t - 1) * 3 + 1;
    const endMonth = t * 3;
    startDate = `${y}-${String(startMonth).padStart(2, '0')}-01`;
    nextTrim = t === 4 ? `${y + 1}-01-01` : `${y}-${String(endMonth + 1).padStart(2, '0')}-01`;
  }
  const sc = empresaScope();
  const row = db.prepare(`
    SELECT COUNT(*) AS num_facturas,
      COALESCE(SUM(base_imponible), 0) AS base,
      COALESCE(SUM(iva_importe), 0) AS iva,
      COALESCE(SUM(base_imponible * COALESCE(irpf_pct, 0) / 100.0), 0) AS irpf,
      COALESCE(SUM(total), 0) AS total
    FROM facturas
    WHERE deleted_at IS NULL AND estado IN ('emitida','cobrada')
      AND (subtipo IS NULL OR subtipo IN ('factura','rectificativa','nota_contado'))
      AND fecha >= ? AND fecha < ?${sc.sql}
  `).get([startDate, nextTrim, ...sc.params]);
  const gastosRow = db.prepare(`
    SELECT COUNT(*) AS num_gastos,
      COALESCE(SUM(base_imponible), 0) AS base,
      COALESCE(SUM(iva_importe), 0) AS iva,
      COALESCE(SUM(total), 0) AS total
    FROM gastos WHERE deleted_at IS NULL AND deducible = 1
      AND fecha >= ? AND fecha < ?${sc.sql}
  `).get([startDate, nextTrim, ...sc.params]);
  const base = round2(row.base), iva = round2(row.iva);
  const irpfRetenido = round2(row.irpf), total = round2(row.total);
  const gastosBase = round2(gastosRow.base), gastosIva = round2(gastosRow.iva);
  const gastosTotal = round2(gastosRow.total);
  const baseAjustada = Math.max(0, base - gastosBase);
  const modelo130 = round2(Math.max(0, baseAjustada * 0.20 - irpfRetenido));
  const modelo303 = round2(iva - gastosIva);
  return {
    anio: y, trimestre: t, desde: startDate, hasta: nextTrim,
    custom_periodo: customPeriodo,
    num_facturas: row.num_facturas,
    base_imponible: base, iva_repercutido: iva,
    irpf_retenido: irpfRetenido, total_facturado: total,
    num_gastos: gastosRow.num_gastos,
    gastos_base: gastosBase, gastos_iva: gastosIva, gastos_total: gastosTotal,
    base_ajustada: round2(baseAjustada),
    modelo_130_estimado: modelo130, modelo_303_estimado: modelo303,
  };
}

export function fiscalDetalle({ anio, trimestre, desde, hasta, tipo } = {}) {
  const db = getDb();
  const now = new Date();
  const y = Number(anio) || now.getFullYear();
  const t = Number(trimestre) || (Math.floor(now.getMonth() / 3) + 1);
  let startDate, nextTrim;
  if (desde && hasta) {
    startDate = desde;
    const d = new Date(`${hasta}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    nextTrim = d.toISOString().slice(0, 10);
  } else {
    const startMonth = (t - 1) * 3 + 1;
    const endMonth = t * 3;
    startDate = `${y}-${String(startMonth).padStart(2, '0')}-01`;
    nextTrim = t === 4 ? `${y + 1}-01-01` : `${y}-${String(endMonth + 1).padStart(2, '0')}-01`;
  }
  const sc = empresaScope();
  if (tipo === 'gastos') {
    return db.prepare(`
      SELECT g.id, g.fecha, g.proveedor, g.concepto, g.categoria,
             g.base_imponible, g.iva_importe, g.total
      FROM gastos g WHERE deleted_at IS NULL AND deducible = 1
        AND fecha >= ? AND fecha < ?${sc.sql}
      ORDER BY fecha DESC, id DESC
    `).all([startDate, nextTrim, ...sc.params]);
  }
  const sc2 = empresaScope('f');
  return db.prepare(`
    SELECT f.id, f.numero, f.fecha, f.cliente_id, f.subtipo,
           c.nombre AS cliente_nombre,
           f.base_imponible, f.iva_importe,
           COALESCE(f.base_imponible * COALESCE(f.irpf_pct, 0) / 100.0, 0) AS irpf_importe,
           f.total, f.estado
    FROM facturas f LEFT JOIN clientes c ON c.id = f.cliente_id
    WHERE f.deleted_at IS NULL AND f.estado IN ('emitida','cobrada')
      AND (f.subtipo IS NULL OR f.subtipo IN ('factura','rectificativa','nota_contado'))
      AND f.fecha >= ? AND f.fecha < ?${sc2.sql}
    ORDER BY f.fecha DESC, f.numero DESC
  `).all([startDate, nextTrim, ...sc2.params]);
}

// --- Search global ---

export function searchGlobal(query) {
  const db = getDb();
  const q = String(query || '').trim();
  if (q.length < 2) return { factura_ids: [], presupuesto_ids: [] };
  const like = `%${q.replace(/[%_]/g, (m) => '\\' + m)}%`;
  const facturasFromLineas = db.prepare(`
    SELECT DISTINCT f.id FROM facturas f
    JOIN lineas_factura l ON l.factura_id = f.id
    WHERE f.deleted_at IS NULL
      AND (LOWER(l.titulo) LIKE LOWER(?) ESCAPE '\\'
        OR LOWER(l.descripcion) LIKE LOWER(?) ESCAPE '\\')
  `).all([like, like]).map((r) => r.id);
  const facturasFromNotas = db.prepare(`
    SELECT id FROM facturas WHERE deleted_at IS NULL
      AND LOWER(notas) LIKE LOWER(?) ESCAPE '\\'
  `).all([like]).map((r) => r.id);
  const presFromLineas = db.prepare(`
    SELECT DISTINCT p.id FROM presupuestos p
    JOIN lineas_presupuesto l ON l.presupuesto_id = p.id
    WHERE p.deleted_at IS NULL
      AND (LOWER(l.titulo) LIKE LOWER(?) ESCAPE '\\'
        OR LOWER(l.descripcion) LIKE LOWER(?) ESCAPE '\\')
  `).all([like, like]).map((r) => r.id);
  const presFromNotas = db.prepare(`
    SELECT id FROM presupuestos WHERE deleted_at IS NULL
      AND LOWER(notas) LIKE LOWER(?) ESCAPE '\\'
  `).all([like]).map((r) => r.id);
  return {
    factura_ids: Array.from(new Set([...facturasFromLineas, ...facturasFromNotas])),
    presupuesto_ids: Array.from(new Set([...presFromLineas, ...presFromNotas])),
  };
}

// --- Diana (versión simplificada para demo) ---

export function dianaSaldoInicialGet() {
  const db = getDb();
  const empId = empresaActivaId();
  const r = db.prepare('SELECT diana_saldo_inicial FROM empresas WHERE id = ?').get([empId]);
  return Number(r?.diana_saldo_inicial) || 0;
}

export function dianaSaldoInicialSet(valor) {
  const db = getDb();
  const empId = empresaActivaId();
  db.prepare('UPDATE empresas SET diana_saldo_inicial = ? WHERE id = ?')
    .run([Number(valor) || 0, empId]);
  return { ok: true, valor: Number(valor) || 0 };
}

export function pagosDianaList({ desde, hasta } = {}) {
  const db = getDb();
  const sc = empresaScope();
  let periodSql = '', periodParams = [];
  if (desde && hasta) {
    periodSql = ' AND fecha >= ? AND fecha <= ?';
    periodParams = [desde, hasta];
  }
  return db.prepare(`
    SELECT * FROM pagos_diana WHERE 1=1${sc.sql}${periodSql}
    ORDER BY fecha DESC, id DESC
  `).all([...sc.params, ...periodParams]);
}

export function pagosDianaCreate(data) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO pagos_diana (empresa_id, fecha, importe, notas, gasto_id)
    VALUES (:eid, :fecha, :importe, :notas, :gid)
  `).run({
    ':eid': empresaActivaId(),
    ':fecha': data?.fecha || new Date().toISOString().slice(0, 10),
    ':importe': round2(data?.importe),
    ':notas': data?.notas || null,
    ':gid': data?.gasto_id ? Number(data.gasto_id) : null,
  });
  return db.prepare('SELECT * FROM pagos_diana WHERE id = ?').get([info.lastInsertRowid]);
}

export function pagosDianaUpdate(id, data) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM pagos_diana WHERE id = ?').get([id]);
  if (!current) return null;
  const m = { ...current, ...data };
  db.prepare(`
    UPDATE pagos_diana SET fecha = :fecha, importe = :importe,
      notas = :notas, gasto_id = :gid WHERE id = :id
  `).run({
    ':id': id, ':fecha': m.fecha, ':importe': round2(m.importe),
    ':notas': m.notas || null,
    ':gid': m.gasto_id ? Number(m.gasto_id) : null,
  });
  return db.prepare('SELECT * FROM pagos_diana WHERE id = ?').get([id]);
}

export function pagosDianaDelete(id) {
  const db = getDb();
  db.prepare('DELETE FROM pagos_diana WHERE id = ?').run([id]);
  return { ok: true };
}

export function dianaAjustesList({ desde, hasta } = {}) {
  const db = getDb();
  const sc = empresaScope();
  let periodSql = '', periodParams = [];
  if (desde && hasta) {
    periodSql = ' AND fecha >= ? AND fecha <= ?';
    periodParams = [desde, hasta];
  }
  return db.prepare(`
    SELECT * FROM diana_ajustes WHERE 1=1${sc.sql}${periodSql}
    ORDER BY fecha DESC, id DESC
  `).all([...sc.params, ...periodParams]);
}

export function dianaAjustesCreate(data) {
  const db = getDb();
  const quien = data?.quien === 'E' ? 'E' : 'D';
  const info = db.prepare(`
    INSERT INTO diana_ajustes (empresa_id, fecha, concepto, importe, quien)
    VALUES (:eid, :fecha, :concepto, :importe, :quien)
  `).run({
    ':eid': empresaActivaId(),
    ':fecha': data?.fecha || new Date().toISOString().slice(0, 10),
    ':concepto': (data?.concepto || '').trim(),
    ':importe': round2(data?.importe),
    ':quien': quien,
  });
  return db.prepare('SELECT * FROM diana_ajustes WHERE id = ?').get([info.lastInsertRowid]);
}

export function dianaAjustesUpdate(id, data) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM diana_ajustes WHERE id = ?').get([id]);
  if (!current) return null;
  const m = { ...current, ...data };
  db.prepare(`
    UPDATE diana_ajustes SET fecha = :fecha, concepto = :concepto,
      importe = :importe, quien = :quien WHERE id = :id
  `).run({
    ':id': id, ':fecha': m.fecha,
    ':concepto': (m.concepto || '').trim(),
    ':importe': round2(m.importe),
    ':quien': m.quien === 'E' ? 'E' : 'D',
  });
  return db.prepare('SELECT * FROM diana_ajustes WHERE id = ?').get([id]);
}

export function dianaAjustesDelete(id) {
  const db = getDb();
  db.prepare('DELETE FROM diana_ajustes WHERE id = ?').run([id]);
  return { ok: true };
}

export function dianaCierresList() {
  const db = getDb();
  const empId = empresaActivaId();
  return db.prepare(
    'SELECT * FROM diana_cierres WHERE empresa_id = ? ORDER BY fecha DESC, id DESC',
  ).all([empId]);
}

export function dianaCierresUltimo() {
  const db = getDb();
  const empId = empresaActivaId();
  return db.prepare(
    'SELECT * FROM diana_cierres WHERE empresa_id = ? ORDER BY fecha DESC, id DESC LIMIT 1',
  ).get([empId]) || null;
}

export function dianaCierresCreate(data) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO diana_cierres (empresa_id, fecha, saldo_al_cierre, notas)
    VALUES (:eid, :fecha, :saldo, :notas)
  `).run({
    ':eid': empresaActivaId(),
    ':fecha': data?.fecha || new Date().toISOString().slice(0, 10),
    ':saldo': round2(data?.saldo_al_cierre),
    ':notas': data?.notas || null,
  });
  return db.prepare('SELECT * FROM diana_cierres WHERE id = ?').get([info.lastInsertRowid]);
}

export function dianaCierresDelete(id) {
  const db = getDb();
  db.prepare('DELETE FROM diana_cierres WHERE id = ?').run([id]);
  return { ok: true };
}

// --- Informes marcas / diana (stubs para demo — la logica original es
// compleja y no es la parte mas visible del demo) ---

export function informesMarcas() {
  return [];
}

export function informesMarcasDetalle() {
  return { movimientos: [] };
}

export function informesDiana() {
  return { saldo: 0, ingresos: [], gastos: [], pagos: [], ajustes: [] };
}
