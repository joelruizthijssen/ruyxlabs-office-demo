// Modal para crear/editar/eliminar una recurrencia asociada a una factura
// o presupuesto. Reusable desde los editores y desde la pagina /recurrencias.
//
// Si recibe `existing` (recurrencia ya creada), entra en modo edicion y
// muestra ademas un boton para desactivar/borrar. Si no, entra en modo
// creacion con valores por defecto (mensual, fecha = hoy + 1 mes).

import { useEffect, useState } from 'react';
import { Repeat, X, Trash2 } from 'lucide-react';
import { useToast } from './Toast.jsx';

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';

const PERIODICIDADES = [
  { id: 'semanal',    label: 'Cada semana' },
  { id: 'mensual',    label: 'Cada mes' },
  { id: 'trimestral', label: 'Cada trimestre' },
  { id: 'anual',      label: 'Cada anyo' },
];

function defaultProxima(periodicidad) {
  const d = new Date();
  switch (periodicidad) {
    case 'semanal':    d.setDate(d.getDate() + 7); break;
    case 'mensual':    d.setMonth(d.getMonth() + 1); break;
    case 'trimestral': d.setMonth(d.getMonth() + 3); break;
    case 'anual':      d.setFullYear(d.getFullYear() + 1); break;
    default:           d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

function RecurrenciaModal({ tipo, sourceId, sourceLabel, existing, onClose, onSaved }) {
  const toast = useToast();
  const [periodicidad, setPeriodicidad] = useState(existing?.periodicidad || 'mensual');
  const [proxima, setProxima] = useState(
    existing?.proxima_fecha || defaultProxima('mensual'),
  );
  const [activa, setActiva] = useState(existing?.activa ?? 1);
  const [notas, setNotas] = useState(existing?.notas || '');
  const [saving, setSaving] = useState(false);

  // Si el usuario cambia la periodicidad antes de guardar, sugerimos
  // recalcular la fecha de la proxima — pero solo si la fecha mostrada es
  // la default original (asumimos que si la cambio a mano la quiere mantener).
  useEffect(() => {
    if (!existing) {
      setProxima(defaultProxima(periodicidad));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodicidad]);

  async function guardar() {
    if (!proxima) {
      toast.error('Falta la fecha proxima.');
      return;
    }
    setSaving(true);
    try {
      let res;
      if (existing) {
        res = await window.api.recurrencias.update(existing.id, {
          periodicidad,
          proxima_fecha: proxima,
          activa: activa ? 1 : 0,
          notas,
        });
      } else {
        res = await window.api.recurrencias.create({
          tipo,
          source_id: sourceId,
          periodicidad,
          proxima_fecha: proxima,
          notas,
        });
      }
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(existing ? 'Recurrencia actualizada' : 'Recurrencia creada');
      if (onSaved) onSaved(res);
      onClose();
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function eliminar() {
    if (!existing) return;
    if (!confirm('Eliminar esta recurrencia? La factura/presupuesto base se mantiene intacto.')) {
      return;
    }
    setSaving(true);
    try {
      const res = await window.api.recurrencias.delete(existing.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Recurrencia eliminada');
      if (onSaved) onSaved(null);
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
            <Repeat size={18} className="text-brand" />
            {existing ? 'Recurrencia' : 'Hacer recurrente'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            Cada periodo se generara un nuevo borrador clonando{' '}
            <strong>{sourceLabel}</strong>. Tu lo revisas y lo emites cuando toque.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Frecuencia
            </label>
            <select
              className={inputCls + ' bg-white'}
              value={periodicidad}
              onChange={(e) => setPeriodicidad(e.target.value)}
            >
              {PERIODICIDADES.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Proxima fecha
            </label>
            <input
              type="date"
              className={inputCls}
              value={proxima}
              onChange={(e) => setProxima(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">
              Cuando llegue esta fecha, te avisaremos al abrir la app.
            </p>
          </div>

          {existing && (
            <div>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-brand focus:ring-brand"
                  checked={!!activa}
                  onChange={(e) => setActiva(e.target.checked ? 1 : 0)}
                />
                Activa
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Si la desactivas, la recurrencia se queda guardada pero no
                aparecera en los pendientes hasta que la vuelvas a activar.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Notas (opcional)
            </label>
            <input
              className={inputCls}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Iguala mensual, mantenimiento web, etc."
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-between items-center">
          {existing ? (
            <button
              type="button"
              onClick={eliminar}
              disabled={saving}
              className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
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
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm disabled:opacity-50"
            >
              {saving ? 'Guardando…' : existing ? 'Guardar cambios' : 'Crear recurrencia'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecurrenciaModal;
