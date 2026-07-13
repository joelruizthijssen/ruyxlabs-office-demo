// Puerto browser de las funciones de multi-socio (v1.5.0).
// Refleja la API que expone repository.cjs en el desktop pero sobre sql.js.

import { getDb } from '../db.js';
import { empresaActivaId, empresaScope, round2, descuentoImporte } from '../helpers.js';

function normalizeDianaPct(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  if (n < -100) return -100;
  if (n > 100) return 100;
  return round2(n);
}

// ---- CRUD socios ----
export function sociosList() {
  const db = getDb();
  const sc = empresaScope();
  return db.prepare(`
    SELECT * FROM empresa_socios
    WHERE deleted_at IS NULL${sc.sql}
    ORDER BY orden ASC, id ASC
  `).all(sc.params);
}
export function sociosGet(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM empresa_socios WHERE id = ?').get([Number(id)]) || null;
}
export function sociosCreate(data) {
  const db = getDb();
  const empId = empresaActivaId();
  const nombre = String(data?.nombre || '').trim();
  if (!nombre) return { error: 'Nombre requerido' };
  let orden = Number(data?.orden);
  if (!Number.isFinite(orden)) {
    const r = db.prepare(
      `SELECT COALESCE(MAX(orden), -1) + 1 AS o FROM empresa_socios
       WHERE empresa_id = ? AND deleted_at IS NULL`,
    ).get([empId]);
    orden = Number(r?.o) || 0;
  }
  const info = db.prepare(`
    INSERT INTO empresa_socios (empresa_id, nombre, orden, saldo_inicial, color, notas)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run([empId, nombre, orden, round2(Number(data?.saldo_inicial) || 0),
    data?.color || null, data?.notas || null]);
  return db.prepare('SELECT * FROM empresa_socios WHERE id = ?').get([info.lastInsertRowid]);
}
export function sociosUpdate(id, data) {
  const db = getDb();
  const current = sociosGet(id);
  if (!current) return null;
  const m = { ...current, ...data };
  const nombre = String(m.nombre || '').trim();
  if (!nombre) return { error: 'Nombre requerido' };
  db.prepare(`
    UPDATE empresa_socios
    SET nombre = ?, orden = ?, saldo_inicial = ?, color = ?, notas = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run([nombre,
    Number.isFinite(Number(m.orden)) ? Number(m.orden) : (current.orden || 0),
    round2(Number(m.saldo_inicial) || 0),
    m.color || null, m.notas || null, Number(id)]);
  return sociosGet(id);
}
export function sociosDelete(id) {
  const db = getDb();
  const info = db.prepare(
    `UPDATE empresa_socios SET deleted_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND deleted_at IS NULL`,
  ).run([Number(id)]);
  return { ok: info.changes > 0 };
}

// ---- pagos_socio ----
export function pagosSocioList({ socio_id, desde, hasta } = {}) {
  const db = getDb();
  const sc = empresaScope();
  let extraSql = '';
  const extra = [];
  if (socio_id != null) { extraSql += ' AND socio_id = ?'; extra.push(Number(socio_id)); }
  if (desde && hasta) { extraSql += ' AND fecha >= ? AND fecha <= ?'; extra.push(desde, hasta); }
  return db.prepare(`
    SELECT * FROM pagos_socio
    WHERE 1=1${extraSql}${sc.sql}
    ORDER BY fecha ASC, id ASC
  `).all([...extra, ...sc.params]);
}
export function pagosSocioCreate(data) {
  const db = getDb();
  if (!data?.socio_id) return { error: 'socio_id requerido' };
  const info = db.prepare(`
    INSERT INTO pagos_socio (empresa_id, socio_id, fecha, importe, notas, gasto_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run([empresaActivaId(), Number(data.socio_id),
    data?.fecha || new Date().toISOString().slice(0, 10),
    round2(data?.importe ?? 0), data?.notas ?? null,
    data?.gasto_id ? Number(data.gasto_id) : null]);
  return db.prepare('SELECT * FROM pagos_socio WHERE id = ?').get([info.lastInsertRowid]);
}
export function pagosSocioUpdate(id, data) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM pagos_socio WHERE id = ?').get([Number(id)]);
  if (!current) return null;
  const m = { ...current, ...data };
  db.prepare(`
    UPDATE pagos_socio SET fecha = ?, importe = ?, notas = ?, gasto_id = ?
    WHERE id = ?
  `).run([m.fecha, round2(m.importe ?? 0), m.notas ?? null,
    m.gasto_id ? Number(m.gasto_id) : null, Number(id)]);
  return db.prepare('SELECT * FROM pagos_socio WHERE id = ?').get([Number(id)]);
}
export function pagosSocioDelete(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM pagos_socio WHERE id = ?').run([Number(id)]);
  return { ok: info.changes > 0 };
}

// ---- socio_ajustes ----
export function socioAjustesList({ socio_id, desde, hasta } = {}) {
  const db = getDb();
  const sc = empresaScope();
  let extraSql = '';
  const extra = [];
  if (socio_id != null) { extraSql += ' AND socio_id = ?'; extra.push(Number(socio_id)); }
  if (desde && hasta) { extraSql += ' AND fecha >= ? AND fecha <= ?'; extra.push(desde, hasta); }
  return db.prepare(`
    SELECT * FROM socio_ajustes
    WHERE 1=1${extraSql}${sc.sql}
    ORDER BY fecha ASC, id ASC
  `).all([...extra, ...sc.params]);
}
export function socioAjustesCreate(data) {
  const db = getDb();
  if (!data?.socio_id) return { error: 'socio_id requerido' };
  const quien = data?.quien === 'U' ? 'U' : 'S';
  const importe = Math.abs(round2(Number(data?.importe) || 0));
  const info = db.prepare(`
    INSERT INTO socio_ajustes (empresa_id, socio_id, fecha, concepto, importe, quien)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run([empresaActivaId(), Number(data.socio_id),
    data?.fecha || new Date().toISOString().slice(0, 10),
    String(data?.concepto || '').trim(), importe, quien]);
  return db.prepare('SELECT * FROM socio_ajustes WHERE id = ?').get([info.lastInsertRowid]);
}
export function socioAjustesUpdate(id, data) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM socio_ajustes WHERE id = ?').get([Number(id)]);
  if (!current) return null;
  const m = { ...current, ...data };
  const quien = m.quien === 'U' ? 'U' : 'S';
  const importe = Math.abs(round2(Number(m.importe) || 0));
  db.prepare(`
    UPDATE socio_ajustes SET fecha = ?, concepto = ?, importe = ?, quien = ?
    WHERE id = ?
  `).run([m.fecha, String(m.concepto || '').trim(), importe, quien, Number(id)]);
  return db.prepare('SELECT * FROM socio_ajustes WHERE id = ?').get([Number(id)]);
}
export function socioAjustesDelete(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM socio_ajustes WHERE id = ?').run([Number(id)]);
  return { ok: info.changes > 0 };
}

// ---- socio_cierres ----
export function socioCierresList(socio_id) {
  const db = getDb();
  const sc = empresaScope();
  let extra = '';
  const params = [];
  if (socio_id != null) { extra = ' AND socio_id = ?'; params.push(Number(socio_id)); }
  return db.prepare(`
    SELECT * FROM socio_cierres WHERE 1=1${extra}${sc.sql}
    ORDER BY fecha DESC, id DESC
  `).all([...params, ...sc.params]);
}
export function socioCierresUltimo(socio_id) {
  const db = getDb();
  const sc = empresaScope();
  let extra = '';
  const params = [];
  if (socio_id != null) { extra = ' AND socio_id = ?'; params.push(Number(socio_id)); }
  return db.prepare(`
    SELECT * FROM socio_cierres WHERE 1=1${extra}${sc.sql}
    ORDER BY fecha DESC, id DESC LIMIT 1
  `).get([...params, ...sc.params]) || null;
}
export function socioCierresCreate(data) {
  const db = getDb();
  if (!data?.socio_id) return { error: 'socio_id requerido' };
  const fecha = data?.fecha || new Date().toISOString().slice(0, 10);
  let saldoAlCierre = 0;
  try {
    const r = informesSocio({ socio_id: data.socio_id, desde: '1900-01-01', hasta: fecha });
    saldoAlCierre = Number(r?.totales?.saldo_final) || 0;
  } catch { /* noop */ }
  const info = db.prepare(`
    INSERT INTO socio_cierres (empresa_id, socio_id, fecha, saldo_al_cierre, notas)
    VALUES (?, ?, ?, ?, ?)
  `).run([empresaActivaId(), Number(data.socio_id), fecha,
    round2(saldoAlCierre), data?.notas ?? null]);
  return db.prepare('SELECT * FROM socio_cierres WHERE id = ?').get([info.lastInsertRowid]);
}
export function socioCierresDelete(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM socio_cierres WHERE id = ?').run([Number(id)]);
  return { ok: info.changes > 0 };
}

// ---- setPct helpers ----
function isPrimerSocio(socioId) {
  const db = getDb();
  const socio = db.prepare(
    `SELECT id, empresa_id FROM empresa_socios WHERE id = ? AND deleted_at IS NULL`,
  ).get([Number(socioId)]);
  if (!socio) return false;
  const primero = db.prepare(
    `SELECT id FROM empresa_socios
     WHERE empresa_id = ? AND deleted_at IS NULL
     ORDER BY orden ASC, id ASC LIMIT 1`,
  ).get([socio.empresa_id]);
  return primero && Number(primero.id) === Number(socioId);
}
export function lineaFacturaSocioSetPct(lineaId, socioId, pct) {
  const db = getDb();
  const _linea = Number(lineaId);
  const _socio = Number(socioId);
  const _pct = normalizeDianaPct(pct);
  if (!_linea || !_socio) return { error: 'linea_id y socio_id requeridos' };
  if (_pct === 0) {
    db.prepare(`DELETE FROM linea_factura_socio WHERE linea_id = ? AND socio_id = ?`).run([_linea, _socio]);
  } else {
    db.prepare(`
      INSERT INTO linea_factura_socio (linea_id, socio_id, pct) VALUES (?, ?, ?)
      ON CONFLICT(linea_id, socio_id) DO UPDATE SET pct = excluded.pct
    `).run([_linea, _socio, _pct]);
  }
  if (isPrimerSocio(_socio)) {
    db.prepare(`UPDATE lineas_factura SET diana_pct = ? WHERE id = ?`).run([_pct, _linea]);
  }
  return { ok: true, pct: _pct };
}
export function gastoLineaSocioSetPct(lineaId, socioId, pct) {
  const db = getDb();
  const _linea = Number(lineaId);
  const _socio = Number(socioId);
  const _pct = normalizeDianaPct(pct);
  if (!_linea || !_socio) return { error: 'linea_id y socio_id requeridos' };
  if (_pct === 0) {
    db.prepare(`DELETE FROM gasto_linea_socio WHERE linea_id = ? AND socio_id = ?`).run([_linea, _socio]);
  } else {
    db.prepare(`
      INSERT INTO gasto_linea_socio (linea_id, socio_id, pct) VALUES (?, ?, ?)
      ON CONFLICT(linea_id, socio_id) DO UPDATE SET pct = excluded.pct
    `).run([_linea, _socio, _pct]);
  }
  if (isPrimerSocio(_socio)) {
    db.prepare(`UPDATE gasto_lineas SET diana_pct = ? WHERE id = ?`).run([_pct, _linea]);
  }
  return { ok: true, pct: _pct };
}
export function lineaFacturaSociosList(lineaId) {
  const db = getDb();
  return db.prepare(`
    SELECT lfs.socio_id, lfs.pct, es.nombre AS socio_nombre
    FROM linea_factura_socio lfs
    JOIN empresa_socios es ON es.id = lfs.socio_id
    WHERE lfs.linea_id = ?
    ORDER BY es.orden ASC, es.id ASC
  `).all([Number(lineaId)]);
}
export function gastoLineaSociosList(lineaId) {
  const db = getDb();
  return db.prepare(`
    SELECT gls.socio_id, gls.pct, es.nombre AS socio_nombre
    FROM gasto_linea_socio gls
    JOIN empresa_socios es ON es.id = gls.socio_id
    WHERE gls.linea_id = ?
    ORDER BY es.orden ASC, es.id ASC
  `).all([Number(lineaId)]);
}
export function lineaFacturaSociosByFactura(facturaId) {
  const db = getDb();
  return db.prepare(`
    SELECT lfs.linea_id, lfs.socio_id, lfs.pct, es.nombre AS socio_nombre
    FROM linea_factura_socio lfs
    JOIN empresa_socios es ON es.id = lfs.socio_id
    JOIN lineas_factura lf ON lf.id = lfs.linea_id
    WHERE lf.factura_id = ?
    ORDER BY lfs.linea_id ASC, es.orden ASC
  `).all([Number(facturaId)]);
}
export function gastoLineaSociosByGasto(gastoId) {
  const db = getDb();
  return db.prepare(`
    SELECT gls.linea_id, gls.socio_id, gls.pct, es.nombre AS socio_nombre
    FROM gasto_linea_socio gls
    JOIN empresa_socios es ON es.id = gls.socio_id
    JOIN gasto_lineas gl ON gl.id = gls.linea_id
    WHERE gl.gasto_id = ?
    ORDER BY gls.linea_id ASC, es.orden ASC
  `).all([Number(gastoId)]);
}

// ---- informes_socio (simplificado, misma logica que app) ----
export function informesSocio({ socio_id, desde, hasta } = {}) {
  if (!socio_id) return { error: 'socio_id requerido' };
  const db = getDb();
  const sc = empresaScope();
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, today.getMonth() + 1, 0).getDate();
  const desdeStr = desde || `${y}-${m}-01`;
  const hastaStr = hasta || `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  const hastaNext = (() => {
    const d = new Date(`${hastaStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const facturas = db.prepare(`
    SELECT f.id, f.numero, f.fecha, f.estado, f.cliente_id,
      f.descuento_tipo, f.descuento_valor,
      (SELECT nombre FROM clientes WHERE id = f.cliente_id) AS cliente_nombre,
      (SELECT COALESCE(SUM(c.importe),0) FROM cobros c WHERE c.factura_id = f.id) AS cobrado,
      (SELECT MAX(c.fecha) FROM cobros c WHERE c.factura_id = f.id) AS fecha_ultimo_cobro
    FROM facturas f
    WHERE f.deleted_at IS NULL
      AND (f.subtipo IS NULL OR f.subtipo IN ('factura', 'rectificativa', 'nota_contado'))
      ${sc.sql.replace(/empresa_id/g, 'f.empresa_id')}
  `).all(sc.params);
  const lineasStmt = db.prepare(`
    SELECT lf.id, lf.importe, lf.descuento_tipo, lf.descuento_valor, lf.descripcion,
      COALESCE(lfs.pct, 0) AS socio_pct
    FROM lineas_factura lf
    LEFT JOIN linea_factura_socio lfs
      ON lfs.linea_id = lf.id AND lfs.socio_id = ?
    WHERE lf.factura_id = ?
  `);
  const movs = [];
  const pendientes = [];
  for (const f of facturas) {
    const lineas = lineasStmt.all([Number(socio_id), f.id]);
    if (!lineas.some((l) => Number(l.socio_pct) !== 0)) continue;
    let subtotal = 0;
    const netas = lineas.map((l) => {
      const imp = Number(l.importe) || 0;
      const dl = descuentoImporte(imp, l.descuento_tipo, l.descuento_valor);
      const net = round2(imp - dl);
      subtotal += net;
      return { ...l, net };
    });
    subtotal = round2(subtotal);
    const descG = descuentoImporte(subtotal, f.descuento_tipo, f.descuento_valor);
    const factor = subtotal !== 0 ? Math.max(0, (subtotal - descG) / subtotal) : 1;
    let socioImp = 0;
    let baseLin = 0;
    for (const l of netas) {
      const bf = round2(l.net * factor);
      baseLin += bf;
      socioImp += round2(bf * Number(l.socio_pct || 0) / 100);
    }
    baseLin = round2(baseLin);
    socioImp = round2(socioImp);
    if (socioImp === 0) continue;
    const cobrada = (f.estado === 'cobrada') || (Number(f.cobrado) >= baseLin - 0.005 && baseLin > 0);
    if (!cobrada) {
      pendientes.push({ id: f.id, numero: f.numero, fecha: f.fecha,
        cliente_nombre: f.cliente_nombre || '',
        base_imponible: baseLin, cobrado: Number(f.cobrado) || 0,
        socio_importe: socioImp });
    }
    const fechaMov = cobrada && f.fecha_ultimo_cobro ? f.fecha_ultimo_cobro : f.fecha;
    if (fechaMov >= desdeStr && fechaMov < hastaNext) {
      movs.push({ tipo: 'venta', fecha: fechaMov, fecha_emision: f.fecha,
        ref_id: f.id, ref_numero: f.numero,
        concepto: f.cliente_nombre || '',
        base_imponible: baseLin, socio_importe: socioImp,
        realizado: !!cobrada, cobrado: Number(f.cobrado) || 0 });
    }
  }

  const gastos = db.prepare(`
    SELECT g.id, g.fecha, g.proveedor,
      g.descuento_tipo, g.descuento_valor
    FROM gastos g
    WHERE g.deleted_at IS NULL${sc.sql.replace(/empresa_id/g, 'g.empresa_id')}
  `).all(sc.params);
  const lineasGStmt = db.prepare(`
    SELECT gl.id, gl.base_imponible, gl.descuento_tipo, gl.descuento_valor,
      COALESCE(gls.pct, 0) AS socio_pct
    FROM gasto_lineas gl
    LEFT JOIN gasto_linea_socio gls
      ON gls.linea_id = gl.id AND gls.socio_id = ?
    WHERE gl.gasto_id = ?
  `);
  for (const g of gastos) {
    const lineas = lineasGStmt.all([Number(socio_id), g.id]);
    if (!lineas.some((l) => Number(l.socio_pct) !== 0)) continue;
    let subtotal = 0;
    const netas = lineas.map((l) => {
      const imp = Number(l.base_imponible) || 0;
      const dl = descuentoImporte(imp, l.descuento_tipo, l.descuento_valor);
      const net = round2(imp - dl);
      subtotal += net;
      return { ...l, net };
    });
    subtotal = round2(subtotal);
    const descG = descuentoImporte(subtotal, g.descuento_tipo, g.descuento_valor);
    const factor = subtotal !== 0 ? Math.max(0, (subtotal - descG) / subtotal) : 1;
    let socioImp = 0;
    let baseLin = 0;
    for (const l of netas) {
      const bf = round2(l.net * factor);
      baseLin += bf;
      socioImp += round2(bf * Number(l.socio_pct || 0) / 100);
    }
    if (socioImp === 0) continue;
    if (g.fecha >= desdeStr && g.fecha < hastaNext) {
      movs.push({ tipo: 'gasto', fecha: g.fecha, ref_id: g.id,
        concepto: g.proveedor || '',
        base_imponible: round2(baseLin), socio_importe: -round2(socioImp),
        realizado: true });
    }
  }

  const pagos = pagosSocioList({ socio_id, desde: desdeStr, hasta: hastaStr });
  for (const p of pagos) {
    movs.push({ tipo: 'pago_socio', fecha: p.fecha, ref_id: p.id,
      concepto: p.notas || 'Pago', base_imponible: 0,
      socio_importe: -(Number(p.importe) || 0),
      realizado: true, pago_id: p.id });
  }

  const ajustes = socioAjustesList({ socio_id, desde: desdeStr, hasta: hastaStr });
  for (const a of ajustes) {
    const imp = Math.abs(round2(Number(a.importe) || 0));
    const signed = a.quien === 'U' ? imp : -imp;
    movs.push({ tipo: 'movimiento', fecha: a.fecha, ref_id: a.id,
      concepto: a.concepto || '',
      base_imponible: imp, socio_importe: signed,
      realizado: true, quien: a.quien });
  }

  movs.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

  let ventasR = 0, comprasR = 0, pagosR = 0, ajustesR = 0;
  for (const m of movs) {
    if (m.tipo === 'venta') { if (m.realizado) ventasR += m.socio_importe; }
    else if (m.tipo === 'gasto') comprasR += m.socio_importe;
    else if (m.tipo === 'pago_socio') pagosR += -m.socio_importe;
    else if (m.tipo === 'movimiento') ajustesR += m.socio_importe;
  }
  const ventasPend = round2(pendientes.reduce((s, p) => s + (Number(p.socio_importe) || 0), 0));

  const socio = sociosGet(socio_id);
  const saldoInicial = Number(socio?.saldo_inicial) || 0;
  // Simplificacion: sin saldo arrastrado historico complicado. La demo web
  // no tiene datos previos suficientes para justificar esa complejidad.
  const saldoArrastrado = round2(saldoInicial);
  const saldoPeriodo = round2(ventasR + comprasR + ajustesR - pagosR);
  const saldoFinal = round2(saldoArrastrado + saldoPeriodo);

  return {
    socio_id: Number(socio_id),
    socio_nombre: socio?.nombre || '',
    desde: desdeStr, hasta: hastaStr,
    filas: movs.map((m) => ({
      ...m,
      base_imponible: round2(m.base_imponible),
      socio_importe: round2(m.socio_importe),
    })),
    pendientes: pendientes.map((p) => ({
      ...p,
      base_imponible: round2(p.base_imponible),
      cobrado: round2(p.cobrado),
      socio_importe: round2(p.socio_importe),
    })),
    totales: {
      ventas_realizado: round2(ventasR),
      ventas_pendiente: ventasPend,
      compras_realizado: round2(comprasR),
      pagos_realizados: round2(pagosR),
      ajustes_realizados: round2(ajustesR),
      saldo_arrastrado: saldoArrastrado,
      saldo_periodo: saldoPeriodo,
      saldo_final: saldoFinal,
    },
  };
}
