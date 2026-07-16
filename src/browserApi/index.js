// Punto de entrada del shim window.api para la demo web.
//
// Estrategia: se inicializa la BD (sql.js sobre memoria, con carga de
// IndexedDB si hay snapshot vigente), y se monta un window.api que:
//   1. Enruta metodos implementados a modulos concretos (settings, empresas, ...)
//   2. Los que aun no estan portados devuelven un stub vacio (array, null,
//      {ok:true}) para que la app no crashee.
//
// A medida que se van portando namespaces, se mueven de "STUBBED" a "REAL".

import { initDb, getDb, empresaActivaId } from './db.js';
import { createSaveDebouncer } from './persistence.js';

let ready = false;
let scheduleSave = () => {};

// Familias que devuelven array por defecto vs objeto vs null. Sirve para que
// los stubs no revienten codigo que espera .filter/.map o .propiedad.
const RETURN_ARRAY = 'array';
const RETURN_NULL = 'null';
const RETURN_OK = 'ok';

// Configuracion del contract completo. En cada metodo, si NO esta implementado
// aun, se resuelve con el shape indicado. Reflect construye el window.api.
const CONTRACT = {
  app: {
    licenseState: RETURN_OK,
    relaunch: RETURN_OK,
  },
  settings: {
    get: RETURN_NULL,
    update: RETURN_OK,
    acceptLegal: RETURN_OK,
    resetPrueba: RETURN_OK,
    setLogo: RETURN_OK,
    removeLogo: RETURN_OK,
    setFirma: RETURN_OK,
    removeFirma: RETURN_OK,
    setMembrete: RETURN_OK,
    removeMembrete: RETURN_OK,
  },
  notif: {
    listar: RETURN_ARRAY,
    countNoLeidas: 0,
    marcarLeida: RETURN_OK,
    marcarTodasLeidas: RETURN_OK,
    descartar: RETURN_OK,
    snooze: RETURN_OK,
  },
  recurrencias: {
    list: RETURN_ARRAY,
    pendientes: RETURN_ARRAY,
    forSource: RETURN_ARRAY,
    create: RETURN_OK,
    update: RETURN_OK,
    delete: RETURN_OK,
    generar: RETURN_OK,
    lineas: RETURN_ARRAY,
  },
  hitosPago: { list: RETURN_ARRAY, replace: RETURN_OK },
  cobros: { list: RETURN_ARRAY, create: RETURN_OK, update: RETURN_OK, delete: RETURN_OK },
  pagosGasto: { list: RETURN_ARRAY, create: RETURN_OK, update: RETURN_OK, delete: RETURN_OK },
  gastosVencimientos: { list: RETURN_ARRAY, create: RETURN_OK, update: RETURN_OK, delete: RETURN_OK },
  pagosDiana: { list: RETURN_ARRAY, create: RETURN_OK, update: RETURN_OK, delete: RETURN_OK },
  diana: {
    saldoInicialGet: 0,
    saldoInicialSet: RETURN_OK,
    ajustesList: RETURN_ARRAY,
    ajustesCreate: RETURN_OK,
    ajustesUpdate: RETURN_OK,
    ajustesDelete: RETURN_OK,
    cierresList: RETURN_ARRAY,
    cierresUltimo: RETURN_NULL,
    cierresCreate: RETURN_OK,
    cierresDelete: RETURN_OK,
  },
  proveedores: {
    list: RETURN_ARRAY, get: RETURN_NULL, create: RETURN_OK,
    update: RETURN_OK, delete: RETURN_OK, detalle: RETURN_NULL,
  },
  adjuntos: {
    list: RETURN_ARRAY, create: RETURN_OK, delete: RETURN_OK,
    open: RETURN_OK, saveAs: RETURN_OK,
  },
  home: {
    stats: RETURN_NULL, dashboard: RETURN_NULL,
    informe: RETURN_NULL, recientes: RETURN_ARRAY,
  },
  search: { global: RETURN_ARRAY },
  license: {
    activate: RETURN_OK, deactivate: RETURN_OK,
    revalidate: RETURN_OK, openRequest: RETURN_OK,
  },
  fiscal: { resumen: RETURN_NULL, detalle: RETURN_NULL },
  gastos: {
    list: RETURN_ARRAY, get: RETURN_NULL,
    create: RETURN_OK, update: RETURN_OK, delete: RETURN_OK,
  },
  clientes: {
    list: RETURN_ARRAY, create: RETURN_OK, get: RETURN_NULL,
    detalle: RETURN_NULL, update: RETURN_OK, delete: RETURN_OK,
    viesCheck: RETURN_OK,
  },
  presupuestos: {
    list: RETURN_ARRAY, get: RETURN_NULL, create: RETURN_OK,
    update: RETURN_OK, delete: RETURN_OK, convertirAFactura: RETURN_OK,
  },
  lineasPresupuesto: {
    list: RETURN_ARRAY, create: RETURN_OK, update: RETURN_OK,
    delete: RETURN_OK, reorder: RETURN_OK,
  },
  facturas: {
    list: RETURN_ARRAY, get: RETURN_NULL, create: RETURN_OK,
    update: RETURN_OK, delete: RETURN_OK,
    importarLineasPresupuesto: RETURN_OK, convertirProforma: RETURN_OK,
  },
  pedidos: {
    list: RETURN_ARRAY, get: RETURN_NULL, create: RETURN_OK,
    update: RETURN_OK, delete: RETURN_OK, recibir: RETURN_OK,
  },
  lineasPedido: {
    list: RETURN_ARRAY, create: RETURN_OK,
    update: RETURN_OK, delete: RETURN_OK,
  },
  empresas: {
    list: RETURN_ARRAY, get: RETURN_NULL, create: RETURN_OK,
    update: RETURN_OK, setActive: RETURN_OK, delete: RETURN_OK,
    duplicate: RETURN_OK, info: RETURN_NULL,
    resetCorrelativo: RETURN_OK, renumerarBorradores: RETURN_OK,
  },
  mig: { numeroLog: RETURN_ARRAY },
  productos: {
    list: RETURN_ARRAY, get: RETURN_NULL, getByCodigo: RETURN_NULL,
    detalle: RETURN_NULL, create: RETURN_OK, update: RETURN_OK,
    archive: RETURN_OK, delete: RETURN_OK,
  },
  marcas: {
    list: RETURN_ARRAY, get: RETURN_NULL, create: RETURN_OK,
    update: RETURN_OK, delete: RETURN_OK,
    setLogo: RETURN_OK, removeLogo: RETURN_OK,
  },
  informes: {
    marcas: RETURN_ARRAY, marcasDetalle: RETURN_NULL, diana: RETURN_NULL,
  },
  lineasFactura: {
    list: RETURN_ARRAY, create: RETURN_OK, update: RETURN_OK,
    delete: RETURN_OK, reorder: RETURN_OK, setDianaPct: RETURN_OK,
  },
  sublineasPresupuesto: {
    list: RETURN_ARRAY, create: RETURN_OK, update: RETURN_OK,
    delete: RETURN_OK, reorder: RETURN_OK,
  },
  sublineasFactura: {
    list: RETURN_ARRAY, create: RETURN_OK, update: RETURN_OK,
    delete: RETURN_OK, reorder: RETURN_OK,
  },
  pdf: {
    savePresupuesto: RETURN_OK, saveFactura: RETURN_OK, saveInforme: RETURN_OK,
  },
  backup: { export: RETURN_OK, import: RETURN_OK },
  holded: { saveXlsx: RETURN_OK },
  facturae: { saveXml: RETURN_OK },
  depositos: {
    list: RETURN_ARRAY, get: RETURN_NULL,
    create: RETURN_OK, update: RETURN_OK, delete: RETURN_OK,
    stockActual: RETURN_ARRAY,
    movimientosList: RETURN_ARRAY,
    movimientosCreate: RETURN_OK,
    movimientosDelete: RETURN_OK,
  },
};

