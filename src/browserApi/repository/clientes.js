// Puerto browser de clientes_* del repository desktop.

import { getDb } from '../db.js';
import { empresaActivaId, empresaScope } from '../helpers.js';
// v1.5.1 (auditoria seguridad): usar empresaScope() en get/update/delete
// para no leer/mutar clientes de otras empresas via ID conocido.

function _normalizeTipoCliente(tipo) {
  return ['autonomo', 'empresa', 'particular'].includes(tipo) ? tipo : 'empresa';
}

export function clientesList() {
  const db = getDb();
  const sc = empresaScope();
  return db.prepare(
    `SELECT * FROM clientes WHERE deleted_at IS NULL${sc.sql} ORDER BY nombre COLLATE NOCASE`,
  ).all(sc.params);
}

export function clientesGet(id) {
  const db = getDb();
  const sc = empresaScope();
  return db.prepare(`SELECT * FROM clientes WHERE id = ?${sc.sql}`)
    .get([id, ...sc.params]);
}

export function clientesDetalle(id) {
  const db = getDb();
  const sc = empresaScope();
  const cliente = db.prepare(`SELECT * FROM clientes WHERE id = ?${sc.sql}`)
    .get([id, ...sc.params]);
  if (!cliente) return null;

  const facturas = db.prepare(`
    SELECT id, numero, serie, fecha, estado, base_imponible, iva_importe, total,
           enviado_at, presupuesto_id, asunto, created_at
    FROM facturas
    WHERE cliente_id = ? AND deleted_at IS NULL
    ORDER BY fecha DESC, numero DESC
  `).all([id]);

  const presupuestos = db.prepare(`
    SELECT id, numero, serie, fecha, estado, base_imponible, iva_importe, total,
           factura_id, enviado_at, asunto, created_at
    FROM presupuestos
    WHERE cliente_id = ? AND deleted_at IS NULL
    ORDER BY fecha DESC, numero DESC
  `).all([id]);

  const cobros = db.prepare(`
    SELECT co.id, co.fecha, co.importe, co.metodo, co.notas, co.created_at,
           co.factura_id, f.numero AS factura_numero
    FROM cobros co
    JOIN facturas f ON f.id = co.factura_id
    WHERE f.cliente_id = ? AND f.deleted_at IS NULL
    ORDER BY co.fecha DESC
  `).all([id]);

  const recurrencias = db.prepare(`
    SELECT r.*,
      CASE r.tipo WHEN 'factura' THEN f.numero ELSE p.numero END AS source_numero
    FROM recurrencias r
    LEFT JOIN facturas      f ON r.tipo='factura'     AND f.id = r.source_id
    LEFT JOIN presupuestos  p ON r.tipo='presupuesto' AND p.id = r.source_id
    WHERE COALESCE(f.cliente_id, p.cliente_id) = ?
    ORDER BY r.activa DESC, r.proxima_fecha ASC
  `).all([id]);

  const totalFacturado = facturas
    .filter((f) => f.estado === 'emitida' || f.estado === 'cobrada')
    .reduce((s, f) => s + (f.total || 0), 0);
  const totalCobrosRegistrados = cobros.reduce((s, c) => s + (c.importe || 0), 0);
  const cobrosPorFactura = new Map();
  for (const c of cobros) {
    cobrosPorFactura.set(c.factura_id, (cobrosPorFactura.get(c.factura_id) || 0) + (c.importe || 0));
  }
  let cobradoExtra = 0;
  for (const f of facturas) {
    if (f.estado === 'cobrada' && !cobrosPorFactura.has(f.id)) {
      cobradoExtra += f.total || 0;
    }
  }
  const totalCobrado = totalCobrosRegistrados + cobradoExtra;
  const pendiente = Math.max(0, totalFacturado - totalCobrado);

  const yyyy = new Date().getFullYear();
  const facturadoAnio = facturas
    .filter((f) => f.fecha?.startsWith(String(yyyy))
      && (f.estado === 'emitida' || f.estado === 'cobrada'))
    .reduce((s, f) => s + (f.total || 0), 0);

  return {
    cliente,
    facturas,
    presupuestos,
    cobros,
    recurrencias,
    agregados: {
      total_facturado: totalFacturado,
      total_cobrado: totalCobrado,
      pendiente,
      facturado_anio: facturadoAnio,
      anio: yyyy,
      n_facturas: facturas.length,
      n_presupuestos: presupuestos.length,
      n_cobros: cobros.length,
    },
  };
}

