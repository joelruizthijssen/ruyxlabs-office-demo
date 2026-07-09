// Seccion de Ajustes "Activacion / License" — para introducir la license key
// y ver el estado actual. La generacion de keys vive en la web (gratis ahora,
// Stripe en el futuro). Si el usuario aun no tiene key, le ofrecemos el
// boton "Pedir mi key" que abre la web en el navegador externo.

import { useState } from 'react';
import { KeyRound, ShieldCheck, AlertCircle, ExternalLink, Copy, Check } from 'lucide-react';
import { useToast } from './Toast.jsx';
import { formatFechaES } from '../utils/format.js';

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';

function LicenseSection({ settings, onLicenseChange }) {
  const toast = useToast();
  const [keyInput, setKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);

  const activated = !!settings?.license_activated;
  const email = settings?.license_email;
  const plan = settings?.license_plan || 'free';
  const validatedAt = settings?.license_validated_at;
  const currentKey = settings?.license_key;

  async function activar() {
    const k = keyInput.trim();
    if (!k) {
      toast.error('Introduce tu license key.');
      return;
    }
    setActivating(true);
    try {
      const res = await window.api.license.activate(k);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Licencia activada.');
      setKeyInput('');
      if (onLicenseChange) onLicenseChange(res);
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setActivating(false);
    }
  }

  async function desactivar() {
    if (!confirm('Desactivar la licencia? La app sigue funcionando, pero perdera la asociacion con tu email/plan.')) {
      return;
    }
    try {
      const res = await window.api.license.deactivate();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Licencia desactivada.');
      if (onLicenseChange) onLicenseChange(res);
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function revalidar() {
    try {
      const res = await window.api.license.revalidate();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (res?.offline) {
        toast.info('Sin conexion. Mantengo la activacion vigente.');
        return;
      }
      if (res?.revoked) {
        toast.error('La licencia ha sido revocada en el servidor.');
        if (onLicenseChange) onLicenseChange(null);
        return;
      }
      toast.success('Licencia revalidada.');
      // Forzamos recarga de settings para refrescar la fecha.
      if (onLicenseChange) onLicenseChange({ refreshed: true });
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function pedirKey() {
    try {
      await window.api.license.openRequest();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  function copiarKey() {
    if (!currentKey) return;
    navigator.clipboard.writeText(currentKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
        <KeyRound size={18} className="text-brand" />
        Activacion
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Ruyx Office es gratis pero necesita una license key personal. Te la
        enviamos al instante por correo cuando la pides en la web.
      </p>

      {activated ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-emerald-900 flex items-center gap-2">
                Licencia activa
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 capitalize">
                  {plan}
                </span>
              </div>
              {email && (
                <div className="text-sm text-emerald-800 mt-0.5">{email}</div>
              )}
              {validatedAt && (
                <div className="text-xs text-emerald-700 mt-0.5">
                  Ultima revalidacion: {formatFechaES(validatedAt.slice(0, 10))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 bg-white rounded-md border border-emerald-100 px-3 py-2">
            <code className="text-xs text-slate-700 truncate flex-1">
              {currentKey}
            </code>
            <button
              type="button"
              onClick={copiarKey}
              className="p-1 rounded hover:bg-slate-100 text-slate-500"
              title="Copiar al portapapeles"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={revalidar}
              className="px-3 py-1.5 rounded-md border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50 text-xs"
            >
              Revalidar ahora
            </button>
            <button
              type="button"
              onClick={desactivar}
              className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs"
            >
              Desactivar
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-700 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-amber-900">Sin licencia activa</div>
              <p className="text-sm text-amber-800 mt-1">
                La app funciona igual sin licencia, pero pedirla nos ayuda a
                conocer a quien la usa. Es gratis y tarda 30 segundos.
              </p>
              <button
                type="button"
                onClick={pedirKey}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-700 hover:bg-amber-800 text-white text-sm"
              >
                <ExternalLink size={14} />
                Pedir mi license key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario para introducir key (siempre visible — permite cambiar) */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {activated ? 'Cambiar license key' : 'Introducir license key'}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            className={inputCls + ' font-mono'}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
          <button
            type="button"
            onClick={activar}
            disabled={activating || !keyInput.trim()}
            className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm disabled:opacity-50"
          >
            {activating ? 'Activando…' : 'Activar'}
          </button>
        </div>
      </div>
    </section>
  );
}

export default LicenseSection;
