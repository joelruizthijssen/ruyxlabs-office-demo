// Modal reutilizable para crear/editar un cliente con todos los campos
// agrupados por secciones: identidad, contacto, direccion, facturacion, notas.
// Usado desde la pagina /clientes (crear) y desde /clientes/:id (editar).
//
// Convencion: `cliente` null/undefined → modo creacion. `cliente` con id →
// modo edicion. `onSaved(clienteActualizado)` para que el padre refresque.

import { useEffect, useState } from 'react';
import { X, User, Phone, MapPin, FileText, StickyNote } from 'lucide-react';

const TIPOS = [
  { id: 'autonomo',   label: 'Autónomo'    },
  { id: 'empresa',    label: 'Empresa'     },
  { id: 'particular', label: 'Particular'  },
];

const emptyForm = {
  tipo: 'empresa',
  nombre: '',
  nombre_comercial: '',
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
  iban: '',
  condiciones_pago: '',
  irpf_pct_default: 0,
  recargo_equivalencia: 0,
  pais: 'ES',
  intracomunitario: 0,
  vat_number: '',
  descuento_pct_default: 0,
  descuento_aplicar: 'total',
  tarifa_aplicar: 0,
  notas: '',
  observaciones_internas: '',
};

function ClienteFormModal({ cliente, onSaved, onCancel }) {
  const isEdit = !!cliente?.id;
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...(cliente || {}),
    irpf_pct_default: Number(cliente?.irpf_pct_default) || 0,
    descuento_pct_default: Number(cliente?.descuento_pct_default) || 0,
    descuento_aplicar: cliente?.descuento_aplicar === 'linea' ? 'linea' : 'total',
    tarifa_aplicar: [1, 2, 3, 4].includes(Number(cliente?.tarifa_aplicar))
      ? Number(cliente.tarifa_aplicar) : 0,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [vies, setVies] = useState(null); // { checking, result }

  async function validarVies() {
    const vat = String(form.vat_number || '').trim();
    if (!vat) {
      setVies({ checking: false, result: { ok: false, error: 'Escribe el VAT primero (ej. DE123456789).' } });
      return;
    }
    setVies({ checking: true, result: null });
    try {
      const res = await window.api.clientes.viesCheck({
        vat,
        clienteId: cliente?.id || null,
      });
      setVies({ checking: false, result: res });
      if (res?.ok && res.valid && res.name && !form.nombre?.trim()) {
        setField('nombre', res.name);
      }
    } catch (e) {
      setVies({ checking: false, result: { ok: false, error: e.message ?? String(e) } });
    }
  }

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
        descuento_pct_default: Number(form.descuento_pct_default) || 0,
        descuento_aplicar: form.descuento_aplicar === 'linea' ? 'linea' : 'total',
        tarifa_aplicar: [1, 2, 3, 4].includes(Number(form.tarifa_aplicar))
          ? Number(form.tarifa_aplicar) : 0,
      };
      const res = isEdit
        ? await window.api.clientes.update(cliente.id, payload)
        : await window.api.clientes.create(payload);
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

  const esParticular = form.tipo === 'particular';
  const inputCls =
    'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand disabled:bg-slate-100 disabled:text-slate-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-semibold text-slate-800">
            {isEdit ? `Editar cliente: ${cliente.nombre}` : 'Nuevo cliente'}
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700"
            title="Cancelar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="px-3 py-2 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Identidad */}
          <section>
            <SectionTitle icon={User} title="Identidad" />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setField('tipo', e.target.value)}
                  className={inputCls}
                >
                  {TIPOS.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>
                  {esParticular ? 'Nombre completo *' : 'Razón social *'}
                </label>
                <input
                  className={inputCls}
                  value={form.nombre}
                  onChange={(e) => setField('nombre', e.target.value)}
                  placeholder={esParticular ? 'Juan García López' : 'Empresa S.L.'}
                  autoFocus={!isEdit}
                />
              </div>
              {!esParticular && (
                <div className="col-span-2">
                  <label className={labelCls}>Nombre comercial</label>
                  <input
                    className={inputCls}
                    value={form.nombre_comercial || ''}
                    onChange={(e) => setField('nombre_comercial', e.target.value)}
                    placeholder="(si es diferente de la razón social)"
                  />
                </div>
              )}
              <div className={esParticular ? 'col-span-2' : 'col-span-1'}>
                <label className={labelCls}>{esParticular ? 'DNI' : 'NIF / CIF'}</label>
                <input
                  className={inputCls}
                  value={form.nif || ''}
                  onChange={(e) => setField('nif', e.target.value)}
                  placeholder={esParticular ? '12345678A' : 'B12345678'}
                />
              </div>
            </div>
          </section>

          {/* Contacto */}
          <section>
            <SectionTitle icon={Phone} title="Contacto" />
            <div className="grid grid-cols-2 gap-3">
              {!esParticular && (
                <div className="col-span-2">
                  <label className={labelCls}>Persona de contacto</label>
                  <input
                    className={inputCls}
                    value={form.contacto_persona || ''}
                    onChange={(e) => setField('contacto_persona', e.target.value)}
                    placeholder="A quién dirigirte"
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  className={inputCls}
                  value={form.email || ''}
                  onChange={(e) => setField('email', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Web</label>
                <input
                  className={inputCls}
                  value={form.web || ''}
                  onChange={(e) => setField('web', e.target.value)}
                  placeholder="empresa.com"
                />
              </div>
              <div>
                <label className={labelCls}>Teléfono fijo</label>
                <input
                  className={inputCls}
                  value={form.telefono || ''}
                  onChange={(e) => setField('telefono', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Móvil</label>
                <input
                  className={inputCls}
                  value={form.telefono_movil || ''}
                  onChange={(e) => setField('telefono_movil', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Dirección */}
          <section>
            <SectionTitle icon={MapPin} title="Dirección" />
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-4">
                <label className={labelCls}>Calle y número</label>
                <input
                  className={inputCls}
                  value={form.direccion || ''}
                  onChange={(e) => setField('direccion', e.target.value)}
                  placeholder="C/ Mayor 12"
                />
              </div>
              <div>
                <label className={labelCls}>CP</label>
                <input
                  className={inputCls}
                  value={form.cp || ''}
                  onChange={(e) => setField('cp', e.target.value)}
                  maxLength={10}
                  title="Hasta 10 caracteres (códigos postales internacionales como 5705 BA)"
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Ciudad</label>
                <input
                  className={inputCls}
                  value={form.ciudad || ''}
                  onChange={(e) => setField('ciudad', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Provincia</label>
                <input
                  className={inputCls}
                  value={form.provincia || ''}
                  onChange={(e) => setField('provincia', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Facturación (atenuada para particular) */}
          <section className={esParticular ? 'opacity-60' : ''}>
            <SectionTitle icon={FileText} title="Facturación" />
            {esParticular && (
              <p className="text-xs text-slate-500 mb-2 italic">
                Estos campos son opcionales para clientes particulares.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>IBAN</label>
                <input
                  className={inputCls}
                  value={form.iban || ''}
                  onChange={(e) => setField('iban', e.target.value)}
                  placeholder="ES00 0000 0000 0000 0000 0000"
                />
              </div>
              <div>
                <label className={labelCls}>Condiciones de pago</label>
                <input
                  className={inputCls}
                  value={form.condiciones_pago || ''}
                  onChange={(e) => setField('condiciones_pago', e.target.value)}
                  placeholder="30 días, contado..."
                />
              </div>
              <div>
                <label className={labelCls} title="Si trabajas con retención, se aplicará por defecto al crear facturas para este cliente">
                  IRPF por defecto (%)
                </label>
                <input
                  type="number" onFocus={(e) => e.target.select()}
                  step="0.01"
                  className={inputCls}
                  value={form.irpf_pct_default || 0}
                  onChange={(e) => setField('irpf_pct_default', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div>
                <label className={labelCls} title="Si tienes un descuento habitual con este cliente, se aplicará al crear facturas y presupuestos">
                  Descuento por defecto (%)
                </label>
                <input
                  type="number" onFocus={(e) => e.target.select()}
                  step="0.01"
                  className={inputCls}
                  value={form.descuento_pct_default || 0}
                  onChange={(e) => setField('descuento_pct_default', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelCls}>Aplicar el descuento</label>
                <select
                  className={inputCls}
                  value={form.descuento_aplicar || 'total'}
                  onChange={(e) => setField('descuento_aplicar', e.target.value)}
                  disabled={!Number(form.descuento_pct_default)}
                >
                  <option value="total">Al total de la factura</option>
                  <option value="linea">A cada línea individualmente</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {form.descuento_aplicar === 'linea'
                    ? 'Cada línea creada llevará ese descuento (las que ya tengan uno propio se respetan).'
                    : 'Se aplica como descuento global sobre el subtotal.'}
                </p>
              </div>
              {/* v1.2.24: tarifa que se aplica al facturar productos a este cliente. */}
              <div className="col-span-2">
                <label className={labelCls} title="Si el producto tiene tarifa rellenada, al elegirlo se usa esa tarifa en vez del precio de venta por defecto.">
                  Tarifa de facturación
                </label>
                <select
                  className={inputCls}
                  value={Number(form.tarifa_aplicar) || 0}
                  onChange={(e) => setField('tarifa_aplicar', Number(e.target.value))}
                >
                  <option value={0}>Por defecto (precio de venta del producto)</option>
                  <option value={1}>T1 — Nacional Tienda</option>
                  <option value={2}>T2 — Nacional Cliente final</option>
                  <option value={3}>T3 — Export Tienda</option>
                  <option value={4}>T4 — Export Cliente final</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Si el producto tiene esa tarifa rellenada en su ficha, se aplica
                  al añadirlo a una factura. Si no, se usa el precio de venta normal.
                </p>
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-brand focus:ring-brand"
                    checked={!!form.recargo_equivalencia}
                    onChange={(e) =>
                      setField('recargo_equivalencia', e.target.checked ? 1 : 0)
                    }
                  />
                  <span className="text-sm text-slate-700">
                    Cliente en régimen de recargo de equivalencia
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  Si lo activas, sus facturas suman automáticamente el recargo
                  (5,2% / 1,4% / 0,5% según el IVA de cada línea).
                </p>
              </div>

              <div>
                <label className={labelCls}>País</label>
                <input
                  className={inputCls + ' font-mono uppercase'}
                  value={form.pais || 'ES'}
                  maxLength={2}
                  onChange={(e) =>
                    setField('pais', e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))
                  }
                  placeholder="ES"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Código de 2 letras (ES, FR, DE, IT…).
                </p>
              </div>

              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-brand focus:ring-brand"
                    checked={!!form.intracomunitario}
                    onChange={(e) =>
                      setField('intracomunitario', e.target.checked ? 1 : 0)
                    }
                  />
                  <span className="text-sm text-slate-700">
                    Operador intracomunitario (factura sin IVA)
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  Si lo activas, sus facturas se emiten <strong>sin IVA</strong>{' '}
                  con la nota de inversión del sujeto pasivo (el cliente
                  autoliquida el IVA en su país).
                </p>
              </div>

              {!!form.intracomunitario && (
                <div className="col-span-2">
                  <label className={labelCls}>VAT intracomunitario (NIF-IVA)</label>
                  <div className="flex gap-2">
                    <input
                      className={inputCls + ' font-mono flex-1'}
                      value={form.vat_number || ''}
                      onChange={(e) => {
                        setField('vat_number', e.target.value.toUpperCase());
                        setVies(null);
                      }}
                      placeholder="DE123456789"
                    />
                    <button
                      type="button"
                      onClick={validarVies}
                      disabled={vies?.checking || !form.vat_number?.trim()}
                      className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm shrink-0 disabled:opacity-50"
                    >
                      {vies?.checking ? 'Validando…' : 'Validar en VIES'}
                    </button>
                  </div>
                  {vies?.result && (
                    <p
                      className={
                        'text-xs mt-1 ' +
                        (vies.result.ok && vies.result.valid
                          ? 'text-emerald-700'
                          : vies.result.ok && !vies.result.valid
                            ? 'text-red-600'
                            : 'text-amber-700')
                      }
                    >
                      {vies.result.ok
                        ? vies.result.valid
                          ? `✓ VAT válido en VIES${vies.result.name ? ` — ${vies.result.name}` : ''}`
                          : '✗ VIES dice que este VAT no está dado de alta.'
                        : vies.result.error}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    La comprobación VIES es informativa (censo de la UE).
                    Necesita conexión a internet; si no la hay, puedes guardar
                    igual y validarlo más tarde.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Notas */}
          <section>
            <SectionTitle icon={StickyNote} title="Notas" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Notas (van en factura)</label>
                <textarea
                  rows={3}
                  className={inputCls}
                  value={form.notas || ''}
                  onChange={(e) => setField('notas', e.target.value)}
                  placeholder="Información que el cliente puede ver"
                />
              </div>
              <div>
                <label className={labelCls}>Observaciones internas</label>
                <textarea
                  rows={3}
                  className={inputCls}
                  value={form.observaciones_internas || ''}
                  onChange={(e) => setField('observaciones_internas', e.target.value)}
                  placeholder="Solo para tu referencia (no aparece en el PDF)"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
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

export default ClienteFormModal;
