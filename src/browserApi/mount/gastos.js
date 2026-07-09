import { overrideApi } from '../index.js';
import {
  gastosList, gastosGet, gastosCreate, gastosUpdate, gastosDelete,
  pagosGastoList, pagosGastoCreate, pagosGastoUpdate, pagosGastoDelete,
  gastosVencimientosList, gastosVencimientosCreate, gastosVencimientosUpdate, gastosVencimientosDelete,
} from '../repository/gastos.js';
import {
  proveedoresList, proveedoresGet, proveedoresCreate, proveedoresUpdate,
  proveedoresDelete, proveedoresDetalle,
} from '../repository/proveedores.js';

export default function mount() {
  overrideApi('gastos', {
    list: (opts) => gastosList(opts),
    get: (id) => gastosGet(id),
    create: (data) => gastosCreate(data),
    update: (id, data) => gastosUpdate(id, data),
    delete: (id) => gastosDelete(id),
  });
  overrideApi('pagosGasto', {
    list: (gid) => pagosGastoList(gid),
    create: (gid, data) => pagosGastoCreate(gid, data),
    update: (id, data) => pagosGastoUpdate(id, data),
    delete: (id) => pagosGastoDelete(id),
  });
  overrideApi('gastosVencimientos', {
    list: (gid) => gastosVencimientosList(gid),
    create: (gid, data) => gastosVencimientosCreate(gid, data),
    update: (id, data) => gastosVencimientosUpdate(id, data),
    delete: (id) => gastosVencimientosDelete(id),
  });
  overrideApi('proveedores', {
    list: () => proveedoresList(),
    get: (id) => proveedoresGet(id),
    create: (data) => proveedoresCreate(data),
    update: (id, data) => proveedoresUpdate(id, data),
    delete: (id) => proveedoresDelete(id),
    detalle: (id) => proveedoresDetalle(id),
  });
}
