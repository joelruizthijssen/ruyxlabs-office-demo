// Puerto browser de cobros_* y hitos_pago_*.

import { getDb } from '../db.js';
import { round2 } from '../helpers.js';
import { recalcularTotalesFactura } from './documentos.js';

// --- Cobros ---

export function cobrosList(factura_id) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM cobros WHERE factura_id = ? ORDER BY fecha ASC, id ASC',
  ).all([factura_id]);
}

export function cobrosCreate(factura_id, data) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO cobros (factura_id, fecha, importe, metodo, notas, mostrar_en_pdf)
    VALUES (:fid, :fecha, :importe, :metodo, :notas, :mostrar)
  `).run({
    ':fid': factura_id,
    ':fecha': data?.fecha || new Date().toISOString().slice(0, 10),
    ':importe': round2(data?.importe),
    ':metodo': data?.metodo || null,
    ':notas': data?.notas || null,
    ':mostrar': data?.mostrar_en_pdf ? 1 : 0,
  });
  return db.prepare('SELECT * FROM cobros WHERE id = ?').get([info.lastInsertRowid]);
}

export function cobrosUpdate(id, data) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM cobros WHERE id = ?').get([id]);
  if (!current) return null;
  const m = { ...current, ...data };
  db.prepare(`
    UPDATE cobros SET fecha = :fecha, importe = :importe, metodo = :metodo,
      notas = :notas, mostrar_en_pdf = :mostrar WHERE id = :id
  `).run({
    ':id': id, ':fecha': m.fecha, ':importe': round2(m.importe),
    ':metodo': m.metodo || null, ':notas': m.notas || null,
    ':mostrar': m.mostrar_en_pdf ? 1 : 0,
  });
  return db.prepare('SELECT * FROM cobros WHERE id = ?').get([id]);
}

export function cobrosDelete(id) {
  const db = getDb();
  db.prepare('DELETE FROM cobros WHERE id = ?').run([id]);
  return { ok: true };
}

// --- Hitos de pago ---

export function hitosPagoList(presupuesto_id) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM hitos_pago WHERE presupuesto_id = ? ORDER BY orden ASC, id ASC',
  ).all([presupuesto_id]);
}

export function hitosPagoReplace(presupuesto_id, hitos) {
  const db = getDb();
  const arr = Array.isArray(hitos) ? hitos : [];
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM hitos_pago WHERE presupuesto_id = ?').run([presupuesto_id]);
    arr.forEach((h, i) => {
      db.prepare(`
        INSERT INTO hitos_pago (presupuesto_id, orden, descripcion, importe_pct,
          fecha_offset_dias, notas)
        VALUES (:pid, :orden, :desc, :pct, :off, :notas)
      `).run({
        ':pid': presupuesto_id, ':orden': i,
        ':desc': h?.descripcion || null,
        ':pct': Number(h?.importe_pct) || 0,
        ':off': Number(h?.fecha_offset_dias) || 0,
        ':notas': h?.notas || null,
      });
    });
    db.exec('COMMIT');
    return hitosPagoList(presupuesto_id);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
