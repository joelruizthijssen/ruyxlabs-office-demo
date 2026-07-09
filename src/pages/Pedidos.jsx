// Pagina "Pedidos a proveedores" — listado + boton de crear nuevo.
// Documento NO fiscal: sirve para mandar al proveedor la lista de cosas
// a pedir. Se descarga como PDF desde el editor.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ClipboardList } from 'lucide-react';
import { formatEUR } from '../utils/format.js';
import { useToast } from '../components/Toast.jsx';

const ESTADO_BADGE = {
  borrador: 'bg-slate-200 text-slate-700',
  enviado:  'bg-blue-100 text-blue-700',
  recibido: 'bg-emerald-100 text-emerald-700',
};

function Pedidos() {
  const nav = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function recargar() {
    if (!window.api?.pedidos) {
      setError('Esta aplicación debe ejecutarse desde Electron.');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await window.api.pedidos.list();
      if (res && res.error) setError(res.error);
      else setItems(res || []);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { recargar(); }, []);

  async function crear() {
    setError(null);
    try {
      const res = await window.api.pedidos.create();
      if (res && res.error) {
        setError(res.error);
        return;
      }
      nav(`/pedidos/${res.id}`);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }

  async function eliminar(id, numero) {
    if (!confirm(`¿Eliminar pedido ${numero}?`)) return;
    try {
      const res = await window.api.pedidos.delete(id);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(`Pedido ${numero} eliminado`);
      recargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800 flex items-center gap-3">
            <ClipboardList size={28} className="text-brand" />
            Pedidos
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Genera órdenes de pedido para enviar a tus proveedores.
          </p>
        </div>
        <button
          onClick={crear}
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={18} /> Nuevo pedido
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        {loading && <div className="px-6 py-4 text-slate-500">Cargando…</div>}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
              <ClipboardList size={36} />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              Todavía no has creado ningún pedido
            </h3>
            <p className="text-slate-500 max-w-sm mb-6">
              Crea un pedido para listar lo que vas a comprarle a un proveedor
              y mándaselo en PDF.
            </p>
            <button
              onClick={crear}
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-lg transition-colors font-medium"
            >
              <Plus size={18} /> Crear mi primer pedido
            </button>
          </div>
        )}

        {!loading && items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-6 py-3 font-medium">Número</th>
                <th className="px-6 py-3 font-medium">Fecha</th>
                <th className="px-6 py-3 font-medium">Proveedor</th>
                <th className="px-6 py-3 font-medium text-right">Total</th>
                <th className="px-6 py-3 font-medium">Estado</th>
                <th className="px-6 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{p.numero}</span>
                      {p.back_order_de_pedido_numero && (
                        <span
                          title={`Back-order generado al recibir ${p.back_order_de_pedido_numero}`}
                          className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium"
                        >
                          back-order de {p.back_order_de_pedido_numero}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-slate-600">{p.fecha}</td>
                  <td className="px-6 py-3 text-slate-700">
                    {p.proveedor || <span className="text-slate-400 italic">— sin proveedor</span>}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-800">
                    {formatEUR(p.total)}
                  </td>
                  <td className="px-6 py-3">
                    <span className={
                      'inline-block px-2.5 py-1 rounded-full text-xs font-medium ' +
                      (ESTADO_BADGE[p.estado] || ESTADO_BADGE.borrador)
                    }>
                      {p.estado}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => nav(`/pedidos/${p.id}`)}
                        className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        Abrir
                      </button>
                      <button
                        onClick={() => eliminar(p.id, p.numero)}
                        title="Eliminar"
                        className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Pedidos;
