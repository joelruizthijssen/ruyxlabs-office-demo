import { overrideApi } from '../index.js';
import {
  marcasList, marcasGet, marcasCreate, marcasUpdate, marcasDelete,
  marcasSetLogo, marcasRemoveLogo,
} from '../repository/marcas.js';

export default function mount() {
  overrideApi('marcas', {
    list: (opts) => marcasList(opts),
    get: (id) => marcasGet(id),
    create: (data) => marcasCreate(data),
    update: (id, data) => marcasUpdate(id, data),
    delete: (id) => marcasDelete(id),
    setLogo: (id, buf, ext) => marcasSetLogo(id, buf, ext),
    removeLogo: (id) => marcasRemoveLogo(id),
  });
}
