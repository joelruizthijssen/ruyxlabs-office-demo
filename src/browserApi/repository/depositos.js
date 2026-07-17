// v1.5.0 checkpoint 7: modulo depositos (stock en cliente-tienda).
// Puerto browser de depositos_* + movimientos_deposito_* + hooks internos.

import { getDb } from '../db.js';
import { empresaActivaId, empresaScope } from '../helpers.js';

export function depositosList(opts) {
  const db = getDb();
  const soloActivos = opts?.solo_activos !== false;
  const empresaId = empresaActivaId();
  return db.prepare(`
    SELECT d.*, c.nombre AS cliente_nombre
    FROM depositos d
    LEFT JOIN clientes c ON c.id = d.cliente_id
    WHERE d.empresa_id = ?
    ${soloActivos ? 'AND d.activo = 1' : ''}
    ORDER BY d.nombre ASC
  `).all([empresaId]);
}

export function depositosGet(id) {
  const db = getDb();
  // v1.5.1 (auditoria seguridad): scope por empresa activa.
  const sc = empresaScope('d');
  return db.prepare(`
    SELECT d.*, c.nombre AS cliente_nombre
    FROM depositos d
    LEFT JOIN clientes c ON c.id = d.cliente_id
    WHERE d.id = ?${sc.sql}
  `).get([id, ...sc.params]);
}

export function depositosCreate(data) {
  const db = getDb();
  if (!data?.cliente_id) return { error: 'El deposito debe estar asociado a un cliente' };
  if (!data?.nombre || !String(data.nombre).trim()) {
    return { error: 'El deposito necesita un nombre' };
  }
  const info = db.prepare(`
    INSERT INTO depositos (empresa_id, cliente_id, nombre, notas, activo)
    VALUES (:empresa_id, :cliente_id, :nombre, :notas, 1)
  `).run({
    ':empresa_id': empresaActivaId(),
    ':cliente_id': Number(data.cliente_id),
    ':nombre': String(data.nombre).trim(),
    ':notas': data.notas ?? null,
  });
  return depositosGet(info.lastInsertRowid);
}

export function depositosUpdate(id, data) {
  const db = getDb();
  const current = depositosGet(id);
  if (!current) return null;
  const m = { ...current, ...data };
  db.prepare(`
    UPDATE depositos SET
      cliente_id = :cliente_id,
      nombre = :nombre,
      notas = :notas,
      activo = :activo,
      updated_at = datetime('now')
    WHERE id = :id
  `).run({
    ':id': id,
    ':cliente_id': Number(m.cliente_id),
    ':nombre': String(m.nombre || '').trim() || 'Sin nombre',
    ':notas': m.notas ?? null,
    ':activo': m.activo ? 1 : 0,
  });
  return depositosGet(id);
}

export function depositosDelete(id) {
  const db = getDb();
  // v1.5.1 (auditoria seguridad): scope por empresa activa.
  const sc = empresaScope();
  db.prepare(`UPDATE depositos SET activo = 0, updated_at = datetime('now') WHERE id = ?${sc.sql}`)
    .run([id, ...sc.params]);
  return { ok: true };
}

// Stock actual agrupado por producto. Precio medio ponderado de las entradas.
export function depositosStockActual(depositoId) {
  const db = getDb();
  // v1.5.1 (auditoria seguridad): verificar deposito en empresa activa.
  if (!depositosGet(depositoId)) return [];
  return db.prepare(`
    SELECT
      m.producto_id,
      COALESCE(p.codigo, m.codigo)  AS codigo,
      COALESCE(p.nombre, m.concepto) AS concepto,
      SUM(m.cantidad_signed)         AS cantidad_actual,
      CASE
        WHEN SUM(CASE WHEN m.cantidad_signed > 0 THEN m.cantidad_signed ELSE 0 END) > 0
        THEN SUM(CASE WHEN m.cantidad_signed > 0 THEN m.cantidad_signed * m.precio_unitario ELSE 0 END)
           / SUM(CASE WHEN m.cantidad_signed > 0 THEN m.cantidad_signed ELSE 0 END)
        ELSE 0
      END AS precio_unitario_medio,
      p.nombre_en                    AS nombre_en
    FROM movimientos_deposito m
    LEFT JOIN productos p ON p.id = m.producto_id
    WHERE m.deposito_id = ?
    GROUP BY COALESCE(m.producto_id, m.codigo, m.concepto)
    HAVING SUM(m.cantidad_signed) <> 0
    ORDER BY concepto ASC
  `).all([depositoId]);
}

