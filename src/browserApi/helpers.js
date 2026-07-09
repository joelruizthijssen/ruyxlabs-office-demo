// Helpers compartidos entre modulos de repository portados.
// Emula funciones de repository.cjs que dependian de la BD activa.

import { getDb } from './db.js';

export function empresaActivaId() {
  const db = getDb();
  const r = db.prepare('SELECT empresa_activa_id FROM settings WHERE id = 1').get();
  return Number(r?.empresa_activa_id) || 1;
}

export function vistaCombinada() {
  const db = getDb();
  const r = db.prepare('SELECT vista_combinada FROM settings WHERE id = 1').get();
  return !!r?.vista_combinada;
}

// Filtro de scope de empresa para queries SELECT. Si vista_combinada esta ON,
// devuelve sql vacio (todas las empresas). Sino, ` AND empresa_id = ?` con
// el id de la activa como parametro.
export function empresaScope(alias) {
  if (vistaCombinada()) return { sql: '', params: [] };
  const col = alias ? `${alias}.empresa_id` : 'empresa_id';
  return { sql: ` AND ${col} = ?`, params: [empresaActivaId()] };
}

// Series: convention JSON en settings.
const DEFAULT_SERIE = { id: 'A', label: 'General' };

export function parseSeriesList(json) {
  if (!json) return [DEFAULT_SERIE];
  try {
    const arr = typeof json === 'string' ? JSON.parse(json) : json;
    if (!Array.isArray(arr) || arr.length === 0) return [DEFAULT_SERIE];
    const clean = [];
    const seen = new Set();
    for (const s of arr) {
      const id = String(s?.id || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const label = String(s?.label || '').slice(0, 60).trim() || id;
      clean.push({ id, label });
    }
    if (!seen.has('A')) clean.unshift(DEFAULT_SERIE);
    return clean;
  } catch {
    return [DEFAULT_SERIE];
  }
}

// Layout membrete: JSON en settings. En demo web, sin membrete cargado, el
// parser sigue devolviendo defaults sensatos por si se usa la plantilla
// "Personalizada" con background transparente.
export const DEFAULT_MEMBRETE_LAYOUT = {
  margen_top: 130,
  margen_bottom: 100,
  margen_left: 50,
  margen_right: 50,
  incluye_emisor: false,
  incluye_logo: false,
  color_texto: '#1a1a1a',
};

export function parseMembreteLayout(json) {
  if (!json) return DEFAULT_MEMBRETE_LAYOUT;
  try {
    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    return { ...DEFAULT_MEMBRETE_LAYOUT, ...obj };
  } catch {
    return DEFAULT_MEMBRETE_LAYOUT;
  }
}

// Genera el siguiente año en curso (nuevo autonomo).
export function currentYear() {
  return new Date().getFullYear();
}

// Ejecuta un bloque de codigo dentro de una transaccion. Rollback en error.
export function transaction(fn) {
  const db = getDb();
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}

// Normaliza un id de serie a alfanumerico corto (max 5 chars) mayuscula.
export function normalizeSerie(serie) {
  return String(serie || 'A').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'A';
}

// Calcula max correlativo para (tabla, serie, anio) filtrado por empresa activa.
export function maxCorrelativoSerie(table, serie, anio) {
  const db = getDb();
  const s = normalizeSerie(serie);
  const prefix = s === 'A' ? '' : `${s}-`;
  const pattern = `${prefix}${anio}/%`;
  const empresaId = empresaActivaId();
  const rows = db.prepare(
    `SELECT numero FROM ${table} WHERE numero LIKE ? AND empresa_id = ?`,
  ).all([pattern, empresaId]);
  let max = 0;
  for (const r of rows) {
    const m = String(r.numero).match(/\/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

// Resuelve colision de numero: si `candidate` ya existe (en misma empresa),
// bumpea el correlativo /NN final hasta encontrar uno libre.
export function resolverColisionNumero(table, candidate, empresaId) {
  const db = getDb();
  const stmt = empresaId != null
    ? db.prepare(`SELECT 1 FROM ${table} WHERE numero = ? AND empresa_id = ? LIMIT 1`)
    : db.prepare(`SELECT 1 FROM ${table} WHERE numero = ? LIMIT 1`);
  try {
    let cur = candidate;
    let guard = 0;
    while (true) {
      const found = empresaId != null ? stmt.get([cur, empresaId]) : stmt.get([cur]);
      if (!found) break;
      const m = cur.match(/^(.*\/)(\d+)$/);
      if (!m) break;
      const next = Number(m[2]) + 1;
      const pad = Math.max(m[2].length, String(next).length);
      cur = `${m[1]}${String(next).padStart(pad, '0')}`;
      guard += 1;
      if (guard > 10000) break;
    }
    return cur;
  } finally {
    stmt.finalize();
  }
}

// Genera siguiente numero para serie no-A (o serie A con prefijo custom via subPrefix).
export function generarNumeroNoA(table, serie, anio) {
  const s = normalizeSerie(serie);
  const prefix = `${s}-`;
  const max = maxCorrelativoSerie(table, s, anio);
  const candidate = `${prefix}${anio}/${String(max + 1).padStart(2, '0')}`;
  return resolverColisionNumero(table, candidate, empresaActivaId());
}

// Genera numero para subtipos no-fiscales (proforma, nota de contado): prefijo
// custom no consume correlativo fiscal.
export function generarNumeroSubtipo(table, subPrefix, anio) {
  const db = getDb();
  const prefix = `${subPrefix}-`;
  const pattern = `${prefix}${anio}/%`;
  const empresaId = empresaActivaId();
  const rows = db.prepare(
    `SELECT numero FROM ${table} WHERE numero LIKE ? AND empresa_id = ?`,
  ).all([pattern, empresaId]);
  let max = 0;
  for (const r of rows) {
    const m = String(r.numero).match(/\/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const candidate = `${prefix}${anio}/${String(max + 1).padStart(2, '0')}`;
  return resolverColisionNumero(table, candidate, empresaId);
}

// Redondeo a 2 decimales (evita floats sucios en importes).
export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Calcula el importe del descuento dado (tipo, valor) sobre un bruto.
export function descuentoImporte(bruto, tipo, valor) {
  const v = Number(valor) || 0;
  if (v <= 0) return 0;
  if (tipo === 'eur') return Math.min(bruto, v);
  return round2(bruto * v / 100); // pct
}

// Tipo de recargo de equivalencia segun el IVA (regimen minorista).
export function reRate(ivaPct) {
  const p = Number(ivaPct) || 0;
  if (p >= 21) return 5.2;
  if (p >= 10) return 1.4;
  if (p > 0) return 0.5;
  return 0;
}
