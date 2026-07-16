// Puerto browser de facturas_*, lineas_factura_*, conversiones proforma/presupuesto.

import { getDb } from '../db.js';
import {
  empresaActivaId, empresaScope, normalizeSerie,
  maxCorrelativoSerie, resolverColisionNumero, generarNumeroNoA, generarNumeroSubtipo,
  currentYear, round2, transaction,
} from '../helpers.js';
import { getSettings } from './settings.js';
import { clientesGet } from './clientes.js';
import { marcasGet } from './marcas.js';
import {
  recalcularTotalesFactura, recalcularImporteLineaSiTieneSubs,
  facturaBloqueada, normalizeDianaPct,
} from './documentos.js';
import {
  depositosAplicarSalidaPorFactura, depositosRevertirSalidaPorFactura,
} from './depositos.js';

function _correlativoDe(numero) {
  const m = String(numero || '').match(/\/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

function _siguienteNumeroFactura(serie, settings, yy) {
  const db = getDb();
  if (serie === 'A') {
    let anio = settings.numeracion_factura_anio || yy;
    let siguiente = settings.numeracion_factura_siguiente || 1;
    if (anio !== yy) { anio = yy; siguiente = 1; }
    const max = maxCorrelativoSerie('facturas', 'A', anio);
    if (max >= siguiente) siguiente = max + 1;
    let candidate = `${anio}/${String(siguiente).padStart(2, '0')}`;
    candidate = resolverColisionNumero('facturas', candidate);
    const corr = _correlativoDe(candidate);
    return { numero: candidate, serieAnio: anio, serieSiguiente: corr + 1 };
  }
  return { numero: generarNumeroNoA('facturas', serie, yy), serieAnio: null, serieSiguiente: null };
}

export function facturasList() {
  const db = getDb();
  const sc = empresaScope('f');
  return db.prepare(`
    SELECT f.id, f.numero, f.serie, f.subtipo, f.fecha, f.fecha_vencimiento,
           f.cliente_id, f.asunto, c.nombre AS cliente_nombre,
           f.base_imponible, f.iva_importe, f.total, f.estado, f.presupuesto_id,
           f.proforma_origen_id, f.enviado_at,
           f.titulo_documento_override
    FROM facturas f
    LEFT JOIN clientes c ON c.id = f.cliente_id
    WHERE f.deleted_at IS NULL${sc.sql}
    ORDER BY f.fecha DESC, f.numero DESC
  `).all(sc.params);
}

export function facturasGet(id) {
  const db = getDb();
  const f = db.prepare('SELECT * FROM facturas WHERE id = ?').get([id]);
  if (!f) return null;
  const lineas = db.prepare(`
    SELECT lf.*,
           p.codigo AS producto_codigo,
           p.nombre_en AS nombre_en,
           p.descripcion_en AS descripcion_en
    FROM lineas_factura lf
    LEFT JOIN productos p ON p.id = lf.producto_id
    WHERE lf.factura_id = ?
    ORDER BY lf.orden ASC, lf.id ASC
  `).all([id]);
  for (const l of lineas) {
    l.sublineas = db.prepare(
      'SELECT * FROM sublineas_factura WHERE linea_id = ? ORDER BY orden ASC, id ASC',
    ).all([l.id]);
  }
  const cliente = f.cliente_id ? clientesGet(f.cliente_id) : null;
  const cobros = db.prepare(
    'SELECT * FROM cobros WHERE factura_id = ? ORDER BY fecha ASC, id ASC',
  ).all([id]);
  const cobradoTotal = cobros.reduce((s, c) => s + (Number(c.importe) || 0), 0);
  const marca = f.marca_id ? marcasGet(f.marca_id) : null;
  let convertida_a = null;
  if (f.subtipo === 'proforma') {
    const ya = db.prepare(
      `SELECT id, numero FROM facturas WHERE proforma_origen_id = ? AND deleted_at IS NULL LIMIT 1`,
    ).get([id]);
    if (ya) convertida_a = { factura_id: ya.id, factura_numero: ya.numero };
  }
  return { ...f, lineas, cliente, marca, cobros, cobrado_total: round2(cobradoTotal), convertida_a };
}

export function facturasCreate(serie, subtipo) {
  const db = getDb();
  const settings = getSettings();
  const empresaId = empresaActivaId();
  const yy = currentYear();
  const s = normalizeSerie(serie);
  const validSubtipos = ['factura', 'proforma', 'nota_contado', 'rectificativa'];
  const sub = validSubtipos.includes(subtipo) ? subtipo : 'factura';
  const fecha = new Date().toISOString().slice(0, 10);

  // v1.5.0 checkpoint 4: leer titulo default de la empresa segun subtipo,
  // se copia a titulo_documento_override al crear.
  const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get([empresaId]);
  const colTitulo = sub === 'factura' ? 'titulo_default_factura'
    : sub === 'proforma' ? 'titulo_default_proforma'
    : sub === 'nota_contado' ? 'titulo_default_contado'
    : sub === 'rectificativa' ? 'titulo_default_rectificativa'
    : null;
  const tituloDefault = (colTitulo && empresa && empresa[colTitulo]
    && String(empresa[colTitulo]).trim()) || null;

  return transaction(() => {
    let numero;
    if (sub === 'proforma' || sub === 'nota_contado' || sub === 'rectificativa') {
      const subPrefix = sub === 'proforma' ? 'PRO' : sub === 'nota_contado' ? 'NC' : 'RECT';
      numero = generarNumeroSubtipo('facturas', subPrefix, yy);
    } else if (s === 'A') {
      let anio = settings.numeracion_factura_anio || yy;
      let siguiente = settings.numeracion_factura_siguiente || 1;
      if (anio !== yy) { anio = yy; siguiente = 1; }
      const max = maxCorrelativoSerie('facturas', 'A', anio);
      if (max >= siguiente) siguiente = max + 1;
      let candidate = `${anio}/${String(siguiente).padStart(2, '0')}`;
      numero = resolverColisionNumero('facturas', candidate, empresaId);
      siguiente = _correlativoDe(numero);
      db.prepare(`
        UPDATE empresas SET numeracion_factura_anio = :anio,
          numeracion_factura_siguiente = :siguiente,
          actualizado_at = datetime('now') WHERE id = :id
      `).run({ ':anio': anio, ':siguiente': siguiente + 1, ':id': empresaId });
    } else {
      numero = generarNumeroNoA('facturas', s, yy);
    }

    const info = db.prepare(`
      INSERT INTO facturas (
        empresa_id, numero, serie, subtipo, fecha, ciudad_emision, cliente_id, asunto,
        iva_porcentaje, base_imponible, iva_importe, total, estado,
        titulo_documento_override
      ) VALUES (
        :empresa_id, :numero, :serie, :subtipo, :fecha, :ciudad, NULL, NULL,
        :iva, 0, 0, 0, 'borrador',
        :titulo_override
      )
    `).run({
      ':empresa_id': empresaId, ':numero': numero, ':serie': s, ':subtipo': sub,
      ':fecha': fecha, ':ciudad': settings.ciudad_emision ?? null,
      ':iva': settings.iva_default ?? 21,
      ':titulo_override': tituloDefault,
    });
    return { id: info.lastInsertRowid, numero, subtipo: sub };
  });
}

export function facturasUpdate(id, data) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM facturas WHERE id = ?').get([id]);
  if (!current) return null;
  if (current.estado !== 'borrador') {
    const nuevoEstado = data?.estado ?? current.estado;
    if (nuevoEstado !== current.estado) {
      db.prepare(`UPDATE facturas SET estado = :estado, updated_at = datetime('now') WHERE id = :id`)
        .run({ ':id': id, ':estado': nuevoEstado });
      // v1.5.0 checkpoint 7: si vuelve a borrador, revertir la salida del
      // deposito para no dejar movimientos huerfanos.
      if (nuevoEstado === 'borrador') {
        depositosRevertirSalidaPorFactura(id);
      }
    }
    return facturasGet(id);
  }
  const m = { ...current, ...data };
  let nuevoNumero = current.numero;
  if (data && data.numero != null) {
    const n = String(data.numero).trim();
    if (n && n !== current.numero) {
      const dup = db.prepare(
        'SELECT id FROM facturas WHERE numero = ? AND empresa_id = ? AND id != ?',
      ).get([n, current.empresa_id, id]);
      if (dup) return { error: `Ya existe una factura con el número "${n}" en esta empresa. Elige otro.` };
      nuevoNumero = n;
    }
  }
  // v1.4.0 sync desde app: titulo custom del documento. Trim + null si vacio.
  const tituloOverride =
    typeof m.titulo_documento_override === 'string' && m.titulo_documento_override.trim()
      ? m.titulo_documento_override.trim()
      : null;
  // v1.5.0 checkpoint 6: idioma del PDF. Solo 'es', 'en' o null (auto).
  const idiomaDoc = m.idioma_documento === 'en' ? 'en'
    : m.idioma_documento === 'es' ? 'es' : null;
  db.prepare(`
    UPDATE facturas SET
      numero = :numero, fecha = :fecha, fecha_vencimiento = :fecha_venc, ciudad_emision = :ciudad,
      cliente_id = :cliente_id, asunto = :asunto, iva_porcentaje = :iva,
      iva_incluido = :iva_incluido, notas = :notas, notas_publicas = :notas_publicas,
      estado = :estado, modo_detallado = :modo_detallado,
      factura_ocultar_subitems = :ocultar_subs, documento_interno = :doc_interno,
      irpf_pct = :irpf, serie = :serie, marca_id = :marca_id,
      descuento_tipo = :dtipo, descuento_valor = :dvalor,
      titulo_documento_override = :titulo_override,
      idioma_documento = :idioma_doc,
      updated_at = datetime('now')
    WHERE id = :id
  `).run({
    ':id': id, ':fecha': m.fecha, ':fecha_venc': m.fecha_vencimiento || null,
    ':ciudad': m.ciudad_emision ?? null, ':cliente_id': m.cliente_id ?? null,
    ':asunto': m.asunto ?? null, ':iva': Number(m.iva_porcentaje) || 0,
    ':iva_incluido': m.iva_incluido === 0 || m.iva_incluido === false ? 0 : 1,
    ':notas': m.notas ?? null, ':notas_publicas': m.notas_publicas ?? null,
    ':estado': m.estado ?? 'borrador',
    ':modo_detallado': m.modo_detallado ? 1 : 0,
    ':ocultar_subs': m.factura_ocultar_subitems ? 1 : 0,
    ':doc_interno': m.documento_interno ? 1 : 0,
    ':numero': nuevoNumero,
    ':irpf': Number(m.irpf_pct) || 0, ':serie': m.serie || 'A',
    ':marca_id': m.marca_id ? Number(m.marca_id) : null,
    ':dtipo': m.descuento_tipo === 'eur' ? 'eur' : 'pct',
    ':dvalor': Number(m.descuento_valor) || 0,
    ':titulo_override': tituloOverride,
    ':idioma_doc': idiomaDoc,
  });
  if (m.modo_detallado) {
    const lineas = db.prepare('SELECT id FROM lineas_factura WHERE factura_id = ?').all([id]);
    for (const l of lineas) recalcularImporteLineaSiTieneSubs(l.id, 'factura');
  }
  recalcularTotalesFactura(id);
  // v1.5.0 checkpoint 7: al salir de borrador, aplicar auto-descuento en el
  // deposito del cliente si existe. Idempotente.
  const estadoNuevo = m.estado ?? 'borrador';
  if (estadoNuevo !== 'borrador') {
    depositosAplicarSalidaPorFactura(id);
  }
  return facturasGet(id);
}

export function facturasDelete(id) {
  const db = getDb();
  const row = db.prepare('SELECT estado, deleted_at FROM facturas WHERE id = ?').get([id]);
  if (!row || row.deleted_at) return { ok: false };
  if (row.estado === 'borrador') {
    db.prepare(`
      UPDATE facturas SET deleted_at = datetime('now'),
        numero = 'ELIM-' || numero || '#' || id
      WHERE id = :id AND deleted_at IS NULL
    `).run({ ':id': id });
  } else {
    db.prepare("UPDATE facturas SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL").run([id]);
  }
  return { ok: true };
}

// --- Lineas de factura ---

export function lineasFacturaList(factura_id) {
  const db = getDb();
  return db.prepare(`
    SELECT lf.*,
           p.codigo AS producto_codigo,
           p.nombre_en AS nombre_en,
           p.descripcion_en AS descripcion_en
    FROM lineas_factura lf
    LEFT JOIN productos p ON p.id = lf.producto_id
    WHERE lf.factura_id = ?
    ORDER BY lf.orden ASC, lf.id ASC
  `).all([factura_id]);
}

export function lineasFacturaCreate(factura_id, data) {
  const db = getDb();
  if (facturaBloqueada(factura_id)) throw new Error('Factura bloqueada (pasa a borrador para editar)');
  const maxRow = db.prepare(
    'SELECT COALESCE(MAX(orden), -1) AS m FROM lineas_factura WHERE factura_id = ?',
  ).get([factura_id]);
  const orden = (maxRow.m ?? -1) + 1;
  const cantidad = Number(data?.cantidad ?? 1) || 1;
  const precio = round2(data?.precio_unitario ?? data?.importe ?? 0);
  const importe = data?.importe != null ? round2(data.importe) : round2(cantidad * precio);
  const info = db.prepare(`
    INSERT INTO lineas_factura (factura_id, orden, titulo, descripcion, cantidad, precio_unitario, importe, iva_pct, codigo, descuento_tipo, descuento_valor, diana_pct, producto_id)
    VALUES (:fid, :orden, :titulo, :desc, :cantidad, :precio, :importe, :ivapct, :codigo, :dtipo, :dvalor, :diana, :prodid)
  `).run({
    ':fid': factura_id, ':orden': orden, ':titulo': data?.titulo ?? null,
    ':desc': data?.descripcion ?? '', ':cantidad': cantidad, ':precio': precio, ':importe': importe,
    ':ivapct': data?.iva_pct == null ? null : Number(data.iva_pct),
    ':codigo': data?.codigo ? String(data.codigo).trim() : null,
    ':dtipo': data?.descuento_tipo === 'eur' ? 'eur' : 'pct',
    ':dvalor': Number(data?.descuento_valor) || 0,
    ':diana': normalizeDianaPct(data?.diana_pct),
    ':prodid': data?.producto_id ? Number(data.producto_id) : null,
  });
  recalcularTotalesFactura(factura_id);
  return db.prepare('SELECT * FROM lineas_factura WHERE id = ?').get([info.lastInsertRowid]);
}

export function lineasFacturaUpdate(linea_id, data) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM lineas_factura WHERE id = ?').get([linea_id]);
  if (!current) return null;
  if (facturaBloqueada(current.factura_id)) throw new Error('Factura bloqueada (pasa a borrador para editar)');
  const m = { ...current, ...data };
  const importe = data?.importe != null
    ? round2(data.importe)
    : round2((Number(m.cantidad) || 0) * (Number(m.precio_unitario) || 0));
  db.prepare(`
    UPDATE lineas_factura SET titulo = :titulo, descripcion = :desc,
      cantidad = :cantidad, precio_unitario = :precio, importe = :importe,
      iva_pct = :ivapct, codigo = :codigo, descuento_tipo = :dtipo,
      descuento_valor = :dvalor, diana_pct = :diana,
      producto_id = :prodid
    WHERE id = :id
  `).run({
    ':id': linea_id, ':titulo': m.titulo ?? null, ':desc': m.descripcion ?? '',
    ':cantidad': Number(m.cantidad) || 0, ':precio': round2(m.precio_unitario), ':importe': importe,
    ':ivapct': m.iva_pct == null ? null : Number(m.iva_pct),
    ':codigo': m.codigo ? String(m.codigo).trim() : null,
    ':dtipo': m.descuento_tipo === 'eur' ? 'eur' : 'pct',
    ':dvalor': Number(m.descuento_valor) || 0,
    ':diana': normalizeDianaPct(m.diana_pct),
    ':prodid': m.producto_id ? Number(m.producto_id) : null,
  });
  recalcularTotalesFactura(current.factura_id);
  return db.prepare('SELECT * FROM lineas_factura WHERE id = ?').get([linea_id]);
}

