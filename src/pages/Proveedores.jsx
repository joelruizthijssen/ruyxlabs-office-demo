// Lista de proveedores. Patron paralelo a Clientes.jsx pero sin detalle
// (la edicion se hace en el mismo modal del listado). Click en una fila
// abre el modal de edicion.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Truck, Search, X, Pencil } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import ProveedorFormModal from '../components/ProveedorFormModal.jsx';

function Proveedores() {
  const toast = useToast();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      const hay = [p.nombre, p.nif, p.email, p.telefono, p.telefono_movil, p.ciudad]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  async function recargar() {
    if (!window.api?.proveedores) {
      setError('window.api no disponible. ¿Estás ejecutando dentro de Electron?');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await window.api.proveedores.list();
      if (res && res.error) setError(res.error);
      else setItems(res || []);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { recargar(); }, []);

  function abrirNuevo() {
    setEditing(null);
    setShowModal(true);
  }
  function abrirEditar(p) {
    setEditing(p);
    setShowModal(true);
  }

  function onSaved(guardado) {
    setShowModal(false);
    setEditing(null);
    recargar();
    toast.success(
      editing
        ? `Proveedor "${guardado.nombre}" actualizado`
        : `Proveedor "${guardado.nombre}" creado`,
    );
  }

  async function eliminar(id, nombre) {
    if (!confirm(`¿Eliminar el proveedor "${nombre}"? Los gastos antiguos lo conservan.`)) return;
    setError(null);
    try {
      const res = await window.api.proveedores.delete(id);
      if (res && res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      recargar();
      toast.success(`Proveedor "${nombre}" eliminado`);
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(e.message ?? String(e));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-slate-800">Proveedores</h1>
        <button
          onClick={abrirNuevo}
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={18} />
          Nuevo proveedor
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-4 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, NIF, email o ciudad…"
            className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-white"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Limpiar búsqueda"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        {loading && (
          <div className="px-6 py-4 text-slate-500">Cargando…</div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-5">
              <Truck size={36} />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              Aún no tienes proveedores
            </h3>
            <p className="text-slate-500 max-w-sm mb-6">
              Da de alta a tus proveedores habituales para autocompletar sus
              datos (NIF, IBAN, IVA) al registrar gastos.
            </p>
            <button
              onClick={abrirNuevo}
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-lg transition-colors font-medium"
            >
              <Plus size={18} />
              Crear mi primer proveedor
            </button>
          </div>
        )}

        {!loading && items.length > 0 && filtrados.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-500 text-sm">
            No hay proveedores que coincidan con "{query}".
          </div>
        )}

        {!loading && filtrados.map((p, idx) => (
          <div
            key={p.id}
            className={
              'flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer ' +
              (idx > 0 ? 'border-t border-slate-100' : '')
            }
            onClick={() => nav(`/proveedores/${p.id}`)}
          >
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-800">{p.nombre}</div>
              <div className="text-sm text-slate-500 mt-0.5">
                {[p.nif, p.email, p.telefono, p.ciudad].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); abrirEditar(p); }}
                title="Editar"
                className="p-2 rounded-lg text-slate-400 hover:bg-brand/10 hover:text-brand transition-colors"
              >
                <Pencil size={18} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); eliminar(p.id, p.nombre); }}
                title="Eliminar"
                className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <ProveedorFormModal
          proveedor={editing}
          onSaved={onSaved}
          onCancel={() => { setShowModal(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

export default Proveedores;
