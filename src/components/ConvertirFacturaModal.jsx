// Modal para elegir como convertir un presupuesto en factura. 3 modos:
//
// - Completa: copia todas las lineas (+ subitems si modo_detallado).
// - Resumen: 1 sola linea con titulo libre e importe = total presupuesto.
//             Pensado para enviar al cliente una factura limpia "trabajo
//             realizado segun presupuesto" sin enseñar el desglose interno.
// - Por hitos: si el presupuesto tiene hitos, genera N facturas (esta opcion
//             solo aparece cuando hay hitos definidos).
//
// El backend lee `modo` y `resumen_texto` del opts.

import { useEffect, useState } from 'react';
import { X, FileText, FileMinus, Layers, ArrowRight } from 'lucide-react';

const RESUMEN_DEFAULT = 'Trabajo realizado según presupuesto';

function ConvertirFacturaModal({ presupuesto, series, hasHitos, defaultSerie, onConfirm, onCancel }) {
  const [modo, setModo] = useState(hasHitos ? 'hitos' : 'completa');
  const [resumenTexto, setResumenTexto] = useState(RESUMEN_DEFAULT);
  const [serie, setSerie] = useState(defaultSerie || 'A');
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

  async function aceptar() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm({
        serie,
        modo,
        resumen_texto: modo === 'resumen' ? (resumenTexto.trim() || RESUMEN_DEFAULT) : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Convertir presupuesto en factura
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700"
            title="Cancelar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Selector de serie */}
        {series && series.length > 1 ? (
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Serie de la factura
            </label>
            <select
              value={serie}
              onChange={(e) => setSerie(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.id} — {s.label}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="mb-2 text-xs text-slate-500 uppercase tracking-wide font-medium">
          Cómo quieres convertirlo
        </div>

        <div className="space-y-2 mb-4">
          <ModoOption
            id="completa"
            active={modo === 'completa'}
            onPick={() => setModo('completa')}
            icon={FileText}
            title="Completa (igual al presupuesto)"
            desc="Copia todas las líneas con sus descripciones y subitems. La factura es un calco del presupuesto."
          />
          <ModoOption
            id="resumen"
            active={modo === 'resumen'}
            onPick={() => setModo('resumen')}
            icon={FileMinus}
            title="Resumen (1 sola línea)"
            desc="Sustituye todas las líneas por un único concepto con el importe total. Útil para enviar al cliente una factura limpia sin enseñar el desglose interno."
          />
          {hasHitos ? (
            <ModoOption
              id="hitos"
              active={modo === 'hitos'}
              onPick={() => setModo('hitos')}
              icon={Layers}
              title="Por hitos (varias facturas)"
              desc="Genera una factura por cada hito de pago configurado en el presupuesto."
            />
          ) : null}
        </div>

        {modo === 'resumen' ? (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Texto de la única línea
            </label>
            <input
              type="text"
              value={resumenTexto}
              onChange={(e) => setResumenTexto(e.target.value)}
              placeholder={RESUMEN_DEFAULT}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              autoFocus
            />
            <p className="text-xs text-slate-500 mt-2">
              Ejemplos: <em>"Trabajo realizado según presupuesto"</em>,{' '}
              <em>"Servicios prestados según presupuesto 2026/01"</em>,{' '}
              <em>"Reforma cocina (presupuesto del 12/04)"</em>.
            </p>
          </div>
        ) : null}

        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={aceptar}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? 'Creando…' : 'Convertir'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ModoOption({ active, onPick, icon: Icon, title, desc }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={
        'w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-3 ' +
        (active
          ? 'border-brand bg-brand/10'
          : 'border-slate-200 bg-white hover:bg-slate-50')
      }
    >
      <Icon
        size={18}
        className={'mt-0.5 ' + (active ? 'text-brand' : 'text-slate-400')}
      />
      <div className="flex-1">
        <div className={'text-sm font-medium ' + (active ? 'text-brand' : 'text-slate-800')}>
          {title}
        </div>
        <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</div>
      </div>
    </button>
  );
}

export default ConvertirFacturaModal;
