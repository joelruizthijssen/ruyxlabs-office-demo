import { overrideApi } from '../index.js';
import {
  clientesList, clientesGet, clientesDetalle, clientesCreate,
  clientesUpdate, clientesDelete, clientesViesCheck,
} from '../repository/clientes.js';

export default function mount() {
  overrideApi('clientes', {
    list: () => clientesList(),
    get: (id) => clientesGet(id),
    detalle: (id) => clientesDetalle(id),
    create: (data) => clientesCreate(data),
    update: (id, data) => clientesUpdate(id, data),
    delete: (id) => clientesDelete(id),
    viesCheck: (args) => clientesViesCheck(args),
  });
}