export function lineasFacturaDelete(linea_id) {
  const db = getDb();
  const current = db.prepare('SELECT factura_id FROM lineas_factura WHERE id = ?').get([linea_id]);
  if (!current) return { ok: false };
  if (facturaBloqueada(current.factura_id)) throw new Error('Factura bloqueada (pasa a borrador para editar)');
  db.prepare('DELETE FROM lineas_factura WHERE id = ?').run([linea_id]);
  recalcularTotalesFactura(current.factura_id);
  return { ok: true };
}

export function lineasFacturaSetDianaPct(linea_id, pct) {
  const db = getDb();
  const current = db.prepare('SELECT id FROM lineas_factura WHERE id = ?').get([linea_id]);
  if (!current) return { ok: false, error: 'Linea no encontrada' };
  const v = normalizeDianaPct(pct);
  db.prepare('UPDATE lineas_factura SET diana_pct = ? WHERE id = ?').run([v, linea_id]);
  return { ok: true, diana_pct: v };
}

export function lineasFacturaReorder(factura_id, ids_en_orden) {
  const db = getDb();
  if (!Array.isArray(ids_en_orden)) return { ok: false };
  if (facturaBloqueada(factura_id)) throw new Error('Factura bloqueada (pasa a borrador para editar)');
  return transaction(() => {
    ids_en_orden.forEach((id, i) => {
      db.prepare('UPDATE lineas_factura SET orden = :orden WHERE id = :id AND factura_id = :fid')
        .run({ ':id': id, ':orden': i, ':fid': factura_id });
    });
    return { ok: true };
  });
}

