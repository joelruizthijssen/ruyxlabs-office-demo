// Puerto browser de pedidos_* y lineas_pedido_*.

import { getDb } from '../db.js';
import {
  empresaActivaId, empresaScope, round2, descuentoImporte, transaction, currentYear,
} from '../helpers.js';
import { getSettings } from './settings.js';
import { proveedoresGet } from './proveedores.js';
import { gastosCreate } from './gastos.js';

function _generarNumeroPedido(yy) {
  const db = getDb();
  const empresaId = empresaActivaId();
  const rows = db.prepare(
    `SELECT numero FROM pedidos WHERE empresa_id = ? AND numero LIKE ?`,
  ).all([empresaId, `PED-${yy}/%`]);
  let maxN = 0;
  for (const r of rows) {
    const m = /\/(\d+)$/.exec(r.numero || '');
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `PED-${yy}/${String(maxN + 1).padStart(2, '0')}`;
}

export function recalcularTotalesPedido(pedido_id) {
  const db = getDb();
  const p = db.prepare('SELECT iva_porcentaje FROM pedidos WHERE id = ?').get([pedido_id]);
  if (!p) return;
  const ivaCabecera = Number(p.iva_porcentaje) || 0;
  const lineas = db.prepare(
    `SELECT importe, iva_pct, descuento_tipo, descuento_valor FROM lineas_pedido WHERE pedido_id = ?`,
  ).all([pedido_id]);
  const buckets = new Map();
  for (const l of lineas) {
    const imp = Number(l.importe) || 0;
    const pct = (l.iva_pct == null || l.iva_pct === '') ? ivaCabecera : (Number(l.iva_pct) || 0);
    const dl = descuentoImporte(imp, l.descuento_tipo, l.descuento_valor);
    const net = round2(imp - dl);
    buckets.set(pct, (buckets.get(pct) || 0) + net);
  }
  let base = 0, iva = 0;
  for (const [pct, b] of buckets) {
    const bR = round2(b);
    base += bR;
    iva += round2((bR * pct) / 100);
  }
  base = round2(base); iva = round2(iva);
  const total = round2(base + iva);
  db.prepare(`
    UPDATE pedidos SET base_imponible = :base, iva_importe = :iva, total = :total,
      updated_at = datetime('now') WHERE id = :id
  `).run({ ':base': base, ':iva': iva, ':total': total, ':id': pedido_id });
}

export function pedidosList() {
  const db = getDb();
  const sc = empresaScope('p');
  return db.prepare(`
    SELECT p.id, p.numero, p.fecha, p.proveedor, p.proveedor_id, p.total, p.estado,
           p.back_order_de_pedido_id, bo.numero AS back_order_de_pedido_numero
    FROM pedidos p
    LEFT JOIN pedidos bo ON bo.id = p.back_order_de_pedido_id
    WHERE p.deleted_at IS NULL${sc.sql}
    ORDER BY p.fecha DESC, p.numero DESC
  `).all(sc.params);
}

export function pedidosGet(id) {
  const db = getDb();
  const p = db.prepare('SELECT * FROM pedidos WHERE id = ?').get([id]);
  if (!p) return null;
  const lineas = db.prepare(
    'SELECT * FROM lineas_pedido WHERE pedido_id = ? ORDER BY orden ASC, id ASC',
  ).all([id]);
  let gasto_generado = null, back_order_de = null;
  const g = db.prepare(
    'SELECT id, fecha, total FROM gastos WHERE pedido_origen_id = ? AND deleted_at IS NULL LIMIT 1',
  ).get([id]);
  if (g) gasto_generado = g;
  if (p.back_order_de_pedido_id) {
    const o = db.prepare(
      'SELECT id, numero FROM pedidos WHERE id = ? AND deleted_at IS NULL',
    ).get([p.back_order_de_pedido_id]);
    if (o) back_order_de = { pedido_id: o.id, pedido_numero: o.numero };
  }
  return { ...p, lineas, gasto_generado, back_order_de };
}

export function pedidosCreate() {
  const db = getDb();
  const settings = getSettings();
  const empresaId = empresaActivaId();
  const yy = currentYear();
  const fecha = new Date().toISOString().slice(0, 10);
  const numero = _generarNumeroPedido(yy);
  const info = db.prepare(`
    INSERT INTO pedidos (empresa_id, numero, fecha, ciudad_emision, iva_porcentaje, estado)
    VALUES (:empresa_id, :numero, :fecha, :ciudad, :iva, 'borrador')
  `).run({
    ':empresa_id': empresaId, ':numero': numero, ':fecha': fecha,
    ':ciudad': settings.ciudad_emision ?? null,
    ':iva': settings.iva_default ?? 21,
  });
  return { id: info.lastInsertRowid, numero };
}

export function pedidosUpdate(id, data) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM pedidos WHERE id = ?').get([id]);
  if (!current) return null;
  const m = { ...current, ...data };
  let proveedorTexto = m.proveedor ?? null;
  let proveedorIdNuevo = m.proveedor_id ?? null;
  if (data?.proveedor_id) {
    const pv = proveedoresGet(Number(data.proveedor_id));
    if (pv?.nombre) {
      proveedorTexto = pv.nombre;
      proveedorIdNuevo = Number(data.proveedor_id);
    }
  }
  db.prepare(`
    UPDATE pedidos SET numero = :numero, fecha = :fecha, ciudad_emision = :ciudad,
      proveedor = :proveedor, proveedor_id = :proveedor_id, notas = :notas,
      iva_porcentaje = :iva, estado = :estado, updated_at = datetime('now')
    WHERE id = :id
  `).run({
    ':id': id, ':numero': m.numero || current.numero,
    ':fecha': m.fecha, ':ciudad': m.ciudad_emision ?? null,
    ':proveedor': proveedorTexto, ':proveedor_id': proveedorIdNuevo,
    ':notas': m.notas ?? null, ':iva': Number(m.iva_porcentaje) || 0,
    ':estado': m.estado || 'borrador',
  });
  recalcularTotalesPedido(id);
  return pedidosGet(id);
}

