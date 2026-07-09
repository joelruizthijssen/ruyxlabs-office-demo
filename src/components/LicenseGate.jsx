// Pantalla de bloqueo cuando el periodo de prueba ha terminado y no hay
// licencia válida, + banner sutil durante la prueba.
//
// Nota honesta: este gate vive en el renderer y, como toda protección
// client-side en Electron, un experto puede saltárselo. Su función es que
// el usuario honesto vea claramente que tiene que pagar y pueda activar su
// licencia sin fricción. La dificultad real de parcheo la añade el módulo
// de licencia compilado a bytecode en el proceso principal.

import { useState } from 'react';
import { ShieldCheck, KeyRound, Clock } from 'lucide-react';

export function LicenseGate({ onActivated }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function activar() {
    const k = key.trim();
    if (!k) { setError('Introduce tu clave de licencia.'); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await window.api.license.activate(k);
      if (res?.error) { setError(res.error); return; }
      onActivated?.();
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function comprar() {
    window.api.license.openRequest().catch(() => {});
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <Clock size={26} />
        </div>
        <h1 className="text-xl font-semibold text-slate-800 mb-2">
          Tu periodo de prueba ha terminado
        </h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Gracias por probar Ruyx Office. Para seguir usándolo necesitas una
          licencia. Si ya la tienes, introdúcela aquí; si no, consíguela en un
          momento.
        </p>

        <div className="text-left">
          <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">
            Clave de licencia
          </label>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-brand">
              <KeyRound size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && activar()}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="flex-1 outline-none text-sm"
                autoFocus
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600 mb-2">{error}</p>
          )}
          <button
            type="button"
            onClick={activar}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-medium disabled:opacity-60"
          >
            <ShieldCheck size={16} />
            {busy ? 'Validando…' : 'Activar licencia'}
          </button>
        </div>

        <div className="mt-5 pt-5 border-t border-slate-100">
          <p className="text-sm text-slate-500 mb-2">¿Aún no tienes licencia?</p>
          <button
            type="button"
            onClick={comprar}
            className="text-sm font-medium text-brand hover:underline"
          >
            Conseguir una licencia →
          </button>
        </div>
      </div>
    </div>
  );
}

// Banner fino durante la prueba. Más discreto al principio, más insistente
// cuando quedan pocos días.
export function TrialBanner({ daysLeft, onComprar }) {
  const urgente = daysLeft <= 7;
  return (
    <div
      className={
        'w-full text-center text-xs py-1.5 px-4 ' +
        (urgente
          ? 'bg-amber-500 text-white'
          : 'bg-amber-50 text-amber-800 border-b border-amber-200')
      }
    >
      Versión de prueba — te {daysLeft === 1 ? 'queda' : 'quedan'}{' '}
      <strong>{daysLeft}</strong> {daysLeft === 1 ? 'día' : 'días'}.{' '}
      <button
        type="button"
        onClick={onComprar}
        className={
          'underline font-medium ' +
          (urgente ? 'text-white' : 'text-amber-900')
        }
      >
        Conseguir licencia
      </button>
    </div>
  );
}
