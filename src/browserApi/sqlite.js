// Shim: emula el API de node-sqlite3-wasm sobre sql.js.
//
// repository.cjs (portado al browser) espera este API 1:1:
//   const { Database } = require('node-sqlite3-wasm');
//   const db = new Database(path, opts);
//   const stmt = db.prepare(sql);
//   stmt.all([p1, p2])         -> array de filas
//   stmt.get([p1])             -> primera fila o undefined
//   stmt.run([p1, p2])         -> { changes, lastInsertRowid }
//   stmt.run({':col': val,...})-> params nombrados con prefijo ':'
//   stmt.finalize()
//   db.exec(sql)               -> multi-statement (BEGIN/COMMIT etc)
//   db.close()

import initSqlJs from 'sql.js';
// Import del .wasm como URL de asset gestionado por Vite. En dev sirve el
// fichero desde node_modules; en build lo copia a dist/assets/ con hash y
// cache-busting. Mas robusto que depender de `locateFile` + public/ porque:
//   1. No hay riesgo de colision con SPA rewrites (Vercel).
//   2. Cache immutable seguro (el hash cambia si el .wasm cambia).
//   3. Path resuelto por Vite: funciona igual en dev, preview y produccion.
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let SQL = null;
let sqlReadyPromise = null;

// Inicializa sql.js una vez. Devuelve la instancia global. Todos los usos
// posteriores usan la misma.
export function initSql() {
  if (sqlReadyPromise) return sqlReadyPromise;
  sqlReadyPromise = initSqlJs({
    locateFile: () => sqlWasmUrl,
  }).then((instance) => {
    SQL = instance;
    return instance;
  });
  return sqlReadyPromise;
}

// Convierte params estilo node-sqlite3-wasm al formato sql.js.
// - Array: se queda como array (sql.js soporta positional con ?)
// - Object con keys ':foo': sql.js soporta objetos con keys ':foo' tambien
// - undefined/null/vacio -> undefined (sql.js interpreta sin params)
function _normalizeParams(params) {
  if (params == null) return undefined;
  if (Array.isArray(params)) {
    if (params.length === 0) return undefined;
    return params.map((v) => (v === undefined ? null : v));
  }
  if (typeof params === 'object') {
    // Objeto {':col': val}. Convertir undefined a null.
    const out = {};
    for (const k of Object.keys(params)) {
      const v = params[k];
      out[k] = v === undefined ? null : v;
    }
    return out;
  }
  return undefined;
}

// Clase Statement — envuelve un stmt de sql.js
class Statement {
  constructor(db, sql) {
    this._db = db;
    this._sql = sql;
    this._stmt = db._raw.prepare(sql);
    this._finalized = false;
  }

  all(params) {
    if (this._finalized) throw new Error('Statement finalized');
    const p = _normalizeParams(params);
    this._stmt.reset();
    if (p !== undefined) this._stmt.bind(p);
    const rows = [];
    while (this._stmt.step()) rows.push(this._stmt.getAsObject());
    return rows;
  }

  get(params) {
    if (this._finalized) throw new Error('Statement finalized');
    const p = _normalizeParams(params);
    this._stmt.reset();
    if (p !== undefined) this._stmt.bind(p);
    if (this._stmt.step()) return this._stmt.getAsObject();
    return undefined;
  }

  run(params) {
    if (this._finalized) throw new Error('Statement finalized');
    const p = _normalizeParams(params);
    this._stmt.reset();
    if (p !== undefined) this._stmt.bind(p);
    // step() ejecuta el INSERT/UPDATE/DELETE
    this._stmt.step();
    const changes = this._db._raw.getRowsModified();
    // Para lastInsertRowid usamos SELECT last_insert_rowid()
    const res = this._db._raw.exec('SELECT last_insert_rowid() AS id');
    const lastInsertRowid = res.length && res[0].values.length
      ? res[0].values[0][0]
      : 0;
    return { changes, lastInsertRowid };
  }

  finalize() {
    if (this._finalized) return;
    try { this._stmt.free(); } catch { /* ignore */ }
    this._finalized = true;
  }
}

// Clase Database — envuelve una BD de sql.js con API de node-sqlite3-wasm
export class Database {
  // opts.fileMustExist se ignora en browser (siempre en memoria).
  // path se usa solo como identificador (persistencia gestionada aparte).
  constructor(path, opts) {
    if (!SQL) {
      throw new Error(
        'sql.js no inicializado. Llama a initSql() y await antes de instanciar Database.',
      );
    }
    // opts.data (Uint8Array) -> carga desde snapshot serializado
    if (opts && opts.data instanceof Uint8Array) {
      this._raw = new SQL.Database(opts.data);
    } else {
      this._raw = new SQL.Database();
    }
    this._path = path;
    this._closed = false;
  }

  prepare(sql) {
    if (this._closed) throw new Error('DB closed');
    return new Statement(this, sql);
  }

  exec(sql) {
    if (this._closed) throw new Error('DB closed');
    this._raw.exec(sql);
  }

  // No en API original pero util para persistencia: devuelve la BD como
  // Uint8Array. Ese blob es lo que guardamos en IndexedDB.
  export() {
    return this._raw.export();
  }

  close() {
    if (this._closed) return;
    try { this._raw.close(); } catch { /* ignore */ }
    this._closed = true;
  }
}
