import { overrideApi } from '../index.js';
import {
  productosList, productosGet, productosGetByCodigo, productosDetalle,
  productosCreate, productosUpdate, productosArchive, productosDelete,
} from '../repository/productos.js';
import {
  pedidosList, pedidosGet, pedidosCreate, pedidosUpdate, pedidosDelete,
  pedidoRecibir, lineasPedidoList, lineasPedidoCreate, lineasPedidoUpdate,
  lineasPedidoDelete,
} from '../repository/pedidos.js';

export default function mount() {
  overrideApi('productos', {
    list: (opts) => productosList(opts),
    get: (id) => productosGet(id),
    getByCodigo: (c) => productosGetByCodigo(c),
    detalle: (id, opts) => productosDetalle(id, opts),
    create: (data) => productosCreate(data),
    update: (id, data) => productosUpdate(id, data),
    archive: (id, on) => productosArchive(id, on),
    delete: (id) => productosDelete(id),
  });
  overrideApi('pedidos', {
    list: () => pedidosList(),
    get: (id) => pedidosGet(id),
    create: () => pedidosCreate(),
    update: (id, data) => pedidosUpdate(id, data),
    delete: (id) => pedidosDelete(id),
    recibir: (id, opts) => pedidoRecibir(id, opts),
  });
  overrideApi('lineasPedido', {
    list: (pid) => lineasPedidoList(pid),
    create: (pid, data) => lineasPedidoCreate(pid, data),
    update: (id, data) => lineasPedidoUpdate(id, data),
    delete: (id) => lineasPedidoDelete(id),
  });
}
