// v1.5.0: mount de los namespaces relacionados con socios internos.

import { overrideApi } from '../index.js';
import {
  sociosList, sociosGet, sociosCreate, sociosUpdate, sociosDelete,
  pagosSocioList, pagosSocioCreate, pagosSocioUpdate, pagosSocioDelete,
  socioAjustesList, socioAjustesCreate, socioAjustesUpdate, socioAjustesDelete,
  socioCierresList, socioCierresUltimo, socioCierresCreate, socioCierresDelete,
  lineaFacturaSocioSetPct, gastoLineaSocioSetPct,
  lineaFacturaSociosList, gastoLineaSociosList,
  lineaFacturaSociosByFactura, gastoLineaSociosByGasto,
  informesSocio,
} from '../repository/socios.js';

export default function mount() {
  overrideApi('socios', {
    list: () => sociosList(),
    get: (id) => sociosGet(id),
    create: (data) => sociosCreate(data),
    update: (id, data) => sociosUpdate(id, data),
    delete: (id) => sociosDelete(id),
  });
  overrideApi('pagosSocio', {
    list: (opts) => pagosSocioList(opts),
    create: (data) => pagosSocioCreate(data),
    update: (id, data) => pagosSocioUpdate(id, data),
    delete: (id) => pagosSocioDelete(id),
  });
  overrideApi('socioAjustes', {
    list: (opts) => socioAjustesList(opts),
    create: (data) => socioAjustesCreate(data),
    update: (id, data) => socioAjustesUpdate(id, data),
    delete: (id) => socioAjustesDelete(id),
  });
  overrideApi('socioCierres', {
    list: (sid) => socioCierresList(sid),
    ultimo: (sid) => socioCierresUltimo(sid),
    create: (data) => socioCierresCreate(data),
    delete: (id) => socioCierresDelete(id),
  });
  overrideApi('lineaFacturaSocio', {
    setPct: (lid, sid, pct) => lineaFacturaSocioSetPct(lid, sid, pct),
    list: (lid) => lineaFacturaSociosList(lid),
    byFactura: (fid) => lineaFacturaSociosByFactura(fid),
  });
  overrideApi('gastoLineaSocio', {
    setPct: (lid, sid, pct) => gastoLineaSocioSetPct(lid, sid, pct),
    list: (lid) => gastoLineaSociosList(lid),
    byGasto: (gid) => gastoLineaSociosByGasto(gid),
  });
}

// Utilidad para que el informes mount pueda añadir informes.socio
export { informesSocio };
