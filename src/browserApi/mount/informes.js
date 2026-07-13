import { overrideApi } from '../index.js';
import {
  homeDashboard, homeStats, homeInforme, homeRecientes,
  fiscalResumen, fiscalDetalle, searchGlobal,
  dianaSaldoInicialGet, dianaSaldoInicialSet,
  pagosDianaList, pagosDianaCreate, pagosDianaUpdate, pagosDianaDelete,
  dianaAjustesList, dianaAjustesCreate, dianaAjustesUpdate, dianaAjustesDelete,
  dianaCierresList, dianaCierresUltimo, dianaCierresCreate, dianaCierresDelete,
  informesMarcas, informesMarcasDetalle, informesDiana,
} from '../repository/informes.js';
import { informesSocio } from '../repository/socios.js';

export default function mount() {
  overrideApi('home', {
    stats: () => homeStats(),
    dashboard: () => homeDashboard(),
    informe: (rango) => homeInforme(rango),
    recientes: (n) => homeRecientes(n),
  });
  overrideApi('fiscal', {
    resumen: (opts) => fiscalResumen(opts),
    detalle: (opts) => fiscalDetalle(opts),
  });
  overrideApi('search', {
    global: (q) => searchGlobal(q),
  });
  overrideApi('diana', {
    saldoInicialGet: () => dianaSaldoInicialGet(),
    saldoInicialSet: (v) => dianaSaldoInicialSet(v),
    ajustesList: (opts) => dianaAjustesList(opts),
    ajustesCreate: (data) => dianaAjustesCreate(data),
    ajustesUpdate: (id, data) => dianaAjustesUpdate(id, data),
    ajustesDelete: (id) => dianaAjustesDelete(id),
    cierresList: () => dianaCierresList(),
    cierresUltimo: () => dianaCierresUltimo(),
    cierresCreate: (data) => dianaCierresCreate(data),
    cierresDelete: (id) => dianaCierresDelete(id),
  });
  overrideApi('pagosDiana', {
    list: (opts) => pagosDianaList(opts),
    create: (data) => pagosDianaCreate(data),
    update: (id, data) => pagosDianaUpdate(id, data),
    delete: (id) => pagosDianaDelete(id),
  });
  overrideApi('informes', {
    marcas: (opts) => informesMarcas(opts),
    marcasDetalle: (opts) => informesMarcasDetalle(opts),
    diana: (opts) => informesDiana(opts),
    socio: (opts) => informesSocio(opts),
  });
  // Notif y recurrencias mantienen stubs vacios (aceptable en demo web).
}
