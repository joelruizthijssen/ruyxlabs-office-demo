import { overrideApi } from '../index.js';
import {
  facturasList, facturasGet, facturasCreate, facturasUpdate, facturasDelete,
  lineasFacturaList, lineasFacturaCreate, lineasFacturaUpdate, lineasFacturaDelete,
  lineasFacturaSetDianaPct, lineasFacturaReorder,
  presupuestoConvertirAFactura, facturaConvertirProforma, facturaImportarLineasPresupuesto,
} from '../repository/facturas.js';
import {
  presupuestosList, presupuestosGet, presupuestosCreate, presupuestosUpdate, presupuestosDelete,
  lineasPresupuestoList, lineasPresupuestoCreate, lineasPresupuestoUpdate,
  lineasPresupuestoDelete, lineasPresupuestoReorder,
} from '../repository/presupuestos.js';
import {
  sublineasList, sublineasCreate, sublineasUpdate, sublineasDelete, sublineasReorder,
} from '../repository/documentos.js';

export default function mount() {
  overrideApi('facturas', {
    list: () => facturasList(),
    get: (id) => facturasGet(id),
    create: (serie, subtipo) => facturasCreate(serie, subtipo),
    update: (id, data) => facturasUpdate(id, data),
    delete: (id) => facturasDelete(id),
    importarLineasPresupuesto: (fid, pid) => facturaImportarLineasPresupuesto(fid, pid),
    convertirProforma: (id, opts) => facturaConvertirProforma(id, opts),
  });

  overrideApi('lineasFactura', {
    list: (fid) => lineasFacturaList(fid),
    create: (fid, data) => lineasFacturaCreate(fid, data),
    update: (id, data) => lineasFacturaUpdate(id, data),
    delete: (id) => lineasFacturaDelete(id),
    reorder: (fid, ids) => lineasFacturaReorder(fid, ids),
    setDianaPct: (id, pct) => lineasFacturaSetDianaPct(id, pct),
  });

  overrideApi('presupuestos', {
    list: () => presupuestosList(),
    get: (id) => presupuestosGet(id),
    create: (serie) => presupuestosCreate(serie),
    update: (id, data) => presupuestosUpdate(id, data),
    delete: (id) => presupuestosDelete(id),
    convertirAFactura: (id, opts) => presupuestoConvertirAFactura(id, opts),
  });

  overrideApi('lineasPresupuesto', {
    list: (pid) => lineasPresupuestoList(pid),
    create: (pid, data) => lineasPresupuestoCreate(pid, data),
    update: (id, data) => lineasPresupuestoUpdate(id, data),
    delete: (id) => lineasPresupuestoDelete(id),
    reorder: (pid, ids) => lineasPresupuestoReorder(pid, ids),
  });

  overrideApi('sublineasFactura', {
    list: (lid) => sublineasList('factura', lid),
    create: (lid, data) => sublineasCreate('factura', lid, data),
    update: (id, data) => sublineasUpdate('factura', id, data),
    delete: (id) => sublineasDelete('factura', id),
    reorder: (lid, ids) => sublineasReorder('factura', lid, ids),
  });

  overrideApi('sublineasPresupuesto', {
    list: (lid) => sublineasList('presupuesto', lid),
    create: (lid, data) => sublineasCreate('presupuesto', lid, data),
    update: (id, data) => sublineasUpdate('presupuesto', id, data),
    delete: (id) => sublineasDelete('presupuesto', id),
    reorder: (lid, ids) => sublineasReorder('presupuesto', lid, ids),
  });
}
