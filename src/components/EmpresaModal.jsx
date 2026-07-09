// Modal minimo para crear una empresa nueva (datos basicos). El resto de
// campos (logo, plantilla, series, etc.) se rellenan despues desde la
// pagina Ajustes — aqui solo recogemos lo imprescindible para que la
// empresa aparezca en el selector y se pueda activar.

import { useEffect, useRef, useState } from 'react';
import { Building2, X } from 'lucide-react';
import { useToast } from './Toast.jsx';

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand text-sm';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

function EmpresaModal({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    tipo: 'autonomo',
    nombre: '',
    nif: '',
    tipo_negocio: 'servicios',
  });
  const [saving, setSaving] = useState(false);
  const nombreRef = useRef(null);

  // EmpresaModal era el unico modal interactivo SIN gestion de foco/teclado.
  // Si vienes de una vista previa PDF (pdfjs deja el documento sin focus
  // efectivo) o de otro modal que dejo body.overflow bloqueado, el modal
  // aparecia pero NO respondia a clicks ni teclado hasta clicar en algun
  // sitio (el bug que reporto el feedback al crear empresa). Mismo patron
  // que FacturaEditor: reintentar el focus varias veces porque pdfjs puede
  // volver a robarlo tras el primer intento.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    function attempt() {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT')) {
        return;
      }
      nombreRef.current?.focus({ preventScroll: true });
    }
    const t1 = setTimeout(attempt, 100);
    const t2 = setTimeout(attempt, 400);
    const t3 = setTimeout(attempt, 1200);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      // Restaurar a '' (no al valor previo) para auto-sanar un 'hidden'
      // que otro modal haya dejado colgado. No hay modales anidados aqui.
      document.body.style.overflow = '';
    };
  }, [onClose]);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      toast.error('Pon al menos un nombre para la empresa.');
      return;
    }
    setSaving(true);
    try {
      const nueva = await window.api.empresas.create(form);
      // Activarla inmediatamente para que la app pase a esa empresa.
      await window.api.empresas.setActive(nueva.id);
      toast.success(`Empresa "${nueva.nombre}" creada y activada.`);
      window.dispatchEvent(new CustomEvent('settings-changed'));
      window.dispatchEvent(new CustomEvent('empresa-changed'));
      window.dispatchEvent(new CustomEvent('data-changed'));
      if (onSaved) onSaved(nueva);
      onClose();
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Building2 size={18} className="text-brand" />
            Nueva empresa
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            Rellena lo básico. El resto (logo, dirección, plantilla, color…)
            lo configuras después en Ajustes con esta empresa ya activa.
          </p>

          <div>
            <label className={labelCls}>Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setField('tipo', 'autonomo')}
                className={
                  'px-3 py-2 rounded-lg border text-sm transition-colors ' +
                  (form.tipo === 'autonomo'
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')
                }
              >
                Autónomo
              </button>
              <button
                type="button"
                onClick={() => setField('tipo', 'empresa')}
                className={
                  'px-3 py-2 rounded-lg border text-sm transition-colors ' +
                  (form.tipo === 'empresa'
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')
                }
              >
                Empresa
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>
              {form.tipo === 'empresa' ? 'Nombre de la empresa' : 'Nombre completo'}{' '}
              <span className="text-red-600">*</span>
            </label>
            <input
              className={inputCls}
              ref={nombreRef}
              autoFocus
              value={form.nombre}
              onChange={(e) => setField('nombre', e.target.value)}
              placeholder={form.tipo === 'empresa' ? 'Acme S.L.' : 'Juan García López'}
            />
          </div>

          <div>
            <label className={labelCls}>NIF / CIF</label>
            <input
              className={inputCls}
              value={form.nif}
              onChange={(e) => setField('nif', e.target.value)}
              placeholder={form.tipo === 'empresa' ? 'B12345678' : '12345678A'}
            />
          </div>

          <div>
            <label className={labelCls}>Tipo de negocio</label>
            <select
              className={inputCls + ' bg-white'}
              value={form.tipo_negocio}
              onChange={(e) => setField('tipo_negocio', e.target.value)}
            >
              <option value="servicios">Servicios (pintor, consultor, freelance…)</option>
              <option value="productos">Venta de productos (tienda, taller…)</option>
              <option value="mixto">Mixto (ambos)</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Si vendes productos, aparecerá un menú "Productos" con catálogo
              y autocompletado en las líneas.
            </p>
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
            onClick={guardar}
            disabled={saving || !form.nombre.trim()}
            className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm disabled:opacity-50"
          >
            {saving ? 'Creando…' : 'Crear y activar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmpresaModal;
