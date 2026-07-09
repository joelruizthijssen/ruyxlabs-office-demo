// Modal de aviso legal Verifactu. Aparece la PRIMERA vez que se abre la app
// (mientras settings.legal_aceptado_at sea NULL) y bloquea cualquier otra
// interaccion: no se puede cerrar sin pulsar "Acepto".
//
// Tras aceptar, el repository graba un timestamp y el modal no vuelve a
// aparecer. Si en el futuro queremos forzar re-aceptacion (ej. cambio de
// terminos), basta con resetear esa columna a NULL.
//
// Texto literal del briefing — NO modificar sin revisar implicacion legal.

import { useState } from 'react';
import { ShieldAlert, ArrowRight } from 'lucide-react';

function LegalWelcome({ onAccept }) {
  const [accepting, setAccepting] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState(null);

  async function aceptar() {
    if (!checked || accepting) return;
    setError(null);
    setAccepting(true);
    try {
      const res = await window.api.settings.acceptLegal();
      if (res?.error) {
        setError(res.error);
        return;
      }
      onAccept?.(res);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700">
            <ShieldAlert size={22} />
          </div>
          <div className="text-lg font-semibold text-slate-800">
            Aviso importante antes de empezar
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-slate-800 mb-3">
          Bienvenido a Ruyx Office
        </h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          Ruyx Office está diseñado para ayudarte a gestionar presupuestos,
          clientes y borradores de factura de forma simple y profesional.
        </p>

        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 mb-4">
          <p className="text-sm text-amber-900 font-semibold mb-2">
            IMPORTANTE
          </p>
          <p className="text-sm text-amber-900 leading-relaxed">
            Ruyx Office <strong>NO es un Sistema Informático de Facturación
            certificado</strong> según el Real Decreto 1007/2023 (Verifactu).
            Los documentos que generes con esta aplicación son{' '}
            <strong>borradores SIN VALOR FISCAL</strong>.
          </p>
        </div>

        <p className="text-slate-600 leading-relaxed mb-2">
          Para emitir tus facturas oficiales con validez legal, debes importar
          los datos exportados por Ruyx Office en una plataforma certificada
          Verifactu, como:
        </p>
        <ul className="text-slate-600 leading-relaxed mb-5 ml-5 list-disc space-y-1">
          <li>
            La <strong>aplicación gratuita de la AEAT</strong> (recomendada).
          </li>
          <li>
            <strong>Holded, BeeL.es, FacturaDirecta, Quipu</strong> u otras
            plataformas certificadas.
          </li>
        </ul>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <label className="flex items-start gap-3 cursor-pointer mb-6 select-none">
          <input
            type="checkbox"
            className="mt-1 w-4 h-4 rounded text-brand focus:ring-brand"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span className="text-sm text-slate-700 leading-relaxed">
            Acepto estas condiciones y entiendo el alcance de esta aplicación.
          </span>
        </label>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">Ruyx Office — by RuyxLabs</p>
          <button
            type="button"
            onClick={aceptar}
            disabled={!checked || accepting}
            className={
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white transition-colors ' +
              (!checked || accepting
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-brand hover:bg-brand-dark')
            }
          >
            {accepting ? 'Guardando…' : 'Acepto y continuar'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default LegalWelcome;
