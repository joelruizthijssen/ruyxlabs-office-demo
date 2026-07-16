// Puerto browser de settings_* del repository desktop.
// - No hay logo/firma/membrete como filesystem: logo_data_url etc son siempre null.
// - resetPrueba no elimina adjuntos en disco (no aplica en browser).

import { getDb, empresaActivaId } from '../db.js';
import { parseSeriesList, parseMembreteLayout, DEFAULT_MEMBRETE_LAYOUT } from '../helpers.js';

export function getSettings() {
  const db = getDb();
  const s = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  if (!s) return null;
  const empId = Number(s.empresa_activa_id) || 1;
  const e = db.prepare('SELECT * FROM empresas WHERE id = ?').get([empId])
    || db.prepare('SELECT * FROM empresas ORDER BY id ASC').get();
  let license_features_parsed = null;
  if (s.license_features) {
    try { license_features_parsed = JSON.parse(s.license_features); } catch { /* ignore */ }
  }
  const empresa = e || {};
  return {
    legal_aceptado_at: s.legal_aceptado_at,
    marcar_borrador: s.marcar_borrador,
    empresa_activa_id: empresa.id || empId,
    vista_combinada: s.vista_combinada,
    license_key: s.license_key,
    license_email: s.license_email,
    license_plan: s.license_plan,
    license_validated_at: s.license_validated_at,
    license_features: s.license_features,
    license_features_parsed,
    license_activated: !!s.license_key,
    emisor_nombre: empresa.nombre,
    emisor_nombre_comercial: empresa.nombre_comercial,
    emisor_nif: empresa.nif,
    emisor_direccion: empresa.direccion,
    emisor_telefono: empresa.telefono,
    emisor_email: empresa.email,
    emisor_iban: empresa.iban,
    emisor_cp: empresa.emisor_cp,
    emisor_ciudad: empresa.emisor_ciudad,
    emisor_provincia: empresa.emisor_provincia,
    emisor_pais: empresa.emisor_pais,
    emisor_swift: empresa.emisor_swift,
    tipo_empresa: empresa.tipo,
    tipo_negocio: empresa.tipo_negocio,
    ocultar_emisor: empresa.ocultar_emisor ? 1 : 0,
    iva_default: empresa.iva_default,
    ciudad_emision: empresa.ciudad_emision,
    texto_legal: empresa.texto_legal,
    brand_color: empresa.brand_color,
    plantilla: empresa.plantilla,
    logo_path: empresa.logo_path,
    firma_path: empresa.firma_path,
    membrete_path: empresa.membrete_path,
    membrete_layout: empresa.membrete_layout,
    series_facturas: empresa.series_facturas,
    series_presupuestos: empresa.series_presupuestos,
    numeracion_factura_anio: empresa.numeracion_factura_anio,
    numeracion_factura_siguiente: empresa.numeracion_factura_siguiente,
    numeracion_presupuesto_anio: empresa.numeracion_presupuesto_anio,
    numeracion_presupuesto_siguiente: empresa.numeracion_presupuesto_siguiente,
    tarifa_compra_1_label: empresa.tarifa_compra_1_label,
    tarifa_compra_2_label: empresa.tarifa_compra_2_label,
    tarifa_compra_3_label: empresa.tarifa_compra_3_label,
    tarifa_compra_4_label: empresa.tarifa_compra_4_label,
    titulo_default_factura: empresa.titulo_default_factura,
    titulo_default_proforma: empresa.titulo_default_proforma,
    titulo_default_contado: empresa.titulo_default_contado,
    titulo_default_rectificativa: empresa.titulo_default_rectificativa,
    titulo_default_presupuesto: empresa.titulo_default_presupuesto,
    mostrar_codigo_en_lineas: empresa.mostrar_codigo_en_lineas ? 1 : 0,
    // En web demo no hay ficheros de logo/firma/membrete. Siempre null.
    logo_data_url: null,
    firma_data_url: null,
    membrete_data_url: null,
    membrete_layout_parsed: parseMembreteLayout(empresa.membrete_layout),
    series_facturas_list: parseSeriesList(empresa.series_facturas),
    series_presupuestos_list: parseSeriesList(empresa.series_presupuestos),
  };
}