// --- Conversion presupuesto -> factura ---
export function presupuestoConvertirAFactura(presupuesto_id, opts) {
  const db = getDb();
  const p = db.prepare('SELECT * FROM presupuestos WHERE id = ?').get([presupuesto_id]);
  if (!p) throw new Error('Presupuesto no encontrado');
  if (p.deleted_at) throw new Error('Presupuesto eliminado');
  if (p.factura_id) throw new Error('Este presupuesto ya esta convertido');
  if (!p.cliente_id) throw new Error('Falta cliente');
  const lineasP = db.prepare(
    'SELECT * FROM lineas_presupuesto WHERE presupuesto_id = ? ORDER BY orden ASC, id ASC',
  ).all([presupuesto_id]);
  if (lineasP.length === 0) throw new Error('El presupuesto no tiene lineas');
  const hitos = db.prepare(
    'SELECT * FROM hitos_pago WHERE presupuesto_id = ? ORDER BY orden ASC, id ASC',
  ).all([presupuesto_id]);
  const settings = getSettings();
  const yy = currentYear();
  const serieFactura = normalizeSerie(opts?.serie);
  const fechaHoy = new Date().toISOString().slice(0, 10);
  const modo = opts?.modo === 'resumen' ? 'resumen' : 'completa';
  const resumenTexto = (opts?.resumen_texto || '').trim() || 'Trabajo realizado según presupuesto';

  return transaction(() => {
    let serieAnio = null, serieSiguienteFinal = null;
    const facturasCreadas = [];

    const insertFactura = (params) => db.prepare(`
      INSERT INTO facturas (
        numero, serie, fecha, ciudad_emision, cliente_id, asunto,
        iva_porcentaje, base_imponible, iva_importe, total, estado,
        presupuesto_id, modo_detallado, empresa_id
      ) VALUES (
        :numero, :serie, :fecha, :ciudad, :cliente_id, :asunto,
        :iva, 0, 0, 0, 'borrador',
        :presupuesto_id, :modo_detallado, :eid
      )
    `).run(params).lastInsertRowid;
    const insertLinea = (params) => db.prepare(`
      INSERT INTO lineas_factura (factura_id, orden, titulo, descripcion, cantidad, precio_unitario, importe)
      VALUES (:fid, :orden, :titulo, :desc, :cantidad, :precio, :importe)
    `).run(params).lastInsertRowid;
    const insertSublinea = (params) => db.prepare(`
      INSERT INTO sublineas_factura (linea_id, orden, descripcion, cantidad, precio_unitario, importe)
      VALUES (:lid, :orden, :desc, :cantidad, :precio, :importe)
    `).run(params);

    const empresaId = empresaActivaId();

    if (hitos.length === 0) {
      const num = _siguienteNumeroFactura(serieFactura, settings, yy);
      const modoDetalladoFactura = modo === 'resumen' ? 0 : (p.modo_detallado ? 1 : 0);
      const facturaId = insertFactura({
        ':numero': num.numero, ':serie': serieFactura, ':fecha': fechaHoy,
        ':ciudad': p.ciudad_emision ?? null, ':cliente_id': p.cliente_id, ':asunto': null,
        ':iva': p.iva_porcentaje ?? 21, ':presupuesto_id': presupuesto_id,
        ':modo_detallado': modoDetalladoFactura, ':eid': empresaId,
      });

      if (modo === 'resumen') {
        const importeResumen = round2(p.base_imponible || 0);
        insertLinea({
          ':fid': facturaId, ':orden': 0, ':titulo': resumenTexto, ':desc': '',
          ':cantidad': 1, ':precio': importeResumen, ':importe': importeResumen,
        });
      } else {
        lineasP.forEach((l, i) => {
          const titulo = (l.titulo && l.titulo.trim())
            || (l.descripcion ? l.descripcion.trim().slice(0, 80) : '') || '';
          const importe = round2(l.importe);
          const newLineaId = insertLinea({
            ':fid': facturaId, ':orden': i, ':titulo': titulo || null, ':desc': '',
            ':cantidad': 1, ':precio': importe, ':importe': importe,
          });
          if (p.modo_detallado) {
            const subs = db.prepare(
              'SELECT * FROM sublineas_presupuesto WHERE linea_id = ? ORDER BY orden ASC, id ASC',
            ).all([l.id]);
            subs.forEach((s, j) => {
              insertSublinea({
                ':lid': newLineaId, ':orden': j, ':desc': s.descripcion ?? '',
                ':cantidad': s.cantidad, ':precio': s.precio_unitario, ':importe': round2(s.importe),
              });
            });
          }
        });
      }
      recalcularTotalesFactura(facturaId);
      facturasCreadas.push({ id: facturaId, numero: num.numero });
      serieAnio = num.serieAnio;
      serieSiguienteFinal = num.serieSiguiente;
    } else {
      const totalBase = round2(p.base_imponible || 0);
      let workingSettings = settings;
      for (let idx = 0; idx < hitos.length; idx += 1) {
        const h = hitos[idx];
        const importeBase = round2(totalBase * (Number(h.importe_pct) || 0) / 100);
        const num = _siguienteNumeroFactura(serieFactura, workingSettings, yy);
        const descripcion = h.descripcion?.trim() || `Hito ${idx + 1}`;
        const facturaId = insertFactura({
          ':numero': num.numero, ':serie': serieFactura, ':fecha': fechaHoy,
          ':ciudad': p.ciudad_emision ?? null, ':cliente_id': p.cliente_id,
          ':asunto': `${descripcion} — ${h.importe_pct}% del presupuesto`,
          ':iva': p.iva_porcentaje ?? 21, ':presupuesto_id': presupuesto_id,
          ':modo_detallado': 0, ':eid': empresaId,
        });
        insertLinea({
          ':fid': facturaId, ':orden': 0, ':titulo': descripcion, ':desc': h.notas ?? '',
          ':cantidad': 1, ':precio': importeBase, ':importe': importeBase,
        });
        recalcularTotalesFactura(facturaId);
        db.prepare('UPDATE hitos_pago SET factura_id = ? WHERE id = ?').run([facturaId, h.id]);
        facturasCreadas.push({ id: facturaId, numero: num.numero });
        if (serieFactura === 'A' && num.serieSiguiente != null) {
          workingSettings = { ...workingSettings, numeracion_factura_anio: num.serieAnio, numeracion_factura_siguiente: num.serieSiguiente };
          serieAnio = num.serieAnio;
          serieSiguienteFinal = num.serieSiguiente;
        }
      }
    }

    if (serieFactura === 'A' && serieAnio != null) {
      db.prepare(`
        UPDATE empresas SET numeracion_factura_anio = :anio,
          numeracion_factura_siguiente = :siguiente,
          actualizado_at = datetime('now') WHERE id = :id
      `).run({ ':anio': serieAnio, ':siguiente': serieSiguienteFinal, ':id': empresaId });
    }

    db.prepare(`
      UPDATE presupuestos SET estado = 'convertido', factura_id = :factura_id,
        updated_at = datetime('now') WHERE id = :id
    `).run({ ':factura_id': facturasCreadas[0].id, ':id': presupuesto_id });

    return {
      facturaId: facturasCreadas[0].id,
      facturaNumero: facturasCreadas[0].numero,
      facturas: facturasCreadas,
    };
  });
}

