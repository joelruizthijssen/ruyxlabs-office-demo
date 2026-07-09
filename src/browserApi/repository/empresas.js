// Puerto browser de empresas_* del repository desktop.

import { getDb } from '../db.js';
import { currentYear, transaction } from '../helpers.js';
import { getSettings } from './settings.js';

export function empresasList() {
  const db = getDb();
  return db.prepare(`
    SELECT id, tipo, nombre, nif, iban, brand_color, plantilla, tipo_negocio,
           activa, creado_at, actualizado_at, logo_path
    FROM empresas
    WHERE activa = 1
    ORDER BY id ASC
  `).all();
}

export function empresasGet(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM empresas WHERE id = ?').get([id]);
}

export function empresasCreate(data) {
  const db = getDb();
  const tipo = data?.tipo === 'empresa' ? 'empresa' : 'autonomo';
  const tipo_negocio = ['servicios', 'productos', 'mixto'].includes(data?.tipo_negocio)
    ? data.tipo_negocio : 'servicios';
  const y = currentYear();
  const info = db.prepare(`
    INSERT INTO empresas (
      tipo, nombre, nif, direccion,
      emisor_cp, emisor_ciudad, emisor_provincia,
      telefono, email, iban,
      brand_color, plantilla,
      iva_default, ciudad_emision,
      tipo_negocio,
      numeracion_factura_anio, numeracion_factura_siguiente,
      numeracion_presupuesto_anio, numeracion_presupuesto_siguiente
    ) VALUES (
      :tipo, :nombre, :nif, :direccion,
      :cp, :ciudad, :provincia,
      :telefono, :email, :iban,
      :brand_color, :plantilla,
      :iva, :ciudad_emision,
      :tipo_negocio,
      :nfa, 1, :npa, 1
    )
  `).run({
    ':tipo': tipo,
    ':nombre': (data?.nombre || '').trim() || 'Sin nombre',
    ':nif': data?.nif ?? null,
    ':direccion': data?.direccion ?? null,
    ':cp': data?.emisor_cp ?? null,
    ':ciudad': data?.emisor_ciudad ?? null,
    ':provincia': data?.emisor_provincia ?? null,
    ':telefono': data?.telefono ?? null,
    ':email': data?.email ?? null,
    ':iban': data?.iban ?? null,
    ':brand_color': data?.brand_color || '#1abc9c',
    ':plantilla': data?.plantilla || 'bandas',
    ':iva': data?.iva_default ?? 21,
    ':ciudad_emision': data?.ciudad_emision ?? null,
    ':tipo_negocio': tipo_negocio,
    ':nfa': y,
    ':npa': y,
  });
  return empresasGet(info.lastInsertRowid);
}

export function empresasUpdate(id, data) {
  const db = getDb();
  const current = empresasGet(id);
  if (!current) return null;
  const m = { ...current, ...data };
  db.prepare(`
    UPDATE empresas SET
      tipo = :tipo,
      nombre = :nombre,
      nif = :nif,
      direccion = :direccion,
      emisor_cp = :cp,
      emisor_ciudad = :ciudad,
      emisor_provincia = :provincia,
      emisor_pais = :pais,
      emisor_swift = :swift,
      telefono = :telefono,
      email = :email,
      iban = :iban,
      brand_color = :brand_color,
      plantilla = :plantilla,
      iva_default = :iva,
      ciudad_emision = :ciudad_emision,
      tipo_negocio = :tipo_negocio,
      actualizado_at = datetime('now')
    WHERE id = :id
  `).run({
    ':id': id,
    ':tipo': m.tipo === 'empresa' ? 'empresa' : 'autonomo',
    ':nombre': m.nombre,
    ':nif': m.nif ?? null,
    ':direccion': m.direccion ?? null,
    ':cp': m.emisor_cp ?? null,
    ':ciudad': m.emisor_ciudad ?? null,
    ':provincia': m.emisor_provincia ?? null,
    ':pais': m.emisor_pais ?? null,
    ':swift': m.emisor_swift ?? null,
    ':telefono': m.telefono ?? null,
    ':email': m.email ?? null,
    ':iban': m.iban ?? null,
    ':brand_color': m.brand_color || '#1abc9c',
    ':plantilla': m.plantilla || 'bandas',
    ':iva': m.iva_default ?? 21,
    ':ciudad_emision': m.ciudad_emision ?? null,
    ':tipo_negocio': ['servicios', 'productos', 'mixto'].includes(m.tipo_negocio)
      ? m.tipo_negocio : 'servicios',
  });
  return empresasGet(id);
}

export function empresasSetActive(id) {
  const db = getDb();
  const exists = empresasGet(id);
  if (!exists) throw new Error('Empresa no encontrada');
  db.prepare(`
    UPDATE settings SET empresa_activa_id = ?, updated_at = datetime('now') WHERE id = 1
  `).run([id]);
  return getSettings();
}

