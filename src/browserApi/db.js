// Puerto browser de electron/db.cjs.
// Mantiene el mismo schema y migraciones idempotentes, sobre sql.js (browser).
//
// Diferencias vs desktop:
//   - No hay filesystem: la BD vive en memoria y se serializa a IndexedDB
//     (persistence.js) tras cada mutacion (debounced).
//   - No hay Electron/app.getPath — sustituido por identificador logico.
//   - No hay applyStagingIfPresent (backup zip legacy) — irrelevante en demo.
//   - No hay openDatabaseWithRetry / cleanupOrphanLocks — no aplica en memoria.

import { Database, initSql } from './sqlite.js';
import { loadSnapshot } from './persistence.js';

let db = null;

export function getDb() {
  if (!db) throw new Error('db no inicializada. Llama a initDb() primero.');
  return db;
}

function _ensureColumn(table, columnName, ddl) {
  const stmt = db.prepare(`PRAGMA table_info(${table})`);
  const cols = stmt.all();
  stmt.finalize();
  if (!cols.find((c) => c.name === columnName)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function _runOnceAll(sql, params) {
  const s = db.prepare(sql);
  const r = params ? s.all(params) : s.all();
  s.finalize();
  return r;
}

function _runOnceGet(sql, params) {
  const s = db.prepare(sql);
  const r = params ? s.get(params) : s.get();
  s.finalize();
  return r;
}

function _detectarUniqueCompuesto(table) {
  try {
    const idxs = _runOnceAll(`PRAGMA index_list("${table}")`);
    for (const idx of idxs) {
      if (!idx.unique) continue;
      const cols = _runOnceAll(`PRAGMA index_info("${idx.name}")`);
      const colNames = cols.map((c) => c.name).sort().join(',');
      if (colNames === 'empresa_id,numero') return true;
    }
  } catch (e) {
    console.warn(`[db] detectarUniqueCompuesto(${table}) fallo:`, e && e.message);
  }
  return false;
}

export function isUniqueCompuestoNumero(table) {
  return _detectarUniqueCompuesto(table);
}

// Inicializa la BD. Si hay snapshot en IndexedDB con TTL vigente, la restaura.
// Si no, crea una nueva vacia y aplica todo el schema + migraciones.
// Devuelve el objeto db para uso inmediato.
export async function initDb() {
  await initSql();

  const snapshot = await loadSnapshot();
  if (snapshot && snapshot.data) {
    db = new Database('demo.db', { data: snapshot.data });
    // Aun con snapshot, ejecutamos migraciones por si el schema cambio entre
    // deploys. Son idempotentes.
    _runMigrations();
    return { db, restored: true };
  }

  db = new Database('demo.db');
  _runMigrations();
  return { db, restored: false };
}

function _runMigrations() {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = DELETE;');

  // --- Schema base ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      emisor_nombre TEXT,
      emisor_nif TEXT,
      emisor_direccion TEXT,
      emisor_telefono TEXT,
      emisor_email TEXT,
      emisor_iban TEXT,
      iva_default REAL DEFAULT 21,
      texto_legal TEXT,
      ciudad_emision TEXT DEFAULT 'Calonge',
      numeracion_factura_anio INTEGER,
      numeracion_factura_siguiente INTEGER DEFAULT 1,
      numeracion_presupuesto_anio INTEGER,
      numeracion_presupuesto_siguiente INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      nif TEXT,
      direccion TEXT,
      ciudad TEXT,
      cp TEXT,
      provincia TEXT,
      email TEXT,
      telefono TEXT,
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS facturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL,
      fecha TEXT NOT NULL,
      ciudad_emision TEXT,
      cliente_id INTEGER REFERENCES clientes(id),
      asunto TEXT,
      iva_porcentaje REAL DEFAULT 21,
      base_imponible REAL DEFAULT 0,
      iva_importe REAL DEFAULT 0,
      total REAL DEFAULT 0,
      estado TEXT DEFAULT 'borrador'
        CHECK (estado IN ('borrador','emitida','cobrada')),
      presupuesto_id INTEGER REFERENCES presupuestos(id),
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS lineas_factura (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      factura_id INTEGER NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
      orden INTEGER NOT NULL DEFAULT 0,
      descripcion TEXT NOT NULL,
      cantidad REAL DEFAULT 1,
      precio_unitario REAL DEFAULT 0,
      importe REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS presupuestos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL,
      fecha TEXT NOT NULL,
      ciudad_emision TEXT,
      cliente_id INTEGER REFERENCES clientes(id),
      asunto TEXT,
      iva_porcentaje REAL DEFAULT 21,
      base_imponible REAL DEFAULT 0,
      iva_importe REAL DEFAULT 0,
      total REAL DEFAULT 0,
      estado TEXT DEFAULT 'borrador'
        CHECK (estado IN ('borrador','enviado','aceptado','rechazado','convertido')),
      factura_id INTEGER REFERENCES facturas(id),
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS lineas_presupuesto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
      orden INTEGER NOT NULL DEFAULT 0,
      descripcion TEXT NOT NULL,
      cantidad REAL DEFAULT 1,
      precio_unitario REAL DEFAULT 0,
      importe REAL DEFAULT 0
    );
  `);

  // --- Migraciones idempotentes (paridad con desktop) ---
  _ensureColumn('lineas_presupuesto', 'titulo', 'titulo TEXT');
  _ensureColumn('lineas_factura', 'titulo', 'titulo TEXT');
  _ensureColumn('settings', 'brand_color', "brand_color TEXT DEFAULT '#1abc9c'");
  _ensureColumn('settings', 'logo_path', 'logo_path TEXT');
  _ensureColumn('settings', 'plantilla', "plantilla TEXT DEFAULT 'bandas'");
  _ensureColumn('settings', 'legal_aceptado_at', 'legal_aceptado_at TEXT');
  _ensureColumn('settings', 'marcar_borrador', 'marcar_borrador INTEGER DEFAULT 0');
  _ensureColumn('settings', 'emisor_cp', 'emisor_cp TEXT');
  _ensureColumn('settings', 'emisor_ciudad', 'emisor_ciudad TEXT');
  _ensureColumn('settings', 'emisor_provincia', 'emisor_provincia TEXT');
  _ensureColumn('settings', 'emisor_pais', 'emisor_pais TEXT');
  _ensureColumn('settings', 'emisor_swift', 'emisor_swift TEXT');
  _ensureColumn('facturas', 'notas_publicas', 'notas_publicas TEXT');
  _ensureColumn('presupuestos', 'modo_detallado', 'modo_detallado INTEGER DEFAULT 0');
  _ensureColumn('facturas', 'modo_detallado', 'modo_detallado INTEGER DEFAULT 0');
  _ensureColumn('presupuestos', 'iva_incluido', 'iva_incluido INTEGER DEFAULT 1');
  _ensureColumn('facturas', 'iva_incluido', 'iva_incluido INTEGER DEFAULT 1');
  _ensureColumn('lineas_presupuesto', 'iva_pct', 'iva_pct REAL');
  _ensureColumn('lineas_factura', 'iva_pct', 'iva_pct REAL');
  _ensureColumn('facturas', 'irpf_pct', 'irpf_pct REAL DEFAULT 0');
  _ensureColumn('facturas', 'serie', "serie TEXT DEFAULT 'A'");
  _ensureColumn('presupuestos', 'serie', "serie TEXT DEFAULT 'A'");
  _ensureColumn('settings', 'series_facturas', 'series_facturas TEXT');
  _ensureColumn('settings', 'series_presupuestos', 'series_presupuestos TEXT');
  _ensureColumn('settings', 'firma_path', 'firma_path TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS adjuntos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_type TEXT NOT NULL CHECK (parent_type IN ('factura','presupuesto')),
      parent_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime TEXT,
      size INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_adjuntos_parent ON adjuntos(parent_type, parent_id);
  `);

  _ensureColumn('settings', 'membrete_path', 'membrete_path TEXT');
  _ensureColumn('settings', 'membrete_layout', 'membrete_layout TEXT');
  _ensureColumn('settings', 'license_key', 'license_key TEXT');
  _ensureColumn('settings', 'license_email', 'license_email TEXT');
  _ensureColumn('settings', 'license_plan', 'license_plan TEXT');
  _ensureColumn('settings', 'license_validated_at', 'license_validated_at TEXT');
  _ensureColumn('settings', 'license_features', 'license_features TEXT');
  _ensureColumn('settings', 'trial_started_at', 'trial_started_at TEXT');
  _ensureColumn('settings', 'last_run_at', 'last_run_at TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS recurrencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK (tipo IN ('factura', 'presupuesto')),
      source_id INTEGER NOT NULL,
      periodicidad TEXT NOT NULL CHECK (periodicidad IN ('semanal','mensual','trimestral','anual')),
      proxima_fecha TEXT NOT NULL,
      activa INTEGER DEFAULT 1,
      ultimo_generado_id INTEGER,
      ultimo_generado_at TEXT,
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_recurrencias_tipo_source ON recurrencias(tipo, source_id);
    CREATE INDEX IF NOT EXISTS idx_recurrencias_proxima ON recurrencias(proxima_fecha) WHERE activa = 1;
  `);

  _ensureColumn('settings', 'smtp_host', 'smtp_host TEXT');
  _ensureColumn('settings', 'smtp_port', 'smtp_port INTEGER');
  _ensureColumn('settings', 'smtp_secure', 'smtp_secure INTEGER DEFAULT 1');
  _ensureColumn('settings', 'smtp_user', 'smtp_user TEXT');
  _ensureColumn('settings', 'smtp_password_encrypted', 'smtp_password_encrypted TEXT');
  _ensureColumn('settings', 'smtp_from_name', 'smtp_from_name TEXT');
  _ensureColumn('settings', 'email_asunto_factura', 'email_asunto_factura TEXT');
  _ensureColumn('settings', 'email_cuerpo_factura', 'email_cuerpo_factura TEXT');
  _ensureColumn('settings', 'email_asunto_presupuesto', 'email_asunto_presupuesto TEXT');
  _ensureColumn('settings', 'email_cuerpo_presupuesto', 'email_cuerpo_presupuesto TEXT');
  _ensureColumn('facturas', 'enviado_at', 'enviado_at TEXT');
  _ensureColumn('presupuestos', 'enviado_at', 'enviado_at TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS hitos_pago (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
      orden INTEGER NOT NULL DEFAULT 0,
      descripcion TEXT,
      importe_pct REAL DEFAULT 0,
      fecha_offset_dias INTEGER DEFAULT 0,
      notas TEXT,
      factura_id INTEGER REFERENCES facturas(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hitos_pago_presupuesto ON hitos_pago(presupuesto_id);

    CREATE TABLE IF NOT EXISTS cobros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      factura_id INTEGER NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
      fecha TEXT NOT NULL,
      importe REAL NOT NULL DEFAULT 0,
      metodo TEXT,
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cobros_factura ON cobros(factura_id);

    CREATE TABLE IF NOT EXISTS gastos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      proveedor TEXT,
      concepto TEXT,
      categoria TEXT,
      base_imponible REAL DEFAULT 0,
      iva_pct REAL DEFAULT 21,
      iva_importe REAL DEFAULT 0,
      total REAL DEFAULT 0,
      deducible INTEGER DEFAULT 1,
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha) WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS sublineas_presupuesto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linea_id INTEGER NOT NULL REFERENCES lineas_presupuesto(id) ON DELETE CASCADE,
      orden INTEGER NOT NULL DEFAULT 0,
      descripcion TEXT NOT NULL DEFAULT '',
      cantidad REAL,
      precio_unitario REAL,
      importe REAL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_sublineas_presupuesto_linea ON sublineas_presupuesto(linea_id);

    CREATE TABLE IF NOT EXISTS sublineas_factura (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linea_id INTEGER NOT NULL REFERENCES lineas_factura(id) ON DELETE CASCADE,
      orden INTEGER NOT NULL DEFAULT 0,
      descripcion TEXT NOT NULL DEFAULT '',
      cantidad REAL,
      precio_unitario REAL,
      importe REAL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_sublineas_factura_linea ON sublineas_factura(linea_id);
  `);

  // Fila de settings default
  const settingsCount = _runOnceGet('SELECT COUNT(*) AS c FROM settings');
  if (!settingsCount || settingsCount.c === 0) {
    const ins = db.prepare(`
      INSERT INTO settings (
        id, iva_default,
        numeracion_factura_anio, numeracion_factura_siguiente,
        numeracion_presupuesto_anio, numeracion_presupuesto_siguiente
      ) VALUES (
        1, 21,
        CAST(strftime('%Y','now') AS INTEGER), 1,
        CAST(strftime('%Y','now') AS INTEGER), 1
      )
    `);
    ins.run();
    ins.finalize();
  }

  // Multi-empresa
  db.exec(`
    CREATE TABLE IF NOT EXISTS empresas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT CHECK(tipo IN ('autonomo','empresa')) DEFAULT 'autonomo',
      nombre TEXT NOT NULL DEFAULT '',
      nif TEXT,
      direccion TEXT,
      emisor_cp TEXT,
      emisor_ciudad TEXT,
      emisor_provincia TEXT,
      telefono TEXT,
      email TEXT,
      iban TEXT,
      brand_color TEXT DEFAULT '#1abc9c',
      plantilla TEXT DEFAULT 'bandas',
      logo_path TEXT,
      firma_path TEXT,
      membrete_path TEXT,
      membrete_layout TEXT,
      iva_default REAL DEFAULT 21,
      ciudad_emision TEXT,
      texto_legal TEXT,
      series_facturas TEXT DEFAULT '[]',
      series_presupuestos TEXT DEFAULT '[]',
      numeracion_factura_anio INTEGER,
      numeracion_factura_siguiente INTEGER DEFAULT 1,
      numeracion_presupuesto_anio INTEGER,
      numeracion_presupuesto_siguiente INTEGER DEFAULT 1,
      tipo_negocio TEXT CHECK(tipo_negocio IN ('servicios','productos','mixto')) DEFAULT 'servicios',
      activa INTEGER DEFAULT 1,
      creado_at TEXT DEFAULT (datetime('now')),
      actualizado_at TEXT DEFAULT (datetime('now'))
    );
  `);

  _ensureColumn('settings', 'empresa_activa_id', 'empresa_activa_id INTEGER DEFAULT 1');
  _ensureColumn('settings', 'vista_combinada', 'vista_combinada INTEGER DEFAULT 0');
  _ensureColumn('clientes', 'empresa_id', 'empresa_id INTEGER DEFAULT 1');
  _ensureColumn('facturas', 'empresa_id', 'empresa_id INTEGER DEFAULT 1');
  _ensureColumn('presupuestos', 'empresa_id', 'empresa_id INTEGER DEFAULT 1');
  _ensureColumn('gastos', 'empresa_id', 'empresa_id INTEGER DEFAULT 1');
  _ensureColumn('recurrencias', 'empresa_id', 'empresa_id INTEGER DEFAULT 1');
  db.exec(`
    UPDATE clientes SET empresa_id = 1 WHERE empresa_id IS NULL;
    UPDATE facturas SET empresa_id = 1 WHERE empresa_id IS NULL;
    UPDATE presupuestos SET empresa_id = 1 WHERE empresa_id IS NULL;
    UPDATE gastos SET empresa_id = 1 WHERE empresa_id IS NULL;
    UPDATE recurrencias SET empresa_id = 1 WHERE empresa_id IS NULL;
  `);

  // Productos + marcas
  db.exec(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL DEFAULT 1,
      codigo TEXT,
      nombre TEXT NOT NULL DEFAULT '',
      descripcion TEXT,
      precio_unitario REAL DEFAULT 0,
      iva_pct REAL,
      unidad TEXT DEFAULT 'ud',
      archivado INTEGER DEFAULT 0,
      creado_at TEXT DEFAULT (datetime('now')),
      actualizado_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_productos_empresa ON productos(empresa_id) WHERE archivado = 0;
    CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(empresa_id, codigo) WHERE codigo IS NOT NULL;
  `);

  _ensureColumn('facturas', 'subtipo', "subtipo TEXT DEFAULT 'factura'");
  db.exec(`UPDATE facturas SET subtipo = 'factura' WHERE subtipo IS NULL;`);
  db.exec(`
    UPDATE facturas SET subtipo = 'nota_contado' WHERE subtipo = 'factura' AND numero LIKE 'NC-%';
    UPDATE facturas SET subtipo = 'proforma' WHERE subtipo = 'factura' AND numero LIKE 'PRO-%';
    UPDATE facturas SET subtipo = 'rectificativa' WHERE subtipo = 'factura' AND numero LIKE 'RECT-%';
  `);

  _ensureColumn('empresas', 'ocultar_emisor', 'ocultar_emisor INTEGER DEFAULT 0');
  _ensureColumn('empresas', 'emisor_pais', 'emisor_pais TEXT');
  _ensureColumn('empresas', 'emisor_swift', 'emisor_swift TEXT');
  _ensureColumn('empresas', 'nombre_comercial', 'nombre_comercial TEXT');
  _ensureColumn('facturas', 'factura_ocultar_subitems', 'factura_ocultar_subitems INTEGER DEFAULT 0');
  _ensureColumn('facturas', 'documento_interno', 'documento_interno INTEGER DEFAULT 0');

  _ensureColumn('clientes', 'tipo', "tipo TEXT DEFAULT 'empresa'");
  _ensureColumn('clientes', 'nombre_comercial', 'nombre_comercial TEXT');
  _ensureColumn('clientes', 'telefono_movil', 'telefono_movil TEXT');
  _ensureColumn('clientes', 'web', 'web TEXT');
  _ensureColumn('clientes', 'iban', 'iban TEXT');
  _ensureColumn('clientes', 'condiciones_pago', 'condiciones_pago TEXT');
  _ensureColumn('clientes', 'irpf_pct_default', 'irpf_pct_default REAL DEFAULT 0');
  _ensureColumn('clientes', 'contacto_persona', 'contacto_persona TEXT');
  _ensureColumn('clientes', 'observaciones_internas', 'observaciones_internas TEXT');
  db.exec(`
    UPDATE clientes SET tipo = 'autonomo'
    WHERE tipo IS NULL AND nif IS NOT NULL
      AND nif GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][A-Z]';
    UPDATE clientes SET tipo = 'empresa' WHERE tipo IS NULL;
  `);
  _ensureColumn('gastos', 'irpf_pct', 'irpf_pct REAL DEFAULT 0');
  _ensureColumn('gastos', 'irpf_importe', 'irpf_importe REAL DEFAULT 0');

  _ensureColumn('recurrencias', 'modo', "modo TEXT DEFAULT 'documento'");
  _ensureColumn('recurrencias', 'cliente_id', 'cliente_id INTEGER');
  _ensureColumn('recurrencias', 'tipo_doc', "tipo_doc TEXT DEFAULT 'factura'");
  db.exec(`
    UPDATE recurrencias SET modo = 'documento' WHERE modo IS NULL;
    UPDATE recurrencias SET tipo_doc = tipo WHERE tipo_doc IS NULL;
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurrencia_lineas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recurrencia_id INTEGER NOT NULL,
      producto_id INTEGER,
      titulo TEXT NOT NULL DEFAULT '',
      descripcion TEXT,
      cantidad REAL DEFAULT 1,
      precio_unitario REAL DEFAULT 0,
      iva_pct REAL DEFAULT 21,
      orden INTEGER DEFAULT 0,
      FOREIGN KEY (recurrencia_id) REFERENCES recurrencias(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_recurrencia_lineas_rec ON recurrencia_lineas(recurrencia_id);

    CREATE TABLE IF NOT EXISTS notificaciones_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL DEFAULT 1,
      kind TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'unread'
        CHECK (state IN ('unread','read','dismissed','snoozed')),
      snoozed_until TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(empresa_id, kind, entity_type, entity_id)
    );
    CREATE INDEX IF NOT EXISTS idx_notif_state_lookup ON notificaciones_state(empresa_id, state);
  `);

  _ensureColumn('settings', 'notif_dias_factura_sin_cobrar', 'notif_dias_factura_sin_cobrar INTEGER DEFAULT 30');
  _ensureColumn('settings', 'notif_dias_presupuesto_sin_respuesta', 'notif_dias_presupuesto_sin_respuesta INTEGER DEFAULT 14');
  _ensureColumn('settings', 'notif_dias_borrador_estancado', 'notif_dias_borrador_estancado INTEGER DEFAULT 7');
  _ensureColumn('settings', 'notif_dias_cierre_trimestral_aviso', 'notif_dias_cierre_trimestral_aviso INTEGER DEFAULT 30');
  _ensureColumn('settings', 'notif_disabled_kinds', "notif_disabled_kinds TEXT DEFAULT ''");

  db.exec(`
    CREATE TABLE IF NOT EXISTS marcas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL DEFAULT 1,
      nombre_comercial TEXT NOT NULL DEFAULT '',
      prefijo TEXT,
      logo_path TEXT,
      brand_color TEXT,
      archivada INTEGER DEFAULT 0,
      creado_at TEXT DEFAULT (datetime('now')),
      actualizado_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_marcas_empresa ON marcas(empresa_id) WHERE archivada = 0;
  `);
  _ensureColumn('productos', 'marca_id', 'marca_id INTEGER');
  _ensureColumn('productos', 'proveedor', 'proveedor TEXT');
  _ensureColumn('facturas', 'marca_id', 'marca_id INTEGER');
  _ensureColumn('presupuestos', 'marca_id', 'marca_id INTEGER');
  _ensureColumn('gastos', 'marca_id', 'marca_id INTEGER');
  _ensureColumn('clientes', 'recargo_equivalencia', 'recargo_equivalencia INTEGER DEFAULT 0');
  _ensureColumn('facturas', 'recargo_eq_importe', 'recargo_eq_importe REAL DEFAULT 0');
  _ensureColumn('productos', 'precio_compra', 'precio_compra REAL DEFAULT 0');
  _ensureColumn('productos', 'precio_venta', 'precio_venta REAL DEFAULT 0');
  db.exec(`
    UPDATE productos SET precio_venta = precio_unitario
    WHERE (precio_venta IS NULL OR precio_venta = 0) AND precio_unitario > 0;
  `);
  _ensureColumn('gastos', 'producto_codigo', 'producto_codigo TEXT');
  _ensureColumn('clientes', 'pais', "pais TEXT DEFAULT 'ES'");
  _ensureColumn('clientes', 'intracomunitario', 'intracomunitario INTEGER DEFAULT 0');
  _ensureColumn('clientes', 'vat_number', 'vat_number TEXT');
  _ensureColumn('clientes', 'vies_valido', 'vies_valido INTEGER');
  _ensureColumn('clientes', 'vies_checked_at', 'vies_checked_at TEXT');
  db.exec(`UPDATE clientes SET pais = 'ES' WHERE pais IS NULL OR pais = '';`);
  _ensureColumn('facturas', 'intracomunitario', 'intracomunitario INTEGER DEFAULT 0');

  for (const t of ['lineas_factura', 'lineas_presupuesto']) {
    _ensureColumn(t, 'descuento_tipo', "descuento_tipo TEXT DEFAULT 'pct'");
    _ensureColumn(t, 'descuento_valor', 'descuento_valor REAL DEFAULT 0');
    _ensureColumn(t, 'codigo', 'codigo TEXT');
  }
  for (const t of ['facturas', 'presupuestos']) {
    _ensureColumn(t, 'descuento_tipo', "descuento_tipo TEXT DEFAULT 'pct'");
    _ensureColumn(t, 'descuento_valor', 'descuento_valor REAL DEFAULT 0');
  }
  _ensureColumn('gastos', 'numero_factura_proveedor', 'numero_factura_proveedor TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS gasto_lineas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gasto_id INTEGER NOT NULL REFERENCES gastos(id) ON DELETE CASCADE,
      orden INTEGER NOT NULL DEFAULT 0,
      codigo TEXT,
      concepto TEXT,
      base_imponible REAL DEFAULT 0,
      iva_pct REAL DEFAULT 21
    );
    CREATE INDEX IF NOT EXISTS idx_gasto_lineas_gasto ON gasto_lineas(gasto_id);
  `);
  _ensureColumn('gasto_lineas', 'notas', 'notas TEXT');
  _ensureColumn('gasto_lineas', 'precio_unitario', 'precio_unitario REAL DEFAULT 0');
  _ensureColumn('gasto_lineas', 'cantidad', 'cantidad REAL DEFAULT 1');
  _ensureColumn('facturas', 'fecha_vencimiento', 'fecha_vencimiento TEXT');
  _ensureColumn('gastos', 'fecha_vencimiento', 'fecha_vencimiento TEXT');
  _ensureColumn('facturas', 'proforma_origen_id', 'proforma_origen_id INTEGER');
  _ensureColumn('cobros', 'mostrar_en_pdf', 'mostrar_en_pdf INTEGER DEFAULT 0');

  // v1.4.0 (sync desde app): titulo custom del documento. Cuando NO es NULL/
  // vacio, sustituye el titulo por defecto ("PROFORMA", "FACTURA", etc.) en
  // el PDF y en el listado. Aplica sobre todo a proformas (renombrar como
  // "Confirmacion de pedido" o "Factura Proforma" segun empresa).
  _ensureColumn('facturas', 'titulo_documento_override', 'titulo_documento_override TEXT');
  _ensureColumn('presupuestos', 'titulo_documento_override', 'titulo_documento_override TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER DEFAULT 1,
      numero TEXT NOT NULL,
      fecha TEXT NOT NULL,
      ciudad_emision TEXT,
      proveedor TEXT,
      notas TEXT,
      base_imponible REAL DEFAULT 0,
      iva_porcentaje REAL DEFAULT 21,
      iva_importe REAL DEFAULT 0,
      total REAL DEFAULT 0,
      estado TEXT DEFAULT 'borrador',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS lineas_pedido (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      orden INTEGER NOT NULL DEFAULT 0,
      titulo TEXT,
      descripcion TEXT,
      cantidad REAL DEFAULT 1,
      precio_unitario REAL DEFAULT 0,
      importe REAL DEFAULT 0,
      codigo TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_lineas_pedido_pedido ON lineas_pedido(pedido_id);
  `);

  _ensureColumn('lineas_pedido', 'iva_pct', 'iva_pct REAL');
  _ensureColumn('lineas_pedido', 'descuento_tipo', "descuento_tipo TEXT DEFAULT 'pct'");
  _ensureColumn('lineas_pedido', 'descuento_valor', 'descuento_valor REAL DEFAULT 0');
  _ensureColumn('pedidos', 'proveedor_id', 'proveedor_id INTEGER');
  _ensureColumn('gastos', 'pedido_origen_id', 'pedido_origen_id INTEGER');
  _ensureColumn('pedidos', 'back_order_de_pedido_id', 'back_order_de_pedido_id INTEGER');

  _ensureColumn('productos', 'tarifa_1', 'tarifa_1 REAL DEFAULT 0');
  _ensureColumn('productos', 'tarifa_2', 'tarifa_2 REAL DEFAULT 0');
  _ensureColumn('productos', 'tarifa_3', 'tarifa_3 REAL DEFAULT 0');
  _ensureColumn('productos', 'tarifa_4', 'tarifa_4 REAL DEFAULT 0');
  _ensureColumn('clientes', 'tarifa_aplicar', 'tarifa_aplicar INTEGER DEFAULT 0');
  _ensureColumn('productos', 'precio_compra_1', 'precio_compra_1 REAL DEFAULT 0');
  _ensureColumn('productos', 'precio_compra_2', 'precio_compra_2 REAL DEFAULT 0');
  _ensureColumn('productos', 'precio_compra_3', 'precio_compra_3 REAL DEFAULT 0');
  _ensureColumn('productos', 'precio_compra_4', 'precio_compra_4 REAL DEFAULT 0');

  db.exec(`
    CREATE TABLE IF NOT EXISTS diana_cierres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL DEFAULT 1,
      fecha TEXT NOT NULL,
      saldo_al_cierre REAL DEFAULT 0,
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_diana_cierres_empresa_fecha ON diana_cierres(empresa_id, fecha);
  `);

  _ensureColumn('clientes', 'descuento_pct_default', 'descuento_pct_default REAL DEFAULT 0');
  _ensureColumn('clientes', 'descuento_aplicar', "descuento_aplicar TEXT DEFAULT 'total'");
  _ensureColumn('marcas', 'incluir_en_informe', 'incluir_en_informe INTEGER DEFAULT 1');
  _ensureColumn('gastos', 'subtipo', "subtipo TEXT DEFAULT 'gasto'");
  _ensureColumn('gasto_lineas', 'descuento_tipo', "descuento_tipo TEXT DEFAULT 'pct'");
  _ensureColumn('gasto_lineas', 'descuento_valor', 'descuento_valor REAL DEFAULT 0');
  _ensureColumn('gastos', 'descuento_tipo', "descuento_tipo TEXT DEFAULT 'pct'");
  _ensureColumn('gastos', 'descuento_valor', 'descuento_valor REAL DEFAULT 0');

  db.exec(`
    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL DEFAULT 1,
      nombre TEXT NOT NULL DEFAULT '',
      nif TEXT,
      contacto_persona TEXT,
      email TEXT,
      telefono TEXT,
      telefono_movil TEXT,
      web TEXT,
      direccion TEXT,
      cp TEXT,
      ciudad TEXT,
      provincia TEXT,
      pais TEXT DEFAULT 'ES',
      iban TEXT,
      condiciones_pago TEXT,
      irpf_pct_default REAL DEFAULT 0,
      iva_pct_default REAL,
      notas TEXT,
      observaciones_internas TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_proveedores_empresa ON proveedores(empresa_id) WHERE deleted_at IS NULL;
  `);
  _ensureColumn('gastos', 'proveedor_id', 'proveedor_id INTEGER');
  _ensureColumn('proveedores', 'tarifa_aplicar', 'tarifa_aplicar INTEGER DEFAULT 0');
  _ensureColumn('empresas', 'tarifa_compra_1_label', 'tarifa_compra_1_label TEXT');
  _ensureColumn('empresas', 'tarifa_compra_2_label', 'tarifa_compra_2_label TEXT');
  _ensureColumn('empresas', 'tarifa_compra_3_label', 'tarifa_compra_3_label TEXT');
  _ensureColumn('empresas', 'tarifa_compra_4_label', 'tarifa_compra_4_label TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS pagos_gasto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gasto_id INTEGER NOT NULL REFERENCES gastos(id) ON DELETE CASCADE,
      fecha TEXT NOT NULL,
      importe REAL NOT NULL DEFAULT 0,
      metodo TEXT,
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pagos_gasto_gasto ON pagos_gasto(gasto_id);

    CREATE TABLE IF NOT EXISTS gastos_vencimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gasto_id INTEGER NOT NULL REFERENCES gastos(id) ON DELETE CASCADE,
      fecha TEXT NOT NULL,
      importe REAL NOT NULL DEFAULT 0,
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_gastos_venc_gasto ON gastos_vencimientos(gasto_id);
  `);
  _ensureColumn('pagos_gasto', 'vencimiento_id', 'vencimiento_id INTEGER');

  _ensureColumn('lineas_factura', 'diana_pct', 'diana_pct REAL DEFAULT 0');
  _ensureColumn('gasto_lineas', 'diana_pct', 'diana_pct REAL DEFAULT 0');

  db.exec(`
    CREATE TABLE IF NOT EXISTS pagos_diana (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL DEFAULT 1,
      fecha TEXT NOT NULL,
      importe REAL NOT NULL DEFAULT 0,
      notas TEXT,
      gasto_id INTEGER REFERENCES gastos(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pagos_diana_empresa_fecha ON pagos_diana(empresa_id, fecha);
  `);
  _ensureColumn('empresas', 'diana_saldo_inicial', 'diana_saldo_inicial REAL DEFAULT 0');

  db.exec(`
    CREATE TABLE IF NOT EXISTS diana_ajustes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL DEFAULT 1,
      fecha TEXT NOT NULL,
      concepto TEXT NOT NULL DEFAULT '',
      importe REAL NOT NULL DEFAULT 0,
      quien TEXT NOT NULL CHECK (quien IN ('D','E')),
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_diana_ajustes_empresa_fecha ON diana_ajustes(empresa_id, fecha);
  `);

  // v1.5.0: MULTI-SOCIO GENERALIZADO
  db.exec(`
    CREATE TABLE IF NOT EXISTS empresa_socios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL DEFAULT 1,
      nombre TEXT NOT NULL,
      orden INTEGER NOT NULL DEFAULT 0,
      saldo_inicial REAL DEFAULT 0,
      color TEXT,
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_empresa_socios_empresa
      ON empresa_socios(empresa_id) WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS linea_factura_socio (
      linea_id INTEGER NOT NULL REFERENCES lineas_factura(id) ON DELETE CASCADE,
      socio_id INTEGER NOT NULL REFERENCES empresa_socios(id) ON DELETE CASCADE,
      pct REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (linea_id, socio_id)
    );
    CREATE INDEX IF NOT EXISTS idx_linea_factura_socio_socio
      ON linea_factura_socio(socio_id);

    CREATE TABLE IF NOT EXISTS gasto_linea_socio (
      linea_id INTEGER NOT NULL REFERENCES gasto_lineas(id) ON DELETE CASCADE,
      socio_id INTEGER NOT NULL REFERENCES empresa_socios(id) ON DELETE CASCADE,
      pct REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (linea_id, socio_id)
    );
    CREATE INDEX IF NOT EXISTS idx_gasto_linea_socio_socio
      ON gasto_linea_socio(socio_id);

    CREATE TABLE IF NOT EXISTS pagos_socio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL DEFAULT 1,
      socio_id INTEGER NOT NULL REFERENCES empresa_socios(id) ON DELETE CASCADE,
      fecha TEXT NOT NULL,
      importe REAL NOT NULL DEFAULT 0,
      notas TEXT,
      gasto_id INTEGER REFERENCES gastos(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pagos_socio_empresa_fecha
      ON pagos_socio(empresa_id, fecha);

    CREATE TABLE IF NOT EXISTS socio_ajustes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL DEFAULT 1,
      socio_id INTEGER NOT NULL REFERENCES empresa_socios(id) ON DELETE CASCADE,
      fecha TEXT NOT NULL,
      concepto TEXT NOT NULL DEFAULT '',
      importe REAL NOT NULL DEFAULT 0,
      quien TEXT NOT NULL CHECK (quien IN ('S','U')),
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_socio_ajustes_empresa_fecha
      ON socio_ajustes(empresa_id, fecha);

    CREATE TABLE IF NOT EXISTS socio_cierres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL DEFAULT 1,
      socio_id INTEGER NOT NULL REFERENCES empresa_socios(id) ON DELETE CASCADE,
      fecha TEXT NOT NULL,
      saldo_al_cierre REAL DEFAULT 0,
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_socio_cierres_socio_fecha
      ON socio_cierres(socio_id, fecha);
  `);

  // --- Semilla minima para demo web ---
  // Solo si no existe empresa nº1 con datos (BD fresca). Marca legal como
  // aceptado y crea una empresa demo con datos plausibles, para que la app
  // arranque directa a Home sin modal legal ni wizard de setup.
  // El seed completo (clientes, facturas, gastos...) lo hara seed.js.
  const emp1 = _runOnceGet('SELECT nombre, nif FROM empresas WHERE id = 1');
  if (!emp1 || !emp1.nombre || !emp1.nif) {
    // Aceptar aviso legal
    db.prepare(`
      UPDATE settings SET legal_aceptado_at = datetime('now') WHERE id = 1
    `).run();
    // Empresa demo por defecto (id = 1)
    const existeEmp1 = _runOnceGet('SELECT id FROM empresas WHERE id = 1');
    if (existeEmp1) {
      db.prepare(`
        UPDATE empresas SET
          nombre = 'Consultoria Demo SL',
          nif = 'B12345678',
          direccion = 'Calle Ejemplo 123',
          emisor_cp = '08001',
          emisor_ciudad = 'Barcelona',
          emisor_provincia = 'Barcelona',
          emisor_pais = 'España',
          telefono = '900 123 456',
          email = 'hola@demo-ruyx.local',
          iban = 'ES1000000000000000000000',
          tipo = 'empresa',
          tipo_negocio = 'servicios',
          ciudad_emision = 'Barcelona',
          actualizado_at = datetime('now')
        WHERE id = 1
      `).run();
    } else {
      db.prepare(`
        INSERT INTO empresas (
          id, tipo, nombre, nif, direccion,
          emisor_cp, emisor_ciudad, emisor_provincia, emisor_pais,
          telefono, email, iban,
          tipo_negocio, ciudad_emision
        ) VALUES (
          1, 'empresa', 'Consultoria Demo SL', 'B12345678', 'Calle Ejemplo 123',
          '08001', 'Barcelona', 'Barcelona', 'España',
          '900 123 456', 'hola@demo-ruyx.local', 'ES1000000000000000000000',
          'servicios', 'Barcelona'
        )
      `).run();
    }
  }
}

// Utilidad para el shim de repository: emula _empresaActivaId leyendo settings.
export function empresaActivaId() {
  try {
    const s = _runOnceGet('SELECT empresa_activa_id FROM settings WHERE id = 1');
    return s?.empresa_activa_id || 1;
  } catch {
    return 1;
  }
}
