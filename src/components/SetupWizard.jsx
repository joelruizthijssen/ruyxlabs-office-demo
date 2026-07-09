// Wizard de primer arranque. Se muestra como overlay a pantalla completa
// cuando settings.emisor_nombre y settings.emisor_nif estan vacios. Al
// terminar, llama a onComplete(settingsActualizados) para que el App
// quite el overlay y siga con el flujo normal.

import { useState } from 'react';
import { Receipt, ArrowRight, Check, Wrench, Package, Layers } from 'lucide-react';

const inputCls =
  'w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

const PASOS = [
  { id: 'bienvenida', titulo: 'Bienvenida' },
  { id: 'datos',      titulo: 'Tus datos'  },
  { id: 'negocio',    titulo: 'Tipo de negocio' },
  { id: 'fiscal',     titulo: 'IVA y ciudad' },
  { id: 'fin',        titulo: 'Listo'      },
];

function StepDots({ index }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {PASOS.map((p, i) => (
        <div
          key={p.id}
          className={
            'h-1.5 flex-1 rounded-full transition-colors ' +
            (i < index ? 'bg-brand' : i === index ? 'bg-brand' : 'bg-slate-200')
          }
        />
      ))}
    </div>
  );
}

function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    emisor_nombre: '',
    emisor_nombre_comercial: '',
    emisor_nif: '',
    emisor_direccion: '',
    emisor_cp: '',
    emisor_ciudad: '',
    emisor_telefono: '',
    emisor_email: '',
    iva_default: 21,
    ciudad_emision: '',
    tipo_empresa: 'autonomo',
    tipo_negocio: 'servicios',
  });

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function siguiente() {
    setError(null);
    if (step === 1) {
      if (!form.emisor_nombre.trim() || !form.emisor_nif.trim()) {
        setError('Necesitamos al menos tu nombre y tu NIF.');
        return;
      }
    }
    setStep((s) => s + 1);
  }

  function atras() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function finalizar() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      // Pasamos current settings + cambios del form para que settings_update
      // tenga todos los campos (no perdemos defaults que no rellenamos aqui).
      const current = await window.api.settings.get();
      const payload = {
        ...current,
        ...form,
        iva_default: Number(form.iva_default) || 21,
      };
      const res = await window.api.settings.update(payload);
      if (res?.error) {
        setError(res.error);
        return;
      }
      window.dispatchEvent(new CustomEvent('settings-changed'));
      window.dispatchEvent(new CustomEvent('empresa-changed'));
      onComplete?.(res);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-brand/10 text-brand">
            <Receipt size={22} />
          </div>
          <div className="text-lg font-semibold text-slate-800">
            Configuración inicial
          </div>
        </div>

        <StepDots index={step} />

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-800">
              Bienvenido a Facturas
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Es la primera vez que abres la app. Vamos a configurar tus datos
              en menos de un minuto: nombre, NIF, dirección y un par de
              ajustes fiscales. Después podrás cambiar todo en{' '}
              <span className="font-medium">Ajustes</span> cuando quieras.
            </p>
            <p className="text-sm text-slate-500">
              Tus datos se guardan localmente en este ordenador. No se envía
              nada por internet.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800">Tus datos</h2>
            <p className="text-sm text-slate-500">
              Aparecerán en la cabecera de cada presupuesto y factura.
            </p>
            <div>
              <label className={labelCls}>Nombre Fiscal *</label>
              <input
                className={inputCls}
                placeholder="Juan García López"
                autoFocus
                value={form.emisor_nombre}
                onChange={(e) => setField('emisor_nombre', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Nombre comercial (opcional)</label>
              <input
                className={inputCls}
                placeholder="Pinturas Mediterráneo"
                value={form.emisor_nombre_comercial}
                onChange={(e) => setField('emisor_nombre_comercial', e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">
                Nombre con el que operas de cara al cliente. Si lo dejas
                vacío se usa el nombre fiscal.
              </p>
            </div>
            <div>
              <label className={labelCls}>NIF *</label>
              <input
                className={inputCls}
                placeholder="12 345 678 A"
                value={form.emisor_nif}
                onChange={(e) => setField('emisor_nif', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Dirección</label>
              <input
                className={inputCls}
                placeholder="C/ Mayor 12"
                value={form.emisor_direccion}
                onChange={(e) => setField('emisor_direccion', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Código Postal</label>
                <input
                  className={inputCls}
                  placeholder="17251"
                  value={form.emisor_cp}
                  onChange={(e) => setField('emisor_cp', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Población</label>
                <input
                  className={inputCls}
                  placeholder="Calonge"
                  value={form.emisor_ciudad}
                  onChange={(e) => setField('emisor_ciudad', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Teléfono</label>
                <input
                  className={inputCls}
                  placeholder="600 000 000"
                  value={form.emisor_telefono}
                  onChange={(e) => setField('emisor_telefono', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="hola@ejemplo.com"
                  value={form.emisor_email}
                  onChange={(e) => setField('emisor_email', e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">* Obligatorios.</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800">
              ¿A qué te dedicas?
            </h2>
            <p className="text-sm text-slate-500">
              Esto nos ayuda a personalizar la app. Puedes cambiarlo después
              en Ajustes.
            </p>

            <div>
              <label className={labelCls}>Identidad fiscal</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setField('tipo_empresa', 'autonomo')}
                  className={
                    'px-4 py-3 rounded-lg border text-sm transition-colors ' +
                    (form.tipo_empresa === 'autonomo'
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')
                  }
                >
                  Autónomo
                </button>
                <button
                  type="button"
                  onClick={() => setField('tipo_empresa', 'empresa')}
                  className={
                    'px-4 py-3 rounded-lg border text-sm transition-colors ' +
                    (form.tipo_empresa === 'empresa'
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')
                  }
                >
                  Empresa (S.L., S.A.…)
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls}>¿Qué vendes?</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'servicios', icon: Wrench, label: 'Servicios', desc: 'Pintor, consultor, freelance, asesor… Sin catálogo de productos.' },
                  { id: 'productos', icon: Package, label: 'Productos', desc: 'Tienda, taller, distribuidor… Aparecerá un menú "Productos" con catálogo y autocomplete en líneas.' },
                  { id: 'mixto',     icon: Layers,  label: 'Mixto',     desc: 'Ofreces ambos. Tendrás catálogo opcional.' },
                ].map(({ id, icon: Icon, label, desc }) => {
                  const active = form.tipo_negocio === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setField('tipo_negocio', id)}
                      className={
                        'text-left px-4 py-3 rounded-lg border transition-colors flex items-start gap-3 ' +
                        (active
                          ? 'border-brand bg-brand/10'
                          : 'border-slate-300 bg-white hover:bg-slate-50')
                      }
                    >
                      <Icon size={18} className={active ? 'text-brand mt-0.5' : 'text-slate-400 mt-0.5'} />
                      <div>
                        <div className={'font-medium ' + (active ? 'text-brand' : 'text-slate-800')}>
                          {label}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800">
              IVA y ciudad
            </h2>
            <p className="text-sm text-slate-500">
              Valores por defecto para los nuevos documentos. Los puedes cambiar
              en cada presupuesto o factura.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>IVA por defecto (%)</label>
                <input
                  type="number" onFocus={(e) => e.target.select()}
                  step="0.01"
                  className={inputCls}
                  value={form.iva_default}
                  onChange={(e) => setField('iva_default', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Ciudad de emisión</label>
                <input
                  className={inputCls}
                  placeholder="Calonge"
                  value={form.ciudad_emision}
                  onChange={(e) => setField('ciudad_emision', e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              La ciudad aparece arriba de cada documento ("Calonge, 8 mayo 2026").
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Check size={28} />
            </div>
            <h2 className="text-2xl font-semibold text-slate-800">
              Todo listo, {form.emisor_nombre.split(' ')[0] || 'bienvenido'}
            </h2>
            <p className="text-slate-600">
              Ya puedes empezar a crear presupuestos y facturas. Si quieres
              añadir tu logo o cambiar el color, ve a{' '}
              <span className="font-medium">Ajustes → Diseño</span>.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mt-8">
          <button
            type="button"
            onClick={atras}
            disabled={step === 0 || saving}
            className={
              'px-4 py-2 rounded-lg text-sm transition-colors ' +
              (step === 0
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-600 hover:bg-slate-100')
            }
          >
            Atrás
          </button>

          {step < PASOS.length - 1 ? (
            <button
              type="button"
              onClick={siguiente}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white transition-colors"
            >
              {step === 0 ? 'Empezar' : 'Siguiente'}
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={finalizar}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Empezar a usar la app'}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SetupWizard;