export function settingsUpdate(data) {
  const db = getDb();
  const current = getSettings();
  if (!current) throw new Error('No existe la fila settings (id=1)');
  const normalized = { ...data };
  for (const k of ['series_facturas', 'series_presupuestos']) {
    const v = normalized[k];
    if (v == null) continue;
    if (Array.isArray(v)) {
      const clean = parseSeriesList(JSON.stringify(v));
      normalized[k] = JSON.stringify(clean);
    } else if (typeof v === 'string' && v.trim() !== '') {
      const clean = parseSeriesList(v);
      normalized[k] = JSON.stringify(clean);
    }
  }
  if (normalized.membrete_layout != null) {
    if (typeof normalized.membrete_layout === 'object') {
      const merged = { ...DEFAULT_MEMBRETE_LAYOUT, ...normalized.membrete_layout };
      normalized.membrete_layout = JSON.stringify(merged);
    }
  }
  const m = { ...current, ...normalized };

  db.prepare(`
    UPDATE settings SET
      marcar_borrador = :marcar_borrador,
      vista_combinada = :vista_combinada,
      empresa_activa_id = :empresa_activa_id,
      updated_at = datetime('now')
    WHERE id = 1
  `).run({
    ':marcar_borrador': m.marcar_borrador ? 1 : 0,
    ':vista_combinada': m.vista_combinada ? 1 : 0,
    ':empresa_activa_id': Number(m.empresa_activa_id) || 1,
  });

  const empresaId = Number(m.empresa_activa_id) || empresaActivaId();
  db.prepare(`
    UPDATE empresas SET
      tipo = :tipo,
      nombre = :nombre,
      nombre_comercial = :nombre_comercial,
      nif = :nif,
      direccion = :direccion,
      telefono = :telefono,
      email = :email,
      iban = :iban,
      emisor_cp = :cp,
      emisor_ciudad = :ciudad,
      emisor_provincia = :provincia,
      emisor_pais = :pais,
      emisor_swift = :swift,
      iva_default = :iva_default,
      texto_legal = :texto_legal,
      ciudad_emision = :ciudad_emision,
      brand_color = :brand_color,
      plantilla = :plantilla,
      membrete_layout = :membrete_layout,
      series_facturas = :series_facturas,
      series_presupuestos = :series_presupuestos,
      numeracion_factura_anio = :nfa,
      numeracion_factura_siguiente = :nfs,
      numeracion_presupuesto_anio = :npa,
      numeracion_presupuesto_siguiente = :nps,
      tipo_negocio = :tipo_negocio,
      ocultar_emisor = :ocultar_emisor,
      tarifa_compra_1_label = :tcl1,
      tarifa_compra_2_label = :tcl2,
      tarifa_compra_3_label = :tcl3,
      tarifa_compra_4_label = :tcl4,
      titulo_default_factura = :tdf,
      titulo_default_proforma = :tdp,
      titulo_default_contado = :tdc,
      titulo_default_rectificativa = :tdr,
      titulo_default_presupuesto = :tdpr,
      mostrar_codigo_en_lineas = :mostrar_codigo,
      actualizado_at = datetime('now')
    WHERE id = :id
  `).run({
    ':id': empresaId,
    ':tipo': m.tipo_empresa === 'empresa' ? 'empresa' : 'autonomo',
    ':nombre': m.emisor_nombre ?? null,
    ':nombre_comercial': m.emisor_nombre_comercial ?? null,
    ':nif': m.emisor_nif ?? null,
    ':direccion': m.emisor_direccion ?? null,
    ':telefono': m.emisor_telefono ?? null,
    ':email': m.emisor_email ?? null,
    ':iban': m.emisor_iban ?? null,
    ':cp': m.emisor_cp ?? null,
    ':ciudad': m.emisor_ciudad ?? null,
    ':provincia': m.emisor_provincia ?? null,
    ':pais': m.emisor_pais ?? null,
    ':swift': m.emisor_swift ?? null,
    ':iva_default': m.iva_default ?? 21,
    ':texto_legal': m.texto_legal ?? null,
    ':ciudad_emision': m.ciudad_emision ?? null,
    ':brand_color': m.brand_color ?? '#1abc9c',
    ':plantilla': m.plantilla ?? 'bandas',
    ':membrete_layout': m.membrete_layout ?? null,
    ':series_facturas': m.series_facturas ?? null,
    ':series_presupuestos': m.series_presupuestos ?? null,
    ':nfa': m.numeracion_factura_anio ?? null,
    ':nfs': m.numeracion_factura_siguiente ?? 1,
    ':npa': m.numeracion_presupuesto_anio ?? null,
    ':nps': m.numeracion_presupuesto_siguiente ?? 1,
    ':tipo_negocio': ['servicios', 'productos', 'mixto'].includes(m.tipo_negocio)
      ? m.tipo_negocio : 'servicios',
    ':ocultar_emisor': m.ocultar_emisor ? 1 : 0,
    ':tcl1': (m.tarifa_compra_1_label || '').trim() || null,
    ':tcl2': (m.tarifa_compra_2_label || '').trim() || null,
    ':tcl3': (m.tarifa_compra_3_label || '').trim() || null,
    ':tcl4': (m.tarifa_compra_4_label || '').trim() || null,
    ':tdf': (m.titulo_default_factura || '').trim() || null,
    ':tdp': (m.titulo_default_proforma || '').trim() || null,
    ':tdc': (m.titulo_default_contado || '').trim() || null,
    ':tdr': (m.titulo_default_rectificativa || '').trim() || null,
    ':tdpr': (m.titulo_default_presupuesto || '').trim() || null,
    ':mostrar_codigo': m.mostrar_codigo_en_lineas ? 1 : 0,
  });

  return getSettings();
}

