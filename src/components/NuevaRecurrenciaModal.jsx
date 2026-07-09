// Modal de seleccion previa a crear una recurrencia desde /recurrencias.
// Pregunta sobre que factura/presupuesto se quiere recurrir y, al confirmar,
// devuelve { tipo, sourceId, sourceLabel } para que el padre abra
// RecurrenciaModal con esos datos. Asi la pagina /recurrencias permite
// crear recurrencias de cero sin tener que abrir antes el editor del
// documento modelo.

import { useEffect, useMemo, useState } from 'react';
import { FileText, Receipt, Search, X, ArrowRight, Package } from 'lucide-react';
import { useToast } from './Toast.jsx';
import { formatEUR, formatFechaES } from '../utils/format.js';

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';

function NuevaRecurrenciaModal({ onClose, onSelect, onChooseCatalogo }) {
  const toast = useToast();
  const [tipo, setTipo] = useState('factura');
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelectedId(null);
    (async () => {
      try {
        const list = tipo === 'factura'
          ? await window.api.facturas.list()
          : await window.api.presupuestos.list();
        if (!cancelled) setDocs(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) toast.error(e.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tipo, toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => {
      const numero = (d.numero || '').toLowerCase();
      const cliente = (d.cliente_nombre || '').toLowerCase();
      return numero.includes(q) || cliente.includes(q);
    });
  }, [docs, query]);

  function continuar() {
    const doc = docs.find((d) => d.id === selectedId);
    if (!doc) return;
    onSelect({
      tipo,
      sourceId: doc.id,
      sourceLabel: `${tipo === 'factura' ? 'Factura' : 'Presupuesto'} ${doc.numero || ''}`,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            Nueva recurrencia
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-auto">
          {onChooseCatalogo ? (
            <button
              type="button"
              onClick={onChooseCatalogo}
              className="w-full text-left p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-brand/5 hover:border-brand transition-colors flex items-start gap-3"
            >
              <Package size={18} className="text-brand mt-0.5" />
              <div>
                <div className="text-sm font-medium text-slate-800">
                  Recurrencia desde catálogo (servicios/productos)
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Elige un cliente y productos/servicios del catálogo, sin
                  necesidad de tener un documento previo. Útil para servicios
                  que repites a varios clientes (cuotas, mantenimientos…).
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-400 mt-1 shrink-0" />
            </button>
          ) : null}

          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-1">
            O desde un documento existente
          </div>
          <p className="text-sm text-slate-600">
            Elige la factura o presupuesto que quieras repetir periódicamente.
            Cada ciclo se generará un borrador clonando ese documento.
          </p>

          {/* Tabs tipo */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipo('factura')}
              className={
                'flex-1 px-3 py-2 rounded-lg border text-sm inline-flex items-center justify-center gap-2 transition-colors ' +
                (tipo === 'factura'
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')
              }
            >
              <Receipt size={15} /> Factura
            </button>
            <button
              type="button"
              onClick={() => setTipo('presupuesto')}
              className={
                'flex-1 px-3 py-2 rounded-lg border text-sm inline-flex items-center justify-center gap-2 transition-colors ' +
                (tipo === 'presupuesto'
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')
              }
            >
              <FileText size={15} /> Presupuesto
            </button>
          </div>

          {/* Buscador */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={inputCls + ' pl-9'}
              placeholder={`Buscar por numero o cliente…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* Lista */}
          <div className="border border-slate-200 rounded-lg max-h-72 overflow-auto">
            {loading ? (
              <div className="p-4 text-sm text-slate-500 text-center">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 text-center">
                {docs.length === 0
                  ? `Aun no tienes ${tipo === 'factura' ? 'facturas' : 'presupuestos'} que recurrir.`
                  : 'Sin resultados para tu busqueda.'}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtered.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(d.id)}
                      className={
                        'w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ' +
                        (selectedId === d.id
                          ? 'bg-brand/10'
                          : 'hover:bg-slate-50')
                      }
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">
                          {d.numero || '(sin numero)'}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {d.cliente_nombre || '(sin cliente)'} · {formatFechaES(d.fecha)}
                        </div>
                      </div>
                      <div className="text-sm tabular-nums text-slate-700">
                        {formatEUR(d.total || 0)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={continuar}
            disabled={!selectedId}
            className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            Continuar <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default NuevaRecurrenciaModal;
