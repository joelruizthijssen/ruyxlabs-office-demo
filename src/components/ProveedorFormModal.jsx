// Modal reutilizable para crear/editar un proveedor. Espejo simplificado de
// ClienteFormModal. Diferencias respecto a clientes:
//   - No hay "tipo" (autonomo/empresa/particular). Un proveedor es una
//     entidad facturadora — no necesitamos esa distincion para gestion.
//   - No hay VIES ni recargo de equivalencia (eso es info que aplica a
//     CLIENTES nuestros que vendieron en regimen especial, no a proveedores
//     a quienes les compramos).
//   - Tiene IVA por defecto (`iva_pct_default`): un proveedor habitual suele
//     ser consistente en el IVA que aplica; ahorra clicks al registrar gastos.

import { useEffect, useState } from 'react';
import { X, Truck, Phone, MapPin, FileText, StickyNote } from 'lucide-react';

const emptyForm = {
  nombre: '',
  nif: '',
  contacto_persona: '',
  email: '',
  telefono: '',
  telefono_movil: '',
  web: '',
  direccion: '',
  cp: '',
  ciudad: '',
  provincia: '',
  pais: 'ES',
  iban: '',
  condiciones_pago: '',
  irpf_pct_default: 0,
  iva_pct_default: '',
  tarifa_aplicar: 0,
  notas: '',
  observaciones_internas: '',
  // v1.5.0: idioma preferido para los documentos.
  idioma_documentos: null,
};