export function pedidosDelete(id) {
  const db = getDb();
  db.prepare(`UPDATE pedidos SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`)
    .run([id]);
  return { ok: true };
}

export function lineasPedidoList(pedido_id) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM lineas_pedido WHERE pedido_id = ? ORDER BY orden ASC, id ASC',
  ).all([pedido_id]);
}

export function lineasPedidoCreate(pedido_id, data) {
  const db = getDb();
  const next = db.prepare(
    'SELECT COALESCE(MAX(orden), -1) AS m FROM lineas_pedido WHERE pedido_id = ?',
  ).get([pedido_id]);
  const cant = Number(data?.cantidad ?? 1) || 1;
  const precio = Number(data?.precio_unitario ?? 0) || 0;
  const imp = data?.importe != null ? round2(data.importe) : round2(cant * precio);
  const info = db.prepare(`
    INSERT INTO lineas_pedido (
      pedido_id, orden, titulo, descripcion, cantidad, precio_unitario,
      importe, codigo, iva_pct, descuento_tipo, descuento_valor
    ) VALUES (
      :pid, :orden, :titulo, :desc, :cant, :precio, :imp, :codigo, :iva, :dtipo, :dvalor
    )
  `).run({
    ':pid': pedido_id, ':orden': (next?.m ?? -1) + 1,
    ':titulo': data?.titulo ?? null, ':desc': data?.descripcion ?? '',
    ':cant': cant, ':precio': precio, ':imp': imp,
    ':codigo': data?.codigo ?? null,
    ':iva': (data?.iva_pct == null || data?.iva_pct === '') ? null : Number(data.iva_pct),
    ':dtipo': data?.descuento_tipo === 'eur' ? 'eur' : 'pct',
    ':dvalor': Number(data?.descuento_valor) || 0,
  });
  recalcularTotalesPedido(pedido_id);
  return db.prepare('SELECT * FROM lineas_pedido WHERE id = ?').get([info.lastInsertRowid]);
}

export function lineasPedidoUpdate(id, data) {
  const db = getDb();
  const cur = db.prepare('SELECT * FROM lineas_pedido WHERE id = ?').get([id]);
  if (!cur) return null;
  const m = { ...cur, ...data };
  const cant = Number(m.cantidad ?? 1) || 1;
  const precio = Number(m.precio_unitario ?? 0) || 0;
  const imp = data?.importe != null ? round2(data.importe) : round2(cant * precio);
  db.prepare(`
    UPDATE lineas_pedido SET titulo = :titulo, descripcion = :desc,
      cantidad = :cant, precio_unitario = :precio, importe = :imp,
      codigo = :codigo, iva_pct = :iva,
      descuento_tipo = :dtipo, descuento_valor = :dvalor WHERE id = :id
  `).run({
    ':id': id, ':titulo': m.titulo ?? null, ':desc': m.descripcion ?? '',
    ':cant': cant, ':precio': precio, ':imp': imp,
    ':codigo': m.codigo ?? null,
    ':iva': (m.iva_pct == null || m.iva_pct === '') ? null : Number(m.iva_pct),
    ':dtipo': m.descuento_tipo === 'eur' ? 'eur' : 'pct',
    ':dvalor': Number(m.descuento_valor) || 0,
  });
  recalcularTotalesPedido(cur.pedido_id);
  return db.prepare('SELECT * FROM lineas_pedido WHERE id = ?').get([id]);
}

export function lineasPedidoDelete(id) {
  const db = getDb();
  const cur = db.prepare('SELECT pedido_id FROM lineas_pedido WHERE id = ?').get([id]);
  if (!cur) return { ok: false };
  db.prepare('DELETE FROM lineas_pedido WHERE id = ?').run([id]);
  recalcularTotalesPedido(cur.pedido_id);
  return { ok: true };
}

