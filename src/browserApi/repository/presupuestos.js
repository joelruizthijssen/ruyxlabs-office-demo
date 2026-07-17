// Puerto browser de presupuestos_* y lineas_presupuesto_*.

import { getDb } from '../db.js';
import {
  empresaActivaId, empresaScope, normalizeSerie,
  maxCorrelativoSerie, resolverColisionNumero, generarNumeroNoA,
  currentYear, round2, transaction,
} from '../helpers.js';
import { getSettings } from './settings.js';
import { clientesGet } from './clientes.js';
import { marcasGet } from './marcas.js';
import {
  recalcularTotalesPresupuesto, recalcularImporteLineaSiTieneSubs,
  presupuestoBloqueado,
} from './documentos.js';

function _correlativoDe(numero) {
  const m = String(numero || '').match(/\/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export function presupuestosList() {
  const db = getDb();
  const sc = empresaScope('p');
  return db.prepare(`
    SELECT p.id, p.numero, p.serie, p.fecha, p.cliente_id, p.asunto,
           c.nombre AS cliente_nombre,
           p.base_imponible, p.iva_importe, p.total, p.estado, p.factura_id,
           p.enviado_at
    FROM presupuestos p
    LEFT JOIN clientes c ON c.id = p.cliente_id
    WHERE p.deleted_at IS NULL${sc.sql}
    ORDER BY p.fecha DESC, p.numero DESC
  `).all(sc.params);
}

export function presupuestosGet(id) {
  const db = getDb();
  // v1.5.1 (auditoria seguridad): scope por empresa activa.
  const sc = empresaScope();
  const p = db.prepare(`SELECT * FROM presupuestos WHERE id = ?${sc.sql}`)
    .get([id, ...sc.params]);
  if (!p) return null;
  const lineas = db.prepare(`
    SELECT lp.*,
           pr.codigo AS producto_codigo,
           pr.nombre_en AS nombre_en,
           pr.descripcion_en AS descripcion_en
    FROM lineas_presupuesto lp
    LEFT JOIN productos pr ON pr.id = lp.producto_id
    WHERE lp.presupuesto_id = ?
    ORDER BY lp.orden ASC, lp.id ASC
  `).all([id]);
  for (const l of lineas) {
    l.sublineas = db.prepare(
      'SELECT * FROM sublineas_presupuesto WHERE linea_id = ? ORDER BY orden ASC, id ASC',
    ).all([l.id]);
  }
  const cliente = p.cliente_id ? clientesGet(p.cliente_id) : null;
  const hitos = db.prepare(
    'SELECT * FROM hitos_pago WHERE presupuesto_id = ? ORDER BY orden ASC, id ASC',
  ).all([id]);
  const marca = p.marca_id ? marcasGet(p.marca_id) : null;
  return { ...p, lineas, cliente, marca, hitos };
}

export function presupuestosCreate(serie) {
  const db = getDb();
  const settings = getSettings();
  const empresaId = empresaActivaId();
  const yy = currentYear();
  const s = normalizeSerie(serie);
  const fecha = new Date().toISOString().slice(0, 10);

  // v1.5.0 checkpoint 4: titulo default de empresa para presupuestos.
  const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get([empresaId]);
  const tituloDefault = (empresa && empresa.titulo_default_presupuesto
    && String(empresa.titulo_default_presupuesto).trim()) || null;

  return transaction(() => {
    let numero;
    if (s === 'A') {
      let anio = settings.numeracion_presupuesto_anio || yy;
      let siguiente = settings.numeracion_presupuesto_siguiente || 1;
      if (anio !== yy) { anio = yy; siguiente = 1; }
      const max = maxCorrelativoSerie('presupuestos', 'A', anio);
      if (max >= siguiente) siguiente = max + 1;
      let candidate = `${anio}/${String(siguiente).padStart(2, '0')}`;
      numero = resolverColisionNumero('presupuestos', candidate, empresaId);
      siguiente = _correlativoDe(numero);
      db.prepare(`
        UPDATE empresas SET numeracion_presupuesto_anio = :anio,
          numeracion_presupuesto_siguiente = :siguiente,
          actualizado_at = datetime('now') WHERE id = :id
      `).run({ ':anio': anio, ':siguiente': siguiente + 1, ':id': empresaId });
    } else {
      numero = generarNumeroNoA('presupuestos', s, yy);
    }

    const info = db.prepare(`
      INSERT INTO presupuestos (
        empresa_id, numero, serie, fecha, ciudad_emision, cliente_id, asunto,
        iva_porcentaje, base_imponible, iva_importe, total, estado,
        titulo_documento_override
      ) VALUES (
        :empresa_id, :numero, :serie, :fecha, :ciudad, NULL, NULL,
        :iva, 0, 0, 0, 'borrador',
        :titulo_override
      )
    `).run({
      ':empresa_id': empresaId, ':numero': numero, ':serie': s, ':fecha': fecha,
      ':ciudad': settings.ciudad_emision ?? null, ':iva': settings.iva_default ?? 21,
      ':titulo_override': tituloDefault,
    });
    return { id: info.lastInsertRowid, numero };
  });
}

export function presupuestosUpdate(id, data) {
  const db = getDb();
  // v1.5.1 (auditoria seguridad): scope por empresa activa antes de mutar.
  const sc = empresaScope();
  const current = db.prepare(`SELECT * FROM presupuestos WHERE id = ?${sc.sql}`)
    .get([id, ...sc.params]);
  if (!current) return null;
  if (current.estado === 'convertido') {
    const nuevoEstado = data?.estado ?? current.estado;
    if (nuevoEstado !== current.estado) {
      db.prepare(`UPDATE presupuestos SET estado = :estado, updated_at = datetime('now') WHERE id = :id`)
        .run({ ':id': id, ':estado': nuevoEstado });
    }
    return presupuestosGet(id);
  }
  const m = { ...current, ...data };
  const tituloOverride =
    typeof m.titulo_documento_override === 'string' && m.titulo_documento_override.trim()
      ? m.titulo_documento_override.trim()
      : null;
  const idiomaDoc = m.idioma_documento === 'en' ? 'en'
    : m.idioma_documento === 'es' ? 'es' : null;
  db.prepare(`
    UPDATE presupuestos SET
      fecha = :fecha, ciudad_emision = :ciudad, cliente_id = :cliente_id, asunto = :asunto,
      iva_porcentaje = :iva, iva_incluido = :iva_incluido, notas = :notas, estado = :estado,
      modo_detallado = :modo_detallado, serie = :serie, marca_id = :marca_id,
      descuento_tipo = :dtipo, descuento_valor = :dvalor,
      titulo_documento_override = :titulo_override,
      idioma_documento = :idioma_doc,
      updated_at = datetime('now')
    WHERE id = :id
  `).run({
    ':id': id, ':fecha': m.fecha, ':ciudad': m.ciudad_emision ?? null,
    ':cliente_id': m.cliente_id ?? null, ':asunto': m.asunto ?? null,
    ':iva': Number(m.iva_porcentaje) || 0,
    ':iva_incluido': m.iva_incluido === 0 || m.iva_incluido === false ? 0 : 1,
    ':notas': m.notas ?? null, ':estado': m.estado ?? 'borrador',
    ':modo_detallado': m.modo_detallado ? 1 : 0, ':serie': m.serie || 'A',
    ':marca_id': m.marca_id ? Number(m.marca_id) : null,
    ':dtipo': m.descuento_tipo === 'eur' ? 'eur' : 'pct',
    ':dvalor': Number(m.descuento_valor) || 0,
    ':titulo_override': tituloOverride,
    ':idioma_doc': idiomaDoc,
  });
  if (m.modo_detallado) {
    const lineas = db.prepare('SELECT id FROM lineas_presupuesto WHERE presupuesto_id = ?').all([id]);
    for (const l of lineas) recalcularImporteLineaSiTieneSubs(l.id, 'presupuesto');
  }
  recalcularTotalesPresupuesto(id);
  return presupuestosGet(id);
}

export function presupuestosDelete(id) {
  const db = getDb();
  // v1.5.1 (auditoria seguridad): scope por empresa activa.
  const sc = empresaScope();
  const info = db.prepare(
    `UPDATE presupuestos SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL${sc.sql}`,
  ).run([id, ...sc.params]);
  return { ok: info.changes > 0 };
}

// --- Lineas de presupuesto ---

export function lineasPresupuestoList(presupuesto_id) {
  const db = getDb();
  return db.prepare(`
    SELECT lp.*,
           pr.codigo AS producto_codigo,
           pr.nombre_en AS nombre_en,
           pr.descripcion_en AS descripcion_en
    FROM lineas_presupuesto lp
    LEFT JOIN productos pr ON pr.id = lp.producto_id
    WHERE lp.presupuesto_id = ?
    ORDER BY lp.orden ASC, lp.id ASC
  `).all([presupuesto_id]);
}

export function lineasPresupuestoCreate(presupuesto_id, data) {
  const db = getDb();
  if (presupuestoBloqueado(presupuesto_id)) {
    throw new Error('Presupuesto convertido a factura, no editable');
  }
  const maxRow = db.prepare(
    'SELECT COALESCE(MAX(orden), -1) AS m FROM lineas_presupuesto WHERE presupuesto_id = ?',
  ).get([presupuesto_id]);
  const orden = (maxRow.m ?? -1) + 1;
  const cantidad = Number(data?.cantidad ?? 1) || 1;
  const precio = round2(data?.precio_unitario ?? data?.importe ?? 0);
  const importe = data?.importe != null ? round2(data.importe) : round2(cantidad * precio);
  const info = db.prepare(`
    INSERT INTO lineas_presupuesto (presupuesto_id, orden, titulo, descripcion, cantidad, precio_unitario, importe, iva_pct, codigo, descuento_tipo, descuento_valor, producto_id)
    VALUES (:pid, :orden, :titulo, :desc, :cantidad, :precio, :importe, :ivapct, :codigo, :dtipo, :dvalor, :prodid)
  `).run({
    ':pid': presupuesto_id, ':orden': orden, ':titulo': data?.titulo ?? null,
    ':desc': data?.descripcion ?? '', ':cantidad': cantidad, ':precio': precio, ':importe': importe,
    ':ivapct': data?.iva_pct == null ? null : Number(data.iva_pct),
    ':codigo': data?.codigo ? String(data.codigo).trim() : null,
    ':dtipo': data?.descuento_tipo === 'eur' ? 'eur' : 'pct',
    ':dvalor': Number(data?.descuento_valor) || 0,
    ':prodid': data?.producto_id ? Number(data.producto_id) : null,
  });
  recalcularTotalesPresupuesto(presupuesto_id);
  return db.prepare('SELECT * FROM lineas_presupuesto WHERE id = ?').get([info.lastInsertRowid]);
}

export function lineasPresupuestoUpdate(linea_id, data) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM lineas_presupuesto WHERE id = ?').get([linea_id]);
  if (!current) return null;
  if (presupuestoBloqueado(current.presupuesto_id)) {
    throw new Error('Presupuesto convertido a factura, no editable');
  }
  const m = { ...current, ...data };
  const importe = data?.importe != null
    ? round2(data.importe)
    : round2((Number(m.cantidad) || 0) * (Number(m.precio_unitario) || 0));
  db.prepare(`
    UPDATE lineas_presupuesto SET titulo = :titulo, descripcion = :desc,
      cantidad = :cantidad, precio_unitario = :precio, importe = :importe,
      iva_pct = :ivapct, codigo = :codigo, descuento_tipo = :dtipo, descuento_valor = :dvalor,
      producto_id = :prodid
    WHERE id = :id
  `).run({
    ':id': linea_id, ':titulo': m.titulo ?? null, ':desc': m.descripcion ?? '',
    ':cantidad': Number(m.cantidad) || 0, ':precio': round2(m.precio_unitario), ':importe': importe,
    ':ivapct': m.iva_pct == null ? null : Number(m.iva_pct),
    ':codigo': m.codigo ? String(m.codigo).trim() : null,
    ':dtipo': m.descuento_tipo === 'eur' ? 'eur' : 'pct',
    ':dvalor': Number(m.descuento_valor) || 0,
    ':prodid': m.producto_id ? Number(m.producto_id) : null,
  });
  recalcularTotalesPresupuesto(current.presupuesto_id);
  return db.prepare('SELECT * FROM lineas_presupuesto WHERE id = ?').get([linea_id]);
}

export function lineasPresupuestoDelete(linea_id) {
  const db = getDb();
  const current = db.prepare('SELECT presupuesto_id FROM lineas_presupuesto WHERE id = ?').get([linea_id]);
  if (!current) return { ok: false };
  if (presupuestoBloqueado(current.presupuesto_id)) {
    throw new Error('Presupuesto convertido a factura, no editable');
  }
  db.prepare('DELETE FROM lineas_presupuesto WHERE id = ?').run([linea_id]);
  recalcularTotalesPresupuesto(current.presupuesto_id);
  return { ok: true };
}

export function lineasPresupuestoReorder(presupuesto_id, ids_en_orden) {
  const db = getDb();
  if (!Array.isArray(ids_en_orden)) return { ok: false };
  if (presupuestoBloqueado(presupuesto_id)) {
    throw new Error('Presupuesto convertido a factura, no editable');
  }
  return transaction(() => {
    ids_en_orden.forEach((id, i) => {
      db.prepare('UPDATE lineas_presupuesto SET orden = :orden WHERE id = :id AND presupuesto_id = :pid')
        .run({ ':id': id, ':orden': i, ':pid': presupuesto_id });
    });
    return { ok: true };
  });
}