export function settingsAcceptLegal() {
  const db = getDb();
  db.prepare(`
    UPDATE settings SET
      legal_aceptado_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = 1
  `).run();
  return getSettings();
}

// En demo web no hay filesystem — todos los "set" de imagen guardan como data
// URL en el propio campo (que en desktop es una ruta). Aceptable para demo.
export function settingsSetLogo(buffer, ext) {
  const db = getDb();
  const empId = empresaActivaId();
  const dataUrl = _bufferToDataUrl(buffer, ext);
  db.prepare('UPDATE empresas SET logo_path = ? WHERE id = ?').run([dataUrl, empId]);
  return getSettings();
}

export function settingsRemoveLogo() {
  const db = getDb();
  const empId = empresaActivaId();
  db.prepare('UPDATE empresas SET logo_path = NULL WHERE id = ?').run([empId]);
  return getSettings();
}

export function settingsSetFirma(buffer, ext) {
  const db = getDb();
  const empId = empresaActivaId();
  const dataUrl = _bufferToDataUrl(buffer, ext);
  db.prepare('UPDATE empresas SET firma_path = ? WHERE id = ?').run([dataUrl, empId]);
  return getSettings();
}

export function settingsRemoveFirma() {
  const db = getDb();
  const empId = empresaActivaId();
  db.prepare('UPDATE empresas SET firma_path = NULL WHERE id = ?').run([empId]);
  return getSettings();
}

export function settingsSetMembrete(buffer, ext) {
  const db = getDb();
  const empId = empresaActivaId();
  const dataUrl = _bufferToDataUrl(buffer, ext);
  db.prepare('UPDATE empresas SET membrete_path = ? WHERE id = ?').run([dataUrl, empId]);
  return getSettings();
}

export function settingsRemoveMembrete() {
  const db = getDb();
  const empId = empresaActivaId();
  db.prepare('UPDATE empresas SET membrete_path = NULL WHERE id = ?').run([empId]);
  return getSettings();
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

export function datosResetPrueba() {
  const db = getDb();
  const empresaId = empresaActivaId();
  db.exec('BEGIN');
  try {
    for (const tbl of [
      'cobros',
      'hitos_pago',
      'sublineas_factura',
      'lineas_factura',
      'sublineas_presupuesto',
      'lineas_presupuesto',
      'facturas',
      'presupuestos',
      'gasto_lineas',
      'pagos_gasto',
      'gastos_vencimientos',
      'gastos',
    ]) {
      // Para las tablas con empresa_id directo, borra directo.
      // Para las tablas hijas sin empresa_id, borra por join con padre.
      if (tbl === 'facturas' || tbl === 'presupuestos' || tbl === 'gastos') {
        db.prepare(`DELETE FROM ${tbl} WHERE empresa_id = ?`).run([empresaId]);
      } else if (tbl === 'lineas_factura' || tbl === 'sublineas_factura' || tbl === 'cobros' || tbl === 'hitos_pago') {
        // ON DELETE CASCADE ya limpia estas cuando se borran las facturas
      } else if (tbl === 'lineas_presupuesto' || tbl === 'sublineas_presupuesto') {
        // Igual con presupuestos
      } else if (tbl === 'gasto_lineas' || tbl === 'pagos_gasto' || tbl === 'gastos_vencimientos') {
        // Igual con gastos
      }
    }
    // Reset contadores
    db.prepare(`
      UPDATE empresas SET
        numeracion_factura_siguiente = 1,
        numeracion_presupuesto_siguiente = 1
      WHERE id = ?
    `).run([empresaId]);
    db.exec('COMMIT');
    return { ok: true };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
