// Puerto browser de proveedores_*.

import { getDb } from '../db.js';
import { empresaActivaId, empresaScope, round2 } from '../helpers.js';

export function proveedoresList() {
  const db = getDb();
  const sc = empresaScope();
  return db.prepare(
    `SELECT * FROM proveedores WHERE deleted_at IS NULL${sc.sql} ORDER BY nombre COLLATE NOCASE`,
  ).all(sc.params);
}

export function proveedoresGet(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM proveedores WHERE id = ?').get([id]);
}

export function proveedoresCreate(data) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO proveedores (
      empresa_id, nombre, nif, contacto_persona,
      email, telefono, telefono_movil, web,
      direccion, cp, ciudad, provincia, pais,
      iban, condiciones_pago, irpf_pct_default, iva_pct_default,
      tarifa_aplicar, notas, observaciones_internas, idioma_documentos
    ) VALUES (
      :empresa_id, :nombre, :nif, :contacto_persona,
      :email, :telefono, :telefono_movil, :web,
      :direccion, :cp, :ciudad, :provincia, :pais,
      :iban, :condiciones_pago, :irpf_pct_default, :iva_pct_default,
      :tarifa_aplicar, :notas, :observaciones_internas, :idioma_doc
    )
  `).run({
    ':empresa_id': empresaActivaId(),
    ':nombre': (data?.nombre || '').trim() || 'Proveedor sin nombre',
    ':nif': data?.nif ?? null,
    ':contacto_persona': data?.contacto_persona ?? null,
    ':email': data?.email ?? null,
    ':telefono': data?.telefono ?? null,
    ':telefono_movil': data?.telefono_movil ?? null,
    ':web': data?.web ?? null,
    ':direccion': data?.direccion ?? null,
    ':cp': data?.cp ?? null,
    ':ciudad': data?.ciudad ?? null,
    ':provincia': data?.provincia ?? null,
    ':pais': (data?.pais || 'ES').toUpperCase().slice(0, 2),
    ':iban': data?.iban ?? null,
    ':condiciones_pago': data?.condiciones_pago ?? null,
    ':irpf_pct_default': Number(data?.irpf_pct_default) || 0,
    ':iva_pct_default': data?.iva_pct_default == null || data.iva_pct_default === ''
      ? null : Number(data.iva_pct_default),
    ':tarifa_aplicar': Number(data?.tarifa_aplicar) || 0,
    ':notas': data?.notas ?? null,
    ':observaciones_internas': data?.observaciones_internas ?? null,
    ':idioma_doc': data?.idioma_documentos === 'en' ? 'en'
      : data?.idioma_documentos === 'es' ? 'es' : null,
  });
  return proveedoresGet(info.lastInsertRowid);
}

export function proveedoresUpdate(id, data) {
  const db = getDb();
  const current = proveedoresGet(id);
  if (!current) return null;
  const m = { ...current, ...data };
  db.prepare(`
    UPDATE proveedores SET
      nombre = :nombre, nif = :nif, contacto_persona = :contacto_persona,
      email = :email, telefono = :telefono, telefono_movil = :telefono_movil,
      web = :web, direccion = :direccion, cp = :cp, ciudad = :ciudad, provincia = :provincia,
      pais = :pais, iban = :iban, condiciones_pago = :condiciones_pago,
      irpf_pct_default = :irpf_pct_default, iva_pct_default = :iva_pct_default,
      tarifa_aplicar = :tarifa_aplicar,
      notas = :notas, observaciones_internas = :observaciones_internas,
      idioma_documentos = :idioma_doc,
      updated_at = datetime('now') WHERE id = :id
  `).run({
    ':id': id, ':nombre': (m.nombre || '').trim() || 'Proveedor sin nombre',
    ':nif': m.nif ?? null, ':contacto_persona': m.contacto_persona ?? null,
    ':email': m.email ?? null, ':telefono': m.telefono ?? null,
    ':telefono_movil': m.telefono_movil ?? null, ':web': m.web ?? null,
    ':direccion': m.direccion ?? null, ':cp': m.cp ?? null,
    ':ciudad': m.ciudad ?? null, ':provincia': m.provincia ?? null,
    ':pais': (m.pais || 'ES').toUpperCase().slice(0, 2),
    ':iban': m.iban ?? null, ':condiciones_pago': m.condiciones_pago ?? null,
    ':irpf_pct_default': Number(m.irpf_pct_default) || 0,
    ':iva_pct_default': m.iva_pct_default == null || m.iva_pct_default === ''
      ? null : Number(m.iva_pct_default),
    ':tarifa_aplicar': Number(m.tarifa_aplicar) || 0,
    ':notas': m.notas ?? null, ':observaciones_internas': m.observaciones_internas ?? null,
    ':idioma_doc': m.idioma_documentos === 'en' ? 'en'
      : m.idioma_documentos === 'es' ? 'es' : null,
  });
  return proveedoresGet(id);
}

export function proveedoresDelete(id) {
  const db = getDb();
  const info = db.prepare(
    "UPDATE proveedores SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
  ).run([id]);
  return { ok: info.changes > 0 };
}

export function proveedoresDetalle(id) {
  const db = getDb();
  const proveedor = db.prepare(
    'SELECT * FROM proveedores WHERE id = ? AND deleted_at IS NULL',
  ).get([id]);
  if (!proveedor) return null;
  const sc = empresaScope('g');
  const gastos = db.prepare(`
    SELECT g.id, g.fecha, g.subtipo, g.concepto, g.proveedor,
           g.numero_factura_proveedor, g.base_imponible, g.iva_importe,
           g.irpf_importe, g.total, g.deducible, g.categoria,
           (SELECT COALESCE(SUM(pg.importe), 0) FROM pagos_gasto pg WHERE pg.gasto_id = g.id) AS pagado_total
    FROM gastos g
    WHERE g.deleted_at IS NULL
      AND (g.proveedor_id = ? OR g.proveedor = ?) ${sc.sql}
    ORDER BY g.fecha DESC, g.id DESC
  `).all([id, proveedor.nombre, ...sc.params]);
  const totalGastado = gastos.reduce((s, g) => s + (Number(g.total) || 0), 0);
  const totalPagado = gastos.reduce((s, g) => s + (Number(g.pagado_total) || 0), 0);
  const pendiente = round2(totalGastado - totalPagado);
  const yyyy = new Date().getFullYear();
  const gastadoAnio = gastos
    .filter((g) => g.fecha?.startsWith(String(yyyy)))
    .reduce((s, g) => s + (Number(g.total) || 0), 0);
  return {
    proveedor, gastos,
    agregados: {
      total_gastado: round2(totalGastado),
      total_pagado: round2(totalPagado),
      pendiente,
      n_gastos: gastos.length,
      anio: yyyy,
      gastado_anio: round2(gastadoAnio),
    },
  };
}
