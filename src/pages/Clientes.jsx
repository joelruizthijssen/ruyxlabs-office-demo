import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Users, UserPlus, Search, X, ChevronRight } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import ClienteFormModal from '../components/ClienteFormModal.jsx';

const TIPO_BADGE = {
  autonomo:   { label: 'Autónomo',   cls: 'bg-blue-100 text-blue-700'     },
  empresa:    { label: 'Empresa',    cls: 'bg-slate-100 text-slate-700'   },
  particular: { label: 'Particular', cls: 'bg-emerald-100 text-emerald-700' },
};

function Clientes() {
  const toast = useToast();
  const nav = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const clientesFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => {
      const haystack = [c.nombre, c.nombre_comercial, c.nif, c.email, c.telefono, c.telefono_movil]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [clientes, query]);

  async function recargar() {
    if (!window.api) {
      setError('window.api no disponible. ¿Estás ejecutando la app dentro de Electron?');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await window.api.clientes.list();
      if (res && res.error) {
        setError(res.error);
      } else {
        setClientes(res || []);
      }
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  function onSaved(creado) {
    setShowModal(false);
    recargar();
    toast.success(`Cliente "${creado.nombre}" creado`);
  }

  async function eliminar(id, nombre) {
    if (!confirm(`¿Eliminar el cliente "${nombre}"?`)) return;
    setError(null);
    try {
      const res = await window.api.clientes.delete(id);
      if (res && res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      recargar();
      toast.success(`Cliente "${nombre}" eliminado`);
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(e.message ?? String(e));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-slate-800">Clientes</h1>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={18} />
          Nuevo cliente
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {clientes.length > 0 && (
        <div className="mb-4 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, NIF, email o teléfono…"
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

        {!loading && clientes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-5">
              <Users size={36} />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              Tu agenda está vacía
            </h3>
            <p className="text-slate-500 max-w-sm mb-6">
              Los clientes son la base de tu trabajo: crea el primero para
              empezar a hacer presupuestos y facturas.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-lg transition-colors font-medium"
            >
              <UserPlus size={18} />
              Crear mi primer cliente
            </button>
          </div>
        )}

        {!loading && clientes.length > 0 && clientesFiltrados.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-500 text-sm">
            No hay clientes que coincidan con "{query}".
          </div>
        )}

        {!loading &&
          clientesFiltrados.map((c, idx) => {
            const badge = TIPO_BADGE[c.tipo] || TIPO_BADGE.empresa;
            return (
              <div
                key={c.id}
                className={
                  'flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer ' +
                  (idx > 0 ? 'border-t border-slate-100' : '')
                }
                onClick={() => nav(`/clientes/${c.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">{c.nombre}</span>
                    <span className={'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ' + badge.cls}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5">
                    {[c.nif, c.email, c.telefono].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      eliminar(c.id, c.nombre);
                    }}
                    title="Eliminar"
                    className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                  <ChevronRight size={18} className="text-slate-300" />
                </div>
              </div>
            );
          })}
      </div>

      {showModal && (
        <ClienteFormModal
          cliente={null}
          onSaved={onSaved}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export default Clientes;
