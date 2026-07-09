// Sección "Plan de pagos" en el editor de presupuesto. Define hitos de
// pago (descripción + % del total + días desde la conversión). Al convertir
// el presupuesto en factura, se generan N facturas en lugar de 1, una por
// hito, con la fecha calculada desde la conversión.
//
// Si la lista está vacía → comportamiento legacy (1 factura única). Esto
// preserva el flujo actual para presupuestos sin plan de pagos.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from './Toast.jsx';

const inputCls =
  'px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand disabled:bg-slate-100 disabled:cursor-not-allowed';

// Plantillas rápidas para autorrellenar los hitos. Cada plantilla devuelve
// la lista completa de hitos. Si el usuario quiere ajustar las descripciones
// o porcentajes, lo hace después manualmente.
const PLANTILLAS = [
  {
    id: 'unico',
    label: 'Pago único (sin plan)',
    hint: '1 factura al convertir.',
    hitos: [],
  },
  {
    id: '50_50',
    label: '50% anticipo + 50% final',
    hint: 'Anticipo a la aceptación y resto a 30 días.',
    hitos: [
      { descripcion: 'Anticipo', importe_pct: 50, fecha_offset_dias: 0 },
      { descripcion: 'Liquidación final', importe_pct: 50, fecha_offset_dias: 30 },
    ],
  },
  {
    id: '30_70',
    label: '30% anticipo + 70% final',
    hint: '30% al firmar, 70% al entregar.',
    hitos: [
      { descripcion: 'Anticipo', importe_pct: 30, fecha_offset_dias: 0 },
      { descripcion: 'Entrega', importe_pct: 70, fecha_offset_dias: 30 },
    ],
  },
  {
    id: 'tres_partes',
    label: '3 pagos (33% + 33% + 34%)',
    hint: 'Anticipo, mitad de obra y final.',
    hitos: [
      { descripcion: 'Anticipo', importe_pct: 33, fecha_offset_dias: 0 },
      { descripcion: '50% obra ejecutada', importe_pct: 33, fecha_offset_dias: 30 },
      { descripcion: 'Entrega final', importe_pct: 34, fecha_offset_dias: 60 },
    ],
  },
  {
    id: 'mensual_3',
    label: '3 cuotas mensuales',
    hint: 'Tercios igualados (33,33% × 3).',
    hitos: [
      { descripcion: 'Cuota 1 de 3', importe_pct: 33.34, fecha_offset_dias: 0 },
      { descripcion: 'Cuota 2 de 3', importe_pct: 33.33, fecha_offset_dias: 30 },
      { descripcion: 'Cuota 3 de 3', importe_pct: 33.33, fecha_offset_dias: 60 },
    ],
  },
  {
    id: 'mensual_6',
    label: '6 cuotas mensuales',
    hint: 'Sextos igualados.',
    hitos: Array.from({ length: 6 }, (_, i) => ({
      descripcion: `Cuota ${i + 1} de 6`,
      importe_pct: i === 0 ? 16.7 : 16.66,
      fecha_offset_dias: i * 30,
    })),
  },
];

function PlanPagosSection({ presupuestoId, disabled = false, onHitosChange }) {
  const toast = useToast();
  const [hitos, setHitos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const recargar = useCallback(async () => {
    if (!window.api || !presupuestoId) return;
    try {
      const res = await window.api.hitosPago.list(presupuestoId);
      const list = Array.isArray(res) ? res : [];
      setHitos(list);
      setDirty(false);
      onHitosChange?.(list);
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [presupuestoId, toast, onHitosChange]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const totalPct = useMemo(
    () => hitos.reduce((s, h) => s + (Number(h.importe_pct) || 0), 0),
    [hitos],
  );
  const totalPctRounded = Math.round(totalPct * 100) / 100;
  const sumaOk = Math.abs(totalPctRounded - 100) < 0.5; // tolerancia 0.5pp

  function aplicarPlantilla(plantilla) {
    setHitos(plantilla.hitos.map((h) => ({ ...h })));
    setDirty(true);
  }

  function addHito() {
    setHitos([
      ...hitos,
      {
        descripcion: `Hito ${hitos.length + 1}`,
        importe_pct: 0,
        fecha_offset_dias: 0,
      },
    ]);
    setDirty(true);
  }

  function patchHito(idx, patch) {
    setHitos(hitos.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
    setDirty(true);
  }

  function removeHito(idx) {
    setHitos(hitos.filter((_, i) => i !== idx));
    setDirty(true);
  }

  async function guardar() {
    setSaving(true);
    try {
      const res = await window.api.hitosPago.replace(presupuestoId, hitos);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Plan de pagos guardado');
      setDirty(false);
      recargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <section className="bg-white rounded-lg shadow-sm p-5">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
            Plan de pagos
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Opcional. Si lo defines, al convertir el presupuesto en factura
            se generará una factura por hito.
          </p>
        </div>
        {hitos.length > 0 && (
          <button
            type="button"
            onClick={addHito}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-sm text-brand hover:text-brand-dark disabled:opacity-40"
          >
            <Plus size={14} /> Añadir hito
          </button>
        )}
      </div>

      {/* Plantillas rapidas */}
      <div className="mb-4">
        <label className="block text-xs text-slate-500 mb-1.5">
          Plantillas rápidas
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PLANTILLAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => aplicarPlantilla(p)}
              disabled={disabled}
              title={p.hint}
              className="px-2.5 py-1 rounded border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {hitos.length === 0 && (
        <div className="text-sm text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded">
          Sin hitos. El presupuesto se convertirá en una sola factura.
        </div>
      )}

      {hitos.length > 0 && (
        <>
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-3">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-left text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium w-8">#</th>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 font-medium text-right w-24">% del total</th>
                  <th className="px-3 py-2 font-medium text-right w-32">Días desde conversión</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {hitos.map((h, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-500 tabular-nums">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        className={inputCls + ' w-full'}
                        value={h.descripcion || ''}
                        disabled={disabled}
                        onChange={(e) => patchHito(idx, { descripcion: e.target.value })}
                        placeholder="Anticipo, Hito 1, …"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number" onFocus={(e) => e.target.select()}
                        step="0.01"
                        className={inputCls + ' w-full text-right'}
                        value={h.importe_pct ?? 0}
                        disabled={disabled}
                        onChange={(e) =>
                          patchHito(idx, {
                            importe_pct: e.target.value === '' ? 0 : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number" onFocus={(e) => e.target.select()}
                        className={inputCls + ' w-full text-right'}
                        value={h.fecha_offset_dias ?? 0}
                        disabled={disabled}
                        onChange={(e) =>
                          patchHito(idx, {
                            fecha_offset_dias: e.target.value === '' ? 0 : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => removeHito(idx)}
                        disabled={disabled}
                        className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-right">
                    Total
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold ${sumaOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {totalPctRounded}%
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {!sumaOk && (
            <div className="mb-3 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              La suma de los porcentajes debe ser 100% para que las facturas
              cuadren con el total del presupuesto.
            </div>
          )}

          {dirty && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={guardar}
                disabled={disabled || saving}
                className="px-3 py-1.5 rounded bg-brand hover:bg-brand-dark text-white text-sm disabled:opacity-60"
              >
                {saving ? 'Guardando…' : 'Guardar plan'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default PlanPagosSection;