export function clientesCreate(data) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO clientes (
      empresa_id, tipo, nombre, nombre_comercial, nif,
      direccion, ciudad, cp, provincia,
      email, telefono, telefono_movil, web,
      iban, condiciones_pago, irpf_pct_default, recargo_equivalencia,
      pais, intracomunitario, vat_number,
      descuento_pct_default, descuento_aplicar, tarifa_aplicar,
      contacto_persona, notas, observaciones_internas, idioma_documentos
    ) VALUES (
      :empresa_id, :tipo, :nombre, :nombre_comercial, :nif,
      :direccion, :ciudad, :cp, :provincia,
      :email, :telefono, :telefono_movil, :web,
      :iban, :condiciones_pago, :irpf_pct_default, :recargo_equivalencia,
      :pais, :intracomunitario, :vat_number,
      :descuento_pct_default, :descuento_aplicar, :tarifa_aplicar,
      :contacto_persona, :notas, :observaciones_internas, :idioma_doc
    )
  `).run({
    ':empresa_id': empresaActivaId(),
    ':tipo': _normalizeTipoCliente(data.tipo),
    ':nombre': data.nombre,
    ':nombre_comercial': data.nombre_comercial ?? null,
    ':nif': data.nif ?? null,
    ':direccion': data.direccion ?? null,
    ':ciudad': data.ciudad ?? null,
    ':cp': data.cp ?? null,
    ':provincia': data.provincia ?? null,
    ':email': data.email ?? null,
    ':telefono': data.telefono ?? null,
    ':telefono_movil': data.telefono_movil ?? null,
    ':web': data.web ?? null,
    ':iban': data.iban ?? null,
    ':condiciones_pago': data.condiciones_pago ?? null,
    ':irpf_pct_default': Number(data.irpf_pct_default) || 0,
    ':recargo_equivalencia': data.recargo_equivalencia ? 1 : 0,
    ':pais': (data.pais || 'ES').toUpperCase().slice(0, 2),
    ':intracomunitario': data.intracomunitario ? 1 : 0,
    ':vat_number': data.vat_number ? String(data.vat_number).toUpperCase().replace(/\s+/g, '') : null,
    ':descuento_pct_default': Number(data.descuento_pct_default) || 0,
    ':descuento_aplicar': data.descuento_aplicar === 'linea' ? 'linea' : 'total',
    ':tarifa_aplicar': [1, 2, 3, 4].includes(Number(data.tarifa_aplicar))
      ? Number(data.tarifa_aplicar) : 0,
    ':contacto_persona': data.contacto_persona ?? null,
    ':notas': data.notas ?? null,
    ':observaciones_internas': data.observaciones_internas ?? null,
    ':idioma_doc': data.idioma_documentos === 'en' ? 'en'
      : data.idioma_documentos === 'es' ? 'es' : null,
  });
  return clientesGet(info.lastInsertRowid);
}

export function clientesUpdate(id, data) {
  const db = getDb();
  const current = clientesGet(id);
  if (!current) return null;
  const merged = { ...current, ...data };
  db.prepare(`
    UPDATE clientes SET
      tipo = :tipo,
      nombre = :nombre,
      nombre_comercial = :nombre_comercial,
      nif = :nif,
      direccion = :direccion,
      ciudad = :ciudad,
      cp = :cp,
      provincia = :provincia,
      email = :email,
      telefono = :telefono,
      telefono_movil = :telefono_movil,
      web = :web,
      iban = :iban,
      condiciones_pago = :condiciones_pago,
      irpf_pct_default = :irpf_pct_default,
      recargo_equivalencia = :recargo_equivalencia,
      pais = :pais,
      intracomunitario = :intracomunitario,
      vat_number = :vat_number,
      descuento_pct_default = :descuento_pct_default,
      descuento_aplicar = :descuento_aplicar,
      tarifa_aplicar = :tarifa_aplicar,
      contacto_persona = :contacto_persona,
      notas = :notas,
      observaciones_internas = :observaciones_internas,
      idioma_documentos = :idioma_doc,
      updated_at = datetime('now')
    WHERE id = :id
  `).run({
    ':id': id,
    ':tipo': _normalizeTipoCliente(merged.tipo),
    ':nombre': merged.nombre,
    ':nombre_comercial': merged.nombre_comercial ?? null,
    ':nif': merged.nif ?? null,
    ':direccion': merged.direccion ?? null,
    ':ciudad': merged.ciudad ?? null,
    ':cp': merged.cp ?? null,
    ':provincia': merged.provincia ?? null,
    ':email': merged.email ?? null,
    ':telefono': merged.telefono ?? null,
    ':telefono_movil': merged.telefono_movil ?? null,
    ':web': merged.web ?? null,
    ':iban': merged.iban ?? null,
    ':condiciones_pago': merged.condiciones_pago ?? null,
    ':irpf_pct_default': Number(merged.irpf_pct_default) || 0,
    ':recargo_equivalencia': merged.recargo_equivalencia ? 1 : 0,
    ':pais': (merged.pais || 'ES').toUpperCase().slice(0, 2),
    ':intracomunitario': merged.intracomunitario ? 1 : 0,
    ':vat_number': merged.vat_number ? String(merged.vat_number).toUpperCase().replace(/\s+/g, '') : null,
    ':descuento_pct_default': Number(merged.descuento_pct_default) || 0,
    ':descuento_aplicar': merged.descuento_aplicar === 'linea' ? 'linea' : 'total',
    ':tarifa_aplicar': [1, 2, 3, 4].includes(Number(merged.tarifa_aplicar))
      ? Number(merged.tarifa_aplicar) : 0,
    ':contacto_persona': merged.contacto_persona ?? null,
    ':notas': merged.notas ?? null,
    ':observaciones_internas': merged.observaciones_internas ?? null,
    ':idioma_doc': merged.idioma_documentos === 'en' ? 'en'
      : merged.idioma_documentos === 'es' ? 'es' : null,
  });
  return clientesGet(id);
}

export function clientesDelete(id) {
  const db = getDb();
  const sc = empresaScope();
  const info = db
    .prepare(`UPDATE clientes SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL${sc.sql}`)
    .run([id, ...sc.params]);
  return { ok: info.changes > 0 };
}

// VIES no aplica en demo web (necesitaria proxy backend por CORS). Devolvemos
// un stub que le dice al usuario que en la demo no se valida.
export function clientesViesCheck() {
  return {
    ok: false,
    error: 'La validación VIES no está disponible en la demo web. Descarga la app de escritorio para usarla.',
  };
}
