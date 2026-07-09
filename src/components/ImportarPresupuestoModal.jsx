// Modal para elegir un presupuesto del mismo cliente (o de cualquier cliente
// si la factura no tiene cliente todavia) y volcar sus lineas en la factura
// actual. Las lineas se anyaden al final (append) — no sustituyen las que ya
// existen.

import { useEffect, useMemo, useState } from 'react';
import { X, FileText, Search } from 'lucide-react';
import { formatEUR } from '../utils/format.js';

function ImportarPresupuestoModal({ clienteId, onConfirm, onCancel }) {
  const [presupuestos, setPresupuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCancel]);

  useEffect(() => {
    let cancelled = false;
    async function cargar() {
      try {
        const res = await window.api.presupuestos.list();
        if (cancelled) return;
        if (res && res.error) {
          setError(res.error);
          return;
        }
        setPresupuestos(Array.isArray(res) ? res : []);
      } catch (e) {
        if (!cancelled) setError(e.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    cargar();
    return () => { cancelled = true; };
  }, []);

  // Filtrar: solo presupuestos del mismo cliente (si se pasa clienteId), no
  // borrados y con al menos una linea (numero != null). Por defecto los
  // recientes primero.
  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const baseFiltro = (p) => {
      if (!p || p.deleted_at) return false;
      if (clienteId && p.cliente_id && Number(p.cliente_id) !== Number(clienteId)) {
        return false;
      }
      if (q) {
        const hay = `${p.numero || ''} ${p.cliente_nombre || ''} ${p.asunto || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    };
    return presupuestos.filter(baseFiltro).slice(0, 50);
  }, [presupuestos, query, clienteId]);

  async function aceptar() {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(selectedId);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">
            Importar líneas de un presupuesto
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700"
            title="Cancelar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 pb-3">
          {error && (
            <div className="mb-3 px-3 py-2 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por número, cliente o asunto..."
              autoFocus
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          {clienteId ? (
            <p className="text-xs text-slate-500 mb-2">
              Mostrando solo presupuestos del cliente actual.
            </p>
          ) : (
            <p className="text-xs text-slate-500 mb-2">
              La factura no tiene cliente todavía — se muestran todos los presupuestos.
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3">
          {loading ? (
            <div className="text-sm text-slate-500 py-6 text-center">Cargando…</div>
          ) : filtrados.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center">
              No hay presupuestos que coincidan.
            </div>
          ) : (
            <ul className="space-y-1">
              {filtrados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={
                      'w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-start gap-3 ' +
                      (selectedId === p.id
                        ? 'border-brand bg-brand/10'
                        : 'border-slate-200 hover:bg-slate-50')
                    }
                  >
                    <FileText
                      size={16}
                      className={'mt-1 ' + (selectedId === p.id ? 'text-brand' : 'text-slate-400')}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className={'font-medium ' + (selectedId === p.id ? 'text-brand' : 'text-slate-800')}>
                          {p.numero || '(sin número)'}
                        </span>
                        <span className="text-xs text-slate-500">{p.fecha}</span>
                      </div>
                      <div className="text-xs text-slate-600 truncate">
                        {p.cliente_nombre || 'Sin cliente'}
                        {p.asunto ? ` — ${p.asunto}` : ''}
                      </div>
                    </div>
                    <div className="text-sm font-medium text-slate-700 whitespace-nowrap">
                      {formatEUR(p.total)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-between items-center px-5 py-3 border-t border-slate-100">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={aceptar}
            disabled={!selectedId || submitting}
            className="px-5 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Importando…' : 'Importar líneas'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportarPresupuestoModal;