export function depositosMovimientosList(depositoId) {
  const db = getDb();
  // v1.5.1 (auditoria seguridad): verificar deposito en empresa activa.
  if (!depositosGet(depositoId)) return [];
  return db.prepare(`
    SELECT
      m.*,
      p.nombre AS producto_nombre,
      p.codigo AS producto_codigo,
      f.numero AS factura_numero
    FROM movimientos_deposito m
    LEFT JOIN productos p ON p.id = m.producto_id
    LEFT JOIN facturas f  ON f.id = m.factura_id
    WHERE m.deposito_id = ?
    ORDER BY m.fecha DESC, m.id DESC
  `).all([depositoId]);
}

export function depositosMovimientosCreate(data) {
  const db = getDb();
  if (!data?.deposito_id) return { error: 'Falta deposito_id' };
  // v1.5.1 (auditoria seguridad): verificar deposito en empresa activa.
  if (!depositosGet(data.deposito_id)) {
    return { error: 'Deposito no encontrado' };
  }
  const tipo = ['entrada', 'salida_factura', 'ajuste'].includes(data.tipo)
    ? data.tipo : 'entrada';
  const cantidad = Number(data.cantidad_signed);
  if (!Number.isFinite(cantidad) || cantidad === 0) {
    return { error: 'La cantidad debe ser un numero distinto de 0' };
  }
  const producto = data.producto_id
    ? db.prepare('SELECT codigo, nombre FROM productos WHERE id = ?').get([Number(data.producto_id)])
    : null;
  const info = db.prepare(`
    INSERT INTO movimientos_deposito (
      deposito_id, tipo, fecha, producto_id, codigo, concepto,
      cantidad_signed, precio_unitario, factura_id, albaran_id,
      linea_factura_id, notas
    ) VALUES (
      :deposito_id, :tipo, :fecha, :producto_id, :codigo, :concepto,
      :cantidad_signed, :precio_unitario, :factura_id, :albaran_id,
      :linea_factura_id, :notas
    )
  `).run({
    ':deposito_id': Number(data.deposito_id),
    ':tipo': tipo,
    ':fecha': data.fecha || new Date().toISOString().slice(0, 10),
    ':producto_id': data.producto_id ? Number(data.producto_id) : null,
    ':codigo': data.codigo || producto?.codigo || null,
    ':concepto': data.concepto || producto?.nombre || null,
    ':cantidad_signed': cantidad,
    ':precio_unitario': Number(data.precio_unitario) || 0,
    ':factura_id': data.factura_id ? Number(data.factura_id) : null,
    ':albaran_id': data.albaran_id ? Number(data.albaran_id) : null,
    ':linea_factura_id': data.linea_factura_id ? Number(data.linea_factura_id) : null,
    ':notas': data.notas ?? null,
  });
  return db.prepare('SELECT * FROM movimientos_deposito WHERE id = ?').get([info.lastInsertRowid]);
}

export function depositosMovimientosDelete(id) {
  const db = getDb();
  // v1.5.1 (auditoria seguridad): scope via depositos de empresa activa.
  const sc = empresaScope('d');
  const info = db.prepare(`
    DELETE FROM movimientos_deposito
    WHERE id = ? AND deposito_id IN (
      SELECT d.id FROM depositos d WHERE 1=1${sc.sql}
    )
  `).run([id, ...sc.params]);
  return { ok: info.changes > 0 };
}