// Convertir proforma a factura normal (heredando datos de la proforma).
export function facturaConvertirProforma(proforma_id, opts) {
  const db = getDb();
  const p = db.prepare('SELECT * FROM facturas WHERE id = ?').get([proforma_id]);
  if (!p) throw new Error('Proforma no encontrada');
  if (p.deleted_at) throw new Error('Proforma eliminada');
  if (p.subtipo !== 'proforma') throw new Error('Esta factura no es una proforma');
  if (!p.cliente_id) throw new Error('La proforma no tiene cliente asignado');
  const ya = db.prepare(
    'SELECT id, numero FROM facturas WHERE proforma_origen_id = ? AND deleted_at IS NULL LIMIT 1',
  ).get([proforma_id]);
  if (ya) throw new Error(`Ya convertida en la factura ${ya.numero}. Borra esa primero si quieres re-convertir.`);
  const lineasP = db.prepare(
    'SELECT * FROM lineas_factura WHERE factura_id = ? ORDER BY orden ASC, id ASC',
  ).all([proforma_id]);
  if (lineasP.length === 0) throw new Error('La proforma no tiene lineas');
  const settings = getSettings();
  const empresaId = empresaActivaId();
  const yy = currentYear();
  const serieFactura = normalizeSerie(opts?.serie);
  const fechaFactura = (opts?.fecha && /^\d{4}-\d{2}-\d{2}$/.test(opts.fecha))
    ? opts.fecha : new Date().toISOString().slice(0, 10);
  let numero;
  let numeroForzado = false;
  if (opts?.numero != null && String(opts.numero).trim()) {
    const n = String(opts.numero).trim();
    const dup = db.prepare(
      'SELECT id FROM facturas WHERE numero = ? AND empresa_id = ? AND deleted_at IS NULL',
    ).get([n, empresaId]);
    if (dup) throw new Error(`Ya existe una factura con "${n}" en esta empresa.`);
    numero = n;
    numeroForzado = true;
  } else {
    numero = _siguienteNumeroFactura(serieFactura, settings, yy).numero;
  }
  return transaction(() => {
    const info = db.prepare(`
      INSERT INTO facturas (
        empresa_id, numero, serie, subtipo, fecha, ciudad_emision, cliente_id, asunto,
        iva_porcentaje, iva_incluido, irpf_pct, base_imponible, iva_importe,
        recargo_eq_importe, total, estado, presupuesto_id, modo_detallado,
        factura_ocultar_subitems, notas_publicas, marca_id, intracomunitario,
        descuento_tipo, descuento_valor, fecha_vencimiento, proforma_origen_id
      ) VALUES (
        :empresa_id, :numero, :serie, 'factura', :fecha, :ciudad, :cliente_id, :asunto,
        :iva, :iva_incluido, :irpf, 0, 0, 0, 0, 'borrador',
        :presupuesto_id, :modo_detallado, :ocultar_sub, :notas, :marca_id, :intracom,
        :dto_tipo, :dto_valor, :fecha_vto, :proforma_origen_id
      )
    `).run({
      ':empresa_id': empresaId, ':numero': numero, ':serie': serieFactura,
      ':fecha': fechaFactura, ':ciudad': p.ciudad_emision ?? null,
      ':cliente_id': p.cliente_id, ':asunto': p.asunto ?? null,
      ':iva': p.iva_porcentaje ?? 21, ':iva_incluido': p.iva_incluido ?? 1,
      ':irpf': p.irpf_pct ?? 0, ':presupuesto_id': p.presupuesto_id ?? null,
      ':modo_detallado': p.modo_detallado ? 1 : 0,
      ':ocultar_sub': p.factura_ocultar_subitems ? 1 : 0,
      ':notas': p.notas_publicas ?? null, ':marca_id': p.marca_id ?? null,
      ':intracom': p.intracomunitario ? 1 : 0,
      ':dto_tipo': p.descuento_tipo ?? 'pct', ':dto_valor': p.descuento_valor ?? 0,
      ':fecha_vto': p.fecha_vencimiento ?? null, ':proforma_origen_id': proforma_id,
    });
    const facturaId = info.lastInsertRowid;
    if (!numeroForzado && serieFactura === 'A') {
      const corr = _correlativoDe(numero);
      db.prepare(`
        UPDATE empresas SET numeracion_factura_anio = :anio,
          numeracion_factura_siguiente = :siguiente,
          actualizado_at = datetime('now') WHERE id = :id
      `).run({ ':anio': yy, ':siguiente': corr + 1, ':id': empresaId });
    }
    lineasP.forEach((l, i) => {
      const lInfo = db.prepare(`
        INSERT INTO lineas_factura (
          factura_id, orden, titulo, descripcion, cantidad, precio_unitario,
          importe, iva_pct, codigo, descuento_tipo, descuento_valor
        ) VALUES (
          :fid, :orden, :titulo, :desc, :cantidad, :precio,
          :importe, :iva_pct, :codigo, :dto_tipo, :dto_valor
        )
      `).run({
        ':fid': facturaId, ':orden': i, ':titulo': l.titulo ?? null,
        ':desc': l.descripcion ?? '', ':cantidad': l.cantidad ?? 1,
        ':precio': l.precio_unitario ?? 0, ':importe': round2(l.importe),
        ':iva_pct': l.iva_pct ?? null, ':codigo': l.codigo ?? null,
        ':dto_tipo': l.descuento_tipo ?? 'pct', ':dto_valor': l.descuento_valor ?? 0,
      });
      if (p.modo_detallado) {
        const subs = db.prepare(
          'SELECT * FROM sublineas_factura WHERE linea_id = ? ORDER BY orden ASC, id ASC',
        ).all([l.id]);
        subs.forEach((s, j) => {
          db.prepare(`
            INSERT INTO sublineas_factura (linea_id, orden, descripcion, cantidad, precio_unitario, importe)
            VALUES (:lid, :orden, :desc, :cantidad, :precio, :importe)
          `).run({
            ':lid': lInfo.lastInsertRowid, ':orden': j, ':desc': s.descripcion ?? '',
            ':cantidad': s.cantidad, ':precio': s.precio_unitario, ':importe': round2(s.importe),
          });
        });
      }
    });
    recalcularTotalesFactura(facturaId);
    return { facturaId, facturaNumero: numero, proformaId: proforma_id, proformaNumero: p.numero };
  });
}