export function pedidoRecibir(pedido_id, opts) {
  const db = getDb();
  const p = db.prepare('SELECT * FROM pedidos WHERE id = ?').get([pedido_id]);
  if (!p) throw new Error('Pedido no encontrado');
  if (p.deleted_at) throw new Error('Pedido eliminado');
  if (p.estado === 'recibido') throw new Error('Este pedido ya esta marcado como recibido');
  const lineas = db.prepare(
    'SELECT * FROM lineas_pedido WHERE pedido_id = ? ORDER BY orden ASC, id ASC',
  ).all([pedido_id]);
  if (lineas.length === 0) throw new Error('El pedido no tiene lineas');
  const recMap = new Map();
  for (const r of (opts?.recepciones || [])) {
    recMap.set(Number(r.linea_id), Math.max(0, Number(r.cantidad_recibida) || 0));
  }
  const fechaGasto = (opts?.fecha_gasto && /^\d{4}-\d{2}-\d{2}$/.test(opts.fecha_gasto))
    ? opts.fecha_gasto : new Date().toISOString().slice(0, 10);
  const lineasGasto = [], lineasBackorder = [];
  for (const l of lineas) {
    const cantTotal = Number(l.cantidad) || 0;
    const cantRec = recMap.has(l.id) ? recMap.get(l.id) : cantTotal;
    const precio = Number(l.precio_unitario) || 0;
    if (cantRec > 0) {
      // v1.5.5: copiar iva_pct por linea, descuento_tipo/valor del pedido,
      // y aplicar diana_pct_default de opts a todas las lineas.
      const ivaLinea = l.iva_pct != null
        ? Number(l.iva_pct)
        : (Number(p.iva_porcentaje) || 0);
      lineasGasto.push({
        concepto: l.titulo || l.descripcion || '—',
        cantidad: cantRec, precio_unitario: precio,
        base_imponible: round2(cantRec * precio),
        iva_pct: ivaLinea,
        codigo: l.codigo || null,
        descuento_tipo: l.descuento_tipo || 'pct',
        descuento_valor: Number(l.descuento_valor) || 0,
        diana_pct: Number(opts?.diana_pct_default) || 0,
      });
    }
    const cantFalta = round2(cantTotal - cantRec);
    if (cantFalta > 0) {
      lineasBackorder.push({
        titulo: l.titulo, descripcion: l.descripcion,
        cantidad: cantFalta, precio_unitario: precio, codigo: l.codigo,
      });
    }
  }
  if (lineasGasto.length === 0) {
    throw new Error('No has marcado ninguna cantidad recibida. Marca al menos una linea o cancela.');
  }
  return transaction(() => {
    const g = gastosCreate({
      fecha: fechaGasto,
      proveedor: p.proveedor ?? null, proveedor_id: p.proveedor_id ?? null,
      concepto: `Pedido ${p.numero}`, categoria: null,
      notas: p.notas ?? null, lineas: lineasGasto,
    });
    if (!g || g.error) throw new Error(g?.error || 'Error creando el gasto');
    db.prepare('UPDATE gastos SET pedido_origen_id = ? WHERE id = ?')
      .run([pedido_id, g.id]);
    let backorderId = null, backorderNumero = null;
    if (lineasBackorder.length > 0) {
      const created = pedidosCreate();
      backorderId = created.id;
      backorderNumero = created.numero;
      db.prepare(`
        UPDATE pedidos SET proveedor = :proveedor, proveedor_id = :proveedor_id,
          notas = :notas, iva_porcentaje = :iva, back_order_de_pedido_id = :origen,
          updated_at = datetime('now') WHERE id = :id
      `).run({
        ':id': backorderId,
        ':proveedor': p.proveedor ?? null, ':proveedor_id': p.proveedor_id ?? null,
        ':notas': `Back-order del pedido ${p.numero} (cantidades pendientes).${p.notas ? '\n\n' + p.notas : ''}`,
        ':iva': Number(p.iva_porcentaje) || 0, ':origen': pedido_id,
      });
      lineasBackorder.forEach((bl, i) => {
        const imp = round2((Number(bl.cantidad) || 0) * (Number(bl.precio_unitario) || 0));
        db.prepare(`
          INSERT INTO lineas_pedido (pedido_id, orden, titulo, descripcion, cantidad, precio_unitario, importe, codigo)
          VALUES (:pid, :orden, :titulo, :desc, :cant, :precio, :imp, :codigo)
        `).run({
          ':pid': backorderId, ':orden': i,
          ':titulo': bl.titulo ?? null, ':desc': bl.descripcion ?? '',
          ':cant': bl.cantidad, ':precio': bl.precio_unitario, ':imp': imp,
          ':codigo': bl.codigo ?? null,
        });
      });
      recalcularTotalesPedido(backorderId);
    }
    db.prepare(`UPDATE pedidos SET estado = 'recibido', updated_at = datetime('now') WHERE id = :id`)
      .run({ ':id': pedido_id });
    return {
      gastoId: g.id, backorderPedidoId: backorderId, backorderPedidoNumero: backorderNumero,
    };
  });
}