function _stubReturnValue(shape) {
  if (shape === RETURN_ARRAY) return [];
  if (shape === RETURN_NULL) return null;
  if (shape === RETURN_OK) return { ok: true };
  return shape;
}

function _buildStubApi() {
  const api = {};
  for (const ns of Object.keys(CONTRACT)) {
    api[ns] = {};
    for (const method of Object.keys(CONTRACT[ns])) {
      const shape = CONTRACT[ns][method];
      api[ns][method] = async () => _stubReturnValue(shape);
    }
  }
  return api;
}

// Sobreescribe uno o mas metodos de window.api con implementaciones reales.
// Uso: overrideApi('clientes', { list: () => ..., create: (data) => ... })
export function overrideApi(namespace, impls) {
  if (!window.api) window.api = _buildStubApi();
  if (!window.api[namespace]) window.api[namespace] = {};
  for (const method of Object.keys(impls)) {
    const orig = impls[method];
    // Envolvemos en un debouncer de save si el metodo muta la BD.
    // Convencion: metodos que empiezan por create/update/delete/set/reset son
    // mutaciones — despues de ejecutarse programan un save().
    const isMutation = /^(create|update|delete|set|remove|reset|snooze|marcar|acceptLegal|activate|deactivate|revalidate|generar|replace|archive|renumerar|duplicate|convertir|importar|recibir)/i.test(method);
    window.api[namespace][method] = async (...args) => {
      const result = await orig(...args);
      if (isMutation) scheduleSave();
      return result;
    };
  }
}

// Boot: inicializa BD (con IndexedDB restore si aplica), monta window.api con
// stubs, y despues cada modulo real hace overrideApi().
export async function initBrowserApi() {
  if (ready) return;
  const { db, restored } = await initDb();
  scheduleSave = createSaveDebouncer(() => db, 500);
  window.api = _buildStubApi();
  ready = true;

  // Semilla realista SOLO si es BD fresca (sin restore). En restore la BD
  // ya tiene los datos del usuario y no se toca.
  if (!restored) {
    const { runSeed } = await import('./seed.js');
    const seedResult = runSeed();
    console.log('[browserApi] seed:', seedResult);
  }

  // Cargar modulos portados dinamicamente y aplicarlos.
  const mounts = await Promise.all([
    import('./mount/settings.js'),
    import('./mount/empresas.js'),
    import('./mount/clientes.js'),
    import('./mount/facturas.js'),
    import('./mount/cobrosYHitos.js'),
    import('./mount/marcas.js'),
    import('./mount/gastos.js'),
    import('./mount/productosPedidos.js'),
    import('./mount/informes.js'),
    import('./mount/socios.js'),
    import('./mount/depositos.js'),
    import('./mount/extras.js'),
  ]);
  for (const m of mounts) m.default();

  console.log('[browserApi] listo. Restaurado desde IndexedDB:', restored);
  return { restored };
}

// Convenience exports para los modulos de repository portados.
export { getDb, empresaActivaId };