// Importar lineas de un presupuesto a una factura ya existente (append).
export function facturaImportarLineasPresupuesto(factura_id, presupuesto_id) {
  const db = getDb();
  const f = db.prepare('SELECT * FROM facturas WHERE id = ?').get([factura_id]);
  if (!f) throw new Error('Factura no encontrada');
  if (f.deleted_at) throw new Error('Factura eliminada');
  if (f.estado !== 'borrador') throw new Error('Solo se pueden importar lineas a facturas en borrador');
  const p = db.prepare('SELECT * FROM presupuestos WHERE id = ?').get([presupuesto_id]);
  if (!p) throw new Error('Presupuesto no encontrado');
  if (p.deleted_at) throw new Error('Presupuesto eliminado');
  const lineasP = db.prepare(
    'SELECT * FROM lineas_presupuesto WHERE presupuesto_id = ? ORDER BY orden ASC, id ASC',
  ).all([presupuesto_id]);
  if (lineasP.length === 0) return { facturaId: factura_id, addedLineas: 0 };
  const maxOrden = db.prepare(
    'SELECT COALESCE(MAX(orden), -1) AS max_orden FROM lineas_factura WHERE factura_id = ?',
  ).get([factura_id]).max_orden;
  const copiarSubitems = !!f.modo_detallado && !!p.modo_detallado;
  return transaction(() => {
    lineasP.forEach((l, i) => {
      const titulo = (l.titulo && l.titulo.trim())
        || (l.descripcion ? l.descripcion.trim().slice(0, 80) : '') || '';
      const importe = round2(l.importe);
      const lInfo = db.prepare(`
        INSERT INTO lineas_factura (factura_id, orden, titulo, descripcion, cantidad, precio_unitario, importe)
        VALUES (:fid, :orden, :titulo, :desc, :cantidad, :precio, :importe)
      `).run({
        ':fid': factura_id, ':orden': maxOrden + 1 + i,
        ':titulo': titulo || null, ':desc': '', ':cantidad': 1,
        ':precio': importe, ':importe': importe,
      });
      if (copiarSubitems) {
        const subs = db.prepare(
          'SELECT * FROM sublineas_presupuesto WHERE linea_id = ? ORDER BY orden ASC, id ASC',
        ).all([l.id]);
        subs.forEach((s, j) => {
          db.prepare(`
            INSERT INTO sublineas_factura (linea_id, orden, descripcion, cantidad, precio_unitario, importe)
            VALUES (:lid, :orden, :desc, :cantidad, :precio, :importe)
          `).run({
            ':lid': lInfo.lastInsertRowid, ':orden': j, ':desc': s.descripcion ?? '',
            ':cantidad': s.cantidad, ':precio': s.precio_unitario, ':importe': round2(s.importe),
          });
        });
      }
    });
    recalcularTotalesFactura(factura_id);
    return { facturaId: factura_id, addedLineas: lineasP.length };
  });
}
