// v1.5.0 checkpoint 7: mount del namespace depositos.

import { overrideApi } from '../index.js';
import {
  depositosList, depositosGet, depositosCreate, depositosUpdate, depositosDelete,
  depositosStockActual, depositosMovimientosList,
  depositosMovimientosCreate, depositosMovimientosUpdate, depositosMovimientosDelete,
} from '../repository/depositos.js';

export default function mount() {
  overrideApi('depositos', {
    list: (opts) => depositosList(opts),
    get: (id) => depositosGet(id),
    create: (data) => depositosCreate(data),
    update: (id, data) => depositosUpdate(id, data),
    delete: (id) => depositosDelete(id),
    stockActual: (id) => depositosStockActual(id),
    movimientosList: (id) => depositosMovimientosList(id),
    movimientosCreate: (data) => depositosMovimientosCreate(data),
    movimientosUpdate: (id, data) => depositosMovimientosUpdate(id, data),
    movimientosDelete: (id) => depositosMovimientosDelete(id),
  });
}