// v1.5.1: editar cantidad, precio, fecha y notas de un movimiento manual.
// Solo aplica a 'entrada' y 'ajuste' — los 'salida_factura' se recalculan
// al modificar la factura origen.
export function depositosMovimientosUpdate(id, data) {
  const db = getDb();
  const sc = empresaScope('d');
  const mov = db.prepare(`
    SELECT m.* FROM movimientos_deposito m
    JOIN depositos d ON d.id = m.deposito_id
    WHERE m.id = ?${sc.sql}
  `).get([id, ...sc.params]);
  if (!mov) return { error: 'Movimiento no encontrado' };
  if (mov.tipo === 'salida_factura') {
    return { error: 'Este movimiento se genera desde una factura. Edita la factura.' };
  }
  const patch = {};
  if (data.cantidad_signed != null) {
    const c = Number(data.cantidad_signed);
    if (!Number.isFinite(c) || c === 0) return { error: 'La cantidad debe ser un numero distinto de 0' };
    patch.cantidad_signed = mov.tipo === 'entrada' ? Math.abs(c) : c;
  }
  if (data.precio_unitario != null) patch.precio_unitario = Number(data.precio_unitario) || 0;
  if (data.fecha != null) patch.fecha = data.fecha;
  if (data.notas !== undefined) patch.notas = data.notas ?? null;
  const keys = Object.keys(patch);
  if (keys.length === 0) return { ok: false, error: 'Nada que actualizar' };
  const setSQL = keys.map((k) => `${k} = :${k}`).join(', ');
  const params = {};
  keys.forEach((k) => { params[':' + k] = patch[k]; });
  params[':id'] = id;
  db.prepare(`UPDATE movimientos_deposito SET ${setSQL} WHERE id = :id`).run(params);
  return db.prepare('SELECT * FROM movimientos_deposito WHERE id = ?').get([id]);
}

// Auto-descuento al facturar. Idempotente por factura_id + filtrado por
// empresa_id (defense-in-depth multi-empresa).
export function depositosAplicarSalidaPorFactura(facturaId) {
  const db = getDb();
  const factura = db.prepare(
    'SELECT id, empresa_id, cliente_id FROM facturas WHERE id = ?',
  ).get([facturaId]);
  if (!factura || !factura.cliente_id) return;
  const deposito = db.prepare(`
    SELECT id FROM depositos
    WHERE cliente_id = ? AND empresa_id = ? AND activo = 1
    LIMIT 1
  `).get([factura.cliente_id, factura.empresa_id]);
  if (!deposito) return;
  const yaAplicado = db.prepare(
    'SELECT COUNT(*) AS c FROM movimientos_deposito WHERE factura_id = ?',
  ).get([facturaId]);
  if (yaAplicado?.c > 0) return;
  const lineas = db.prepare(`
    SELECT id, producto_id, codigo, titulo, cantidad, precio_unitario
    FROM lineas_factura
    WHERE factura_id = ? AND producto_id IS NOT NULL AND cantidad > 0
  `).all([facturaId]);
  if (lineas.length === 0) return;
  const fecha = new Date().toISOString().slice(0, 10);
  const insert = db.prepare(`
    INSERT INTO movimientos_deposito (
      deposito_id, tipo, fecha, producto_id, codigo, concepto,
      cantidad_signed, precio_unitario, factura_id, linea_factura_id, notas
    ) VALUES (
      :deposito_id, 'salida_factura', :fecha, :producto_id, :codigo, :concepto,
      :cantidad_signed, :precio_unitario, :factura_id, :linea_factura_id, :notas
    )
  `);
  for (const l of lineas) {
    insert.run({
      ':deposito_id': deposito.id,
      ':fecha': fecha,
      ':producto_id': l.producto_id,
      ':codigo': l.codigo,
      ':concepto': l.titulo,
      ':cantidad_signed': -Math.abs(Number(l.cantidad) || 0),
      ':precio_unitario': Number(l.precio_unitario) || 0,
      ':factura_id': facturaId,
      ':linea_factura_id': l.id,
      ':notas': 'Salida automatica al emitir factura',
    });
  }
}

export function depositosRevertirSalidaPorFactura(facturaId) {
  const db = getDb();
  db.prepare('DELETE FROM movimientos_deposito WHERE factura_id = ? AND tipo = ?')
    .run([facturaId, 'salida_factura']);
}
