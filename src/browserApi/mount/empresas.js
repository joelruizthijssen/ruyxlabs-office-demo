import { overrideApi } from '../index.js';
import {
  empresasList, empresasGet, empresasCreate, empresasUpdate,
  empresasSetActive, empresasDelete, empresasDuplicate, empresasInfo,
  empresasResetCorrelativo, empresasRenumerarBorradores,
} from '../repository/empresas.js';

export default function mount() {
  overrideApi('empresas', {
    list: () => empresasList(),
    get: (id) => empresasGet(id),
    create: (data) => empresasCreate(data),
    update: (id, data) => empresasUpdate(id, data),
    setActive: (id) => empresasSetActive(id),
    delete: (id) => empresasDelete(id),
    duplicate: (id) => empresasDuplicate(id),
    info: (id) => empresasInfo(id),
    resetCorrelativo: (id, tipo) => empresasResetCorrelativo(id, tipo),
    renumerarBorradores: (id, tipo) => empresasRenumerarBorradores(id, tipo),
  });
}