export function empresasDelete(id) {
  const db = getDb();
  const totalActivas = db.prepare('SELECT COUNT(*) AS c FROM empresas WHERE activa = 1').get();
  if (!totalActivas || totalActivas.c <= 1) {
    throw new Error('No puedes eliminar la unica empresa. Crea otra primero.');
  }
  db.prepare(`UPDATE empresas SET activa = 0, actualizado_at = datetime('now') WHERE id = ?`).run([id]);
  const r = db.prepare('SELECT empresa_activa_id FROM settings WHERE id = 1').get();
  if (Number(r?.empresa_activa_id) === Number(id)) {
    const next = db.prepare('SELECT id FROM empresas WHERE activa = 1 ORDER BY id ASC LIMIT 1').get();
    if (next) empresasSetActive(next.id);
  }
  return getSettings();
}

export function empresasInfo(id) {
  const db = getDb();
  const eid = Number(id);
  const counter = (tbl) => {
    try {
      const r = db.prepare(
        `SELECT COUNT(*) AS c FROM ${tbl} WHERE empresa_id = ? AND deleted_at IS NULL`,
      ).get([eid]);
      return r?.c || 0;
    } catch { return 0; }
  };
  return {
    facturas: counter('facturas'),
    presupuestos: counter('presupuestos'),
    gastos: counter('gastos'),
    clientes: counter('clientes'),
  };
}

export function empresasResetCorrelativo(id, tipo) {
  const db = getDb();
  const eid = Number(id);
  const t = tipo === 'presupuesto' ? 'presupuesto' : 'factura';
  const col = t === 'factura' ? 'numeracion_factura_siguiente' : 'numeracion_presupuesto_siguiente';
  db.prepare(`UPDATE empresas SET ${col} = 1, actualizado_at = datetime('now') WHERE id = ?`).run([eid]);
  return { ok: true, empresa_id: eid, tipo: t };
}

export function empresasRenumerarBorradores(id, tipo) {
  const db = getDb();
  const eid = Number(id);
  const t = tipo === 'presupuesto' ? 'presupuesto' : 'factura';
  const tabla = t === 'factura' ? 'facturas' : 'presupuestos';
  const anio = currentYear();
  const borradores = db.prepare(
    `SELECT id, numero FROM ${tabla}
     WHERE empresa_id = ? AND estado = 'borrador' AND deleted_at IS NULL
       AND (serie IS NULL OR serie = 'A')
       AND numero LIKE ?
     ORDER BY fecha ASC, id ASC`,
  ).all([eid, `${anio}/%`]);
  if (borradores.length === 0) {
    return { ok: true, renumeradas: 0, mensaje: 'No hay borradores de serie A para renumerar.' };
  }
  const protegidos = new Set(
    db.prepare(
      `SELECT numero FROM ${tabla}
       WHERE empresa_id = ? AND estado != 'borrador' AND deleted_at IS NULL
         AND numero LIKE ?`,
    ).all([eid, `${anio}/%`]).map((r) => r.numero),
  );
  return transaction(() => {
    borradores.forEach((b, i) => {
      db.prepare(`UPDATE ${tabla} SET numero = ? WHERE id = ?`)
        .run([`__RENUM_${eid}_${i}_${b.id}`, b.id]);
    });
    let next = 1;
    let renumeradas = 0;
    for (const b of borradores) {
      let candidate;
      do {
        candidate = `${anio}/${String(next).padStart(2, '0')}`;
        next += 1;
      } while (protegidos.has(candidate));
      db.prepare(`UPDATE ${tabla} SET numero = ? WHERE id = ?`).run([candidate, b.id]);
      renumeradas += 1;
    }
    const col = t === 'factura' ? 'numeracion_factura_siguiente' : 'numeracion_presupuesto_siguiente';
    db.prepare(`UPDATE empresas SET ${col} = ? WHERE id = ?`).run([next, eid]);
    return { ok: true, renumeradas, siguiente: next };
  });
}

export function empresasDuplicate(id) {
  const src = empresasGet(id);
  if (!src) throw new Error('Empresa no encontrada');
  return empresasCreate({
    tipo: src.tipo,
    nombre: `${src.nombre} (copia)`,
    nif: src.nif,
    direccion: src.direccion,
    emisor_cp: src.emisor_cp,
    emisor_ciudad: src.emisor_ciudad,
    emisor_provincia: src.emisor_provincia,
    telefono: src.telefono,
    email: src.email,
    iban: src.iban,
    brand_color: src.brand_color,
    plantilla: src.plantilla,
    iva_default: src.iva_default,
    ciudad_emision: src.ciudad_emision,
    tipo_negocio: src.tipo_negocio,
  });
}
