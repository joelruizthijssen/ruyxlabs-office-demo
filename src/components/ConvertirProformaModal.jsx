// Modal para convertir una factura proforma en una factura "normal".
// Genera una factura nueva con subtipo='factura' enlazada (proforma_origen_id)
// a la proforma origen. La proforma NO se elimina — queda como historico.
//
// El usuario puede:
//   - Elegir la serie (si la empresa tiene mas de una).
//   - Editar el numero (por defecto el siguiente correlativo automatico de
//     la serie). Si lo deja vacio, backend asigna el siguiente disponible.
//   - Elegir la fecha (default hoy).

import { useEffect, useState } from 'react';
import { X, ArrowRight, FileText } from 'lucide-react';

function ConvertirProformaModal({ proforma, series, defaultSerie, onConfirm, onCancel }) {
  const [serie, setSerie] = useState(defaultSerie || 'A');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !submitting) onCancel(); }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel, submitting]);

  async function aceptar() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({
        serie,
        numero: numero.trim() || undefined,
        fecha,
      });
    } catch (e) {
      setError(e?.message || String(e));
      setSubmitting(false);
    }
  }

  const tieneVariasSeries = Array.isArray(series) && series.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-brand/10 text-brand">
              <FileText size={18} />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              Convertir proforma a factura
            </h2>
          </div>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-700 disabled:opacity-50"
            title="Cancelar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
            Proforma origen
          </div>
          <div className="font-medium text-slate-800">{proforma?.numero}</div>
          {proforma?.cliente_nombre ? (
            <div className="text-slate-600 text-xs mt-0.5">
              {proforma.cliente_nombre}
            </div>
          ) : null}
        </div>

        {tieneVariasSeries ? (
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Serie de la factura
            </label>
            <select
              value={serie}
              onChange={(e) => setSerie(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.id} — {s.label}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Numero de factura
          </label>
          <input
            type="text"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="(automático: siguiente correlativo)"
            disabled={submitting}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <p className="text-xs text-slate-500 mt-1">
            Déjalo vacío y se asignará el siguiente número disponible automáticamente.
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Fecha de emisión
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        {error ? (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
            {error}
          </div>
        ) : null}

        <div className="text-xs text-slate-500 mb-4">
          La proforma <strong>{proforma?.numero}</strong> seguirá existiendo como
          histórico. La factura nueva se creará en estado borrador para que
          puedas revisarla antes de emitirla.
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={aceptar}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? 'Convirtiendo…' : 'Convertir a factura'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConvertirProformaModal;
