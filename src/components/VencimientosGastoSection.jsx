// v1.2.31: Sección "Vencimientos" en el editor de gasto.
// Permite fraccionar un gasto en varios vencimientos con su fecha y su
// importe. Distinto de pagos: vencimientos = lo que TIENES que pagar (fecha
// límite + cuánto); pagos = lo que YA pagaste.
//
// Sigue el mismo patrón de modo dual que PagosGastoSection:
//   - Modo remoto: gastoId presente → IPC window.api.gastosVencimientos.*
//   - Modo local: gastoId null + localVencs/setLocalVencs → lista en memoria
//     que el padre persiste al crear el gasto.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, CalendarClock } from 'lucide-react';
import { formatEUR, formatFechaES } from '../utils/format.js';
import { useToast } from './Toast.jsx';

const inputCls =
  'px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function VencimientosGastoSection({
  gastoId,
  totalGasto,
  localVencs,
  setLocalVencs,
}) {
  const toast = useToast();
  const esLocal = !gastoId && Array.isArray(localVencs);
  const [remote, setRemote] = useState([]);
  const [loading, setLoading] = useState(!esLocal);
  const [draft, setDraft] = useState({
    fecha: todayISO(),
    importe: '',
    notas: '',
  });

  const vencs = esLocal ? localVencs : remote;

  const recargar = useCallback(async () => {
    if (esLocal) { setLoading(false); return; }
    if (!window.api?.gastosVencimientos || !gastoId) return;
    try {
      const res = await window.api.gastosVencimientos.list(gastoId);
      setRemote(Array.isArray(res) ? res : []);
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [esLocal, gastoId, toast]);

  useEffect(() => { recargar(); }, [recargar]);

  const sumaVencs = useMemo(
    () => vencs.reduce((s, v) => s + (Number(v.importe) || 0), 0),
    [vencs],
  );
  const total = Number(totalGasto) || 0;
  const diferencia = Math.round((total - sumaVencs) * 100) / 100;

  async function aniadir() {
    const importeNum = Number(draft.importe);
    if (!draft.fecha) {
      toast.error('Falta la fecha de vencimiento');
      return;
    }
    if (!Number.isFinite(importeNum) || importeNum <= 0) {
      toast.error('El importe debe ser positivo');
      return;
    }
    const payload = {
      fecha: draft.fecha,
      importe: importeNum,
      notas: draft.notas.trim() || null,
    };
    if (esLocal) {
      const _localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setLocalVencs([...localVencs, { _localId, ...payload }]);
    } else {
      try {
        await window.api.gastosVencimientos.create(gastoId, payload);
        await recargar();
      } catch (e) {
        toast.error(e.message ?? String(e));
        return;
      }
    }
    setDraft({ fecha: todayISO(), importe: '', notas: '' });
  }

  async function eliminar(v) {
    if (esLocal) {
      setLocalVencs(localVencs.filter((x) => x._localId !== v._localId));
      return;
    }
    if (!confirm(`¿Eliminar el vencimiento de ${formatFechaES(v.fecha)}?`)) return;
    try {
      await window.api.gastosVencimientos.delete(v.id);
      await recargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  function distribuirIgual(n) {
    if (n < 2) return;
    if (total <= 0) {
      toast.error('Define primero el total del gasto');
      return;
    }
    const cuota = Math.round((total / n) * 100) / 100;
    const ultima = Math.round((total - cuota * (n - 1)) * 100) / 100;
    const base = new Date(draft.fecha || todayISO());
    const nuevos = [];
    for (let i = 0; i < n; i += 1) {
      const d = new Date(base);
      d.setMonth(d.getMonth() + i);
      nuevos.push({
        _localId: `local-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
        fecha: d.toISOString().slice(0, 10),
        importe: i === n - 1 ? ultima : cuota,
        notas: `Cuota ${i + 1} de ${n}`,
      });
    }
    if (esLocal) {
      setLocalVencs([...localVencs, ...nuevos]);
    } else {
      (async () => {
        try {
          for (const v of nuevos) {
            const { _localId, ...payload } = v;
            void _localId;
            await window.api.gastosVencimientos.create(gastoId, payload);
          }
          await recargar();
        } catch (e) {
          toast.error(e.message ?? String(e));
        }
      })();
    }
  }

  return (
    <div className="mt-6 border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-700 inline-flex items-center gap-2">
          <CalendarClock size={16} className="text-slate-500" />
          Vencimientos fraccionados
        </h4>
        {total > 0 ? (
          <div className="text-xs text-slate-600">
            <span>Total {formatEUR(total)} · </span>
            <span>Sumado {formatEUR(sumaVencs)} · </span>
            <span className={diferencia === 0 ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
              {diferencia === 0 ? 'cuadra' : `${diferencia > 0 ? 'falta' : 'sobra'} ${formatEUR(Math.abs(diferencia))}`}
            </span>
          </div>
        ) : null}
      </div>

      {loading ? null : (
        <>
          {vencs.length > 0 ? (
            <table className="w-full text-sm mb-3">
              <thead>
                <tr className="text-left text-slate-500 text-xs uppercase tracking-wide">
                  <th className="py-1 font-medium">Fecha</th>
                  <th className="py-1 font-medium text-right">Importe</th>
                  <th className="py-1 font-medium">Notas</th>
                  <th className="py-1 w-8" />
                </tr>
              </thead>
              <tbody>
                {vencs.map((v) => (
                  <tr key={v.id ?? v._localId} className="border-t border-slate-100">
                    <td className="py-1.5">{formatFechaES(v.fecha)}</td>
                    <td className="py-1.5 text-right font-medium">{formatEUR(v.importe)}</td>
                    <td className="py-1.5 text-slate-500 text-xs">{v.notas || '—'}</td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => eliminar(v)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <label className="block text-[11px] text-slate-500 mb-0.5">Fecha</label>
              <input
                type="date"
                className={inputCls}
                value={draft.fecha}
                onChange={(e) => setDraft({ ...draft, fecha: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-0.5">Importe</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputCls + ' w-28 text-right'}
                placeholder="0,00"
                value={draft.importe}
                onChange={(e) => setDraft({ ...draft, importe: e.target.value })}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[11px] text-slate-500 mb-0.5">Notas (opcional)</label>
              <input
                type="text"
                className={inputCls + ' w-full'}
                placeholder="Cuota 1 de 3, etc."
                value={draft.notas}
                onChange={(e) => setDraft({ ...draft, notas: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={aniadir}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand text-white rounded text-sm hover:bg-brand-dark"
            >
              <Plus size={14} /> Añadir
            </button>
          </div>

          {total > 0 && vencs.length === 0 ? (
            <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
              <span>Atajos:</span>
              <button type="button" onClick={() => distribuirIgual(2)} className="underline hover:text-brand">
                Partir en 2
              </button>
              <span className="text-slate-300">·</span>
              <button type="button" onClick={() => distribuirIgual(3)} className="underline hover:text-brand">
                Partir en 3
              </button>
              <span className="text-slate-300">·</span>
              <button type="button" onClick={() => distribuirIgual(4)} className="underline hover:text-brand">
                Partir en 4
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default VencimientosGastoSection;
