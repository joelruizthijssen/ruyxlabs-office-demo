// Puerto browser de marcas_*. En web demo no hay filesystem para logos, asi
// que logo_path es una data URL (guardada como texto).

import { getDb } from '../db.js';
import { empresaActivaId } from '../helpers.js';

function _row(m) {
  return { ...m };
}

export function marcasList({ includeArchived } = {}) {
  const db = getDb();
  const empId = empresaActivaId();
  return db.prepare(
    `SELECT * FROM marcas
     WHERE empresa_id = ? ${includeArchived ? '' : 'AND archivada = 0'}
     ORDER BY nombre_comercial COLLATE NOCASE`,
  ).all([empId]).map(_row);
}

export function marcasGet(id) {
  const db = getDb();
  const m = db.prepare('SELECT * FROM marcas WHERE id = ?').get([id]);
  return m ? _row(m) : null;
}

export function marcasCreate(data) {
  const db = getDb();
  const empId = empresaActivaId();
  const info = db.prepare(`
    INSERT INTO marcas (empresa_id, nombre_comercial, prefijo, brand_color, incluir_en_informe)
    VALUES (:eid, :nombre, :prefijo, :color, :incluir)
  `).run({
    ':eid': empId,
    ':nombre': (data?.nombre_comercial || '').trim(),
    ':prefijo': data?.prefijo ? String(data.prefijo).toUpperCase().slice(0, 2) : null,
    ':color': data?.brand_color || null,
    ':incluir': data?.incluir_en_informe === 0 || data?.incluir_en_informe === false ? 0 : 1,
  });
  return marcasGet(info.lastInsertRowid);
}

export function marcasUpdate(id, data) {
  const db = getDb();
  const current = marcasGet(id);
  if (!current) return null;
  const m = { ...current, ...data };
  db.prepare(`
    UPDATE marcas SET nombre_comercial = :nombre, prefijo = :prefijo,
      brand_color = :color, incluir_en_informe = :incluir,
      actualizado_at = datetime('now') WHERE id = :id
  `).run({
    ':id': id,
    ':nombre': (m.nombre_comercial || '').trim(),
    ':prefijo': m.prefijo ? String(m.prefijo).toUpperCase().slice(0, 2) : null,
    ':color': m.brand_color || null,
    ':incluir': m.incluir_en_informe ? 1 : 0,
  });
  return marcasGet(id);
}

export function marcasDelete(id) {
  const db = getDb();
  db.prepare('UPDATE marcas SET archivada = 1 WHERE id = ?').run([id]);
  return { ok: true };
}

function _bufferToDataUrl(buffer, ext) {
  if (!buffer) return null;
  const arr = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  const b64 = btoa(binary);
  const cleanExt = String(ext || '').toLowerCase().replace(/^\./, '');
  const mime = cleanExt === 'png' ? 'image/png'
    : (cleanExt === 'jpg' || cleanExt === 'jpeg') ? 'image/jpeg'
    : 'application/octet-stream';
  return `data:${mime};base64,${b64}`;
}

export function marcasSetLogo(id, buffer, ext) {
  const db = getDb();
  const dataUrl = _bufferToDataUrl(buffer, ext);
  db.prepare('UPDATE marcas SET logo_path = ? WHERE id = ?').run([dataUrl, id]);
  return marcasGet(id);
}

export function marcasRemoveLogo(id) {
  const db = getDb();
  db.prepare('UPDATE marcas SET logo_path = NULL WHERE id = ?').run([id]);
  return marcasGet(id);
}