function ProveedorFormModal({ proveedor, onSaved, onCancel }) {
  const isEdit = !!proveedor?.id;
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...(proveedor || {}),
    irpf_pct_default: Number(proveedor?.irpf_pct_default) || 0,
    iva_pct_default: proveedor?.iva_pct_default == null ? '' : proveedor.iva_pct_default,
    tarifa_aplicar: Number(proveedor?.tarifa_aplicar) || 0,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // v1.2.48: nombres de las 4 tarifas de compra (viven en la empresa).
  const [tarifaLabels, setTarifaLabels] = useState([null, null, null, null]);
  useEffect(() => {
    if (!window.api?.settings) return;
    window.api.settings.get().then((s) => {
      if (!s || s.error) return;
      setTarifaLabels([
        s.tarifa_compra_1_label,
        s.tarifa_compra_2_label,
        s.tarifa_compra_3_label,
        s.tarifa_compra_4_label,
      ]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        irpf_pct_default: Number(form.irpf_pct_default) || 0,
        iva_pct_default: form.iva_pct_default === '' || form.iva_pct_default == null
          ? null
          : Number(form.iva_pct_default),
        tarifa_aplicar: Number(form.tarifa_aplicar) || 0,
      };
      const res = isEdit
        ? await window.api.proveedores.update(proveedor.id, payload)
        : await window.api.proveedores.create(payload);
      if (res?.error) {
        setError(res.error);
        return;
      }
      onSaved(res);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand disabled:bg-slate-100 disabled:text-slate-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h[92vh]" style={{ maxHeight: '92vh' }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-semibold text-slate-800">
            {isEdit ? `Editar proveedor: ${proveedor.nombre}` : 'Nuevo proveedor'}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700" title="Cancelar (Esc)">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="px-3 py-2 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          <section>
            <SectionTitle icon={Truck} title="Identidad" />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Nombre / Razón social *</label>
                <input
                  className={inputCls}
                  value={form.nombre}
                  onChange={(e) => setField('nombre', e.target.value)}
                  placeholder="Repsol, Equine America S.L., Shopify..."
                  autoFocus={!isEdit}
                />
              </div>
              <div>
                <label className={labelCls}>NIF / CIF</label>
                <input
                  className={inputCls}
                  value={form.nif || ''}
                  onChange={(e) => setField('nif', e.target.value)}
                  placeholder="B12345678"
                />
              </div>
            </div>
          </section>

          <section>
            <SectionTitle icon={Phone} title="Contacto" />
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Persona de contacto</label>
                <input
                  className={inputCls}
                  value={form.contacto_persona || ''}
                  onChange={(e) => setField('contacto_persona', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" className={inputCls} value={form.email || ''} onChange={(e) => setField('email', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Web</label>
                <input className={inputCls} value={form.web || ''} onChange={(e) => setField('web', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Teléfono fijo</label>
                <input className={inputCls} value={form.telefono || ''} onChange={(e) => setField('telefono', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Móvil</label>
                <input className={inputCls} value={form.telefono_movil || ''} onChange={(e) => setField('telefono_movil', e.target.value)} />
              </div>
            </div>
          </section>

          <section>
            <SectionTitle icon={MapPin} title="Dirección" />
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-4">
                <label className={labelCls}>Calle y número</label>
                <input className={inputCls} value={form.direccion || ''} onChange={(e) => setField('direccion', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>CP</label>
                <input
                  className={inputCls}
                  value={form.cp || ''}
                  onChange={(e) => setField('cp', e.target.value)}
                  maxLength={10}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Ciudad</label>
                <input className={inputCls} value={form.ciudad || ''} onChange={(e) => setField('ciudad', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Provincia</label>
                <input className={inputCls} value={form.provincia || ''} onChange={(e) => setField('provincia', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>País</label>
                <input
                  className={inputCls + ' font-mono uppercase'}
                  value={form.pais || 'ES'}
                  maxLength={2}
                  onChange={(e) => setField('pais', e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                />
              </div>
            </div>
          </section>

          <section>
            <SectionTitle icon={FileText} title="Facturación" />
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>IBAN</label>
                <input className={inputCls} value={form.iban || ''} onChange={(e) => setField('iban', e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000" />
              </div>
              <div>
                <label className={labelCls}>Condiciones de pago</label>
                <input className={inputCls} value={form.condiciones_pago || ''} onChange={(e) => setField('condiciones_pago', e.target.value)} placeholder="30 días, contado..." />
              </div>
              <div>
                <label className={labelCls} title="Si el proveedor te retiene IRPF, se aplicará por defecto al registrar gastos suyos">
                  IRPF por defecto (%)
                </label>
                <input
                  type="number"
                  onFocus={(e) => e.target.select()}
                  step="0.01"
                  className={inputCls}
                  value={form.irpf_pct_default || 0}
                  onChange={(e) => setField('irpf_pct_default', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls} title="IVA que suele aplicar este proveedor (se sugiere al crear líneas de gasto)">
                  IVA habitual (%)
                </label>
                <input
                  type="number"
                  onFocus={(e) => e.target.select()}
                  step="0.01"
                  className={inputCls}
                  value={form.iva_pct_default}
                  onChange={(e) => setField('iva_pct_default', e.target.value)}
                  placeholder="Dejar vacío = sin sugerencia"
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls} title="En un pedido a este proveedor, se aplicará automáticamente esta tarifa de compra a los productos del catálogo que la tengan rellenada. Sin tarifa = usar el precio_compra base del producto.">
                  Tarifa de compra por defecto
                </label>
                <select
                  className={inputCls}
                  value={form.tarifa_aplicar || 0}
                  onChange={(e) => setField('tarifa_aplicar', Number(e.target.value))}
                >
                  <option value={0}>Ninguna (usar precio_compra base del producto)</option>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      Tarifa {n}
                      {tarifaLabels[n - 1] ? ` — ${tarifaLabels[n - 1]}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section>
            <SectionTitle icon={StickyNote} title="Notas" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Notas</label>
                <textarea
                  rows={3}
                  className={inputCls}
                  value={form.notas || ''}
                  onChange={(e) => setField('notas', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Observaciones internas</label>
                <textarea
                  rows={3}
                  className={inputCls}
                  value={form.observaciones_internas || ''}
                  onChange={(e) => setField('observaciones_internas', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Idioma preferido para los documentos</label>
                <select
                  className={inputCls + ' bg-white'}
                  value={form.idioma_documentos || ''}
                  onChange={(e) => setField('idioma_documentos', e.target.value || null)}
                >
                  <option value="">Automático (usar el default de la empresa)</option>
                  <option value="es">Español</option>
                  <option value="en">Inglés</option>
                </select>
              </div>
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onCancel} disabled={submitting} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear proveedor'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
      <Icon size={14} />
      {title}
    </h3>
  );
}

export default ProveedorFormModal;
