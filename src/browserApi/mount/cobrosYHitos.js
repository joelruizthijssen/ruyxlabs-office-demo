import { overrideApi } from '../index.js';
import {
  cobrosList, cobrosCreate, cobrosUpdate, cobrosDelete,
  hitosPagoList, hitosPagoReplace,
} from '../repository/cobrosYHitos.js';

export default function mount() {
  overrideApi('cobros', {
    list: (fid) => cobrosList(fid),
    create: (fid, data) => cobrosCreate(fid, data),
    update: (id, data) => cobrosUpdate(id, data),
    delete: (id) => cobrosDelete(id),
  });
  overrideApi('hitosPago', {
    list: (pid) => hitosPagoList(pid),
    replace: (pid, hitos) => hitosPagoReplace(pid, hitos),
  });
}
