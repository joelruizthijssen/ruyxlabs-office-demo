// Sección "Pagos realizados" en el editor de gasto. Espejo de CobrosSection.
// Una factura de proveedor puede pagarse en uno o varios plazos. Esto NO
// afecta a los modelos 130/303: el modelo sigue contabilizando por devengo
// (gasto deducible = registrado), no por suma de pagos. Es solo info interna
// para que el autónomo sepa cuánto ha desembolsado de cada gasto.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, BadgeCheck } from 'lucide-react';
import { formatEUR, formatFechaES } from '../utils/format.js';
import { useToast } from './Toast.jsx';

const METODOS = ['Transferencia', 'Bizum', 'Efectivo', 'Tarjeta', 'Domiciliación', 'Otro'];

const inputCls =
  'px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Modo local: cuando se monta en el formulario de NUEVO gasto (sin gasto.id
// todavia). El padre pasa localPagos + setLocalPagos para gestionar la lista
// en memoria. Al guardar el gasto, el padre persiste cada pago con el id
// resultante. En modo remoto (gastoId presente) hace API calls como antes.
function PagosGastoSection({ gastoId, totalGasto, localPagos, setLocalPagos }) {
  const toast = useToast();
  const esLocal = !gastoId && Array.isArray(localPagos);
  const [pagosRemote, setPagosRemote] = useState([]);
  const [loading, setLoading] = useState(!esLocal);
  const [draft, setDraft] = useState({
    fecha: todayISO(),
    importe: '',
    metodo: 'Transferencia',
    notas: '',
  });

  const pagos = esLocal ? localPagos : pagosRemote;

  const recargar = useCallback(async () => {
    if (esLocal) { setLoading(false); return; }
    if (!window.api?.pagosGasto || !gastoId) return;
    try {
      const res = await window.api.pagosGasto.list(gastoId);
      setPagosRemote(Array.isArray(res) ? res : []);
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [esLocal, gastoId, toast]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const pagado = useMemo(
    () => pagos.reduce((s, p) => s + (Number(p.importe) || 0), 0),
    [pagos],
  );
  const total = Number(totalGasto) || 0;
  // Abono de proveedor: el gasto sale negativo y los "pagos" son
  // devoluciones recibidas (negativos). Misma lógica que CobrosSection.
  const esNegativo = total < 0;
  const absTotal = Math.abs(total);
  const absPagado = Math.abs(pagado);
  const restante = Math.max(0, Math.round((absTotal - absPagado) * 100) / 100);
  const pct = absTotal > 0 ? Math.min(100, Math.round((absPagado / absTotal) * 100)) : 0;
  const completo = absTotal > 0 && absPagado >= absTotal - 0.001;

  async function añadir() {
    const importeNum = Number(draft.importe);
    if (!draft.fecha) {
      toast.error('Fecha obligatoria');
      return;
    }
    if (!importeNum) {
      toast.error('Importe obligatorio');
      return;
    }
    if (esNegativo && importeNum > 0) {
      toast.error('Abono del proveedor: el importe debe ser negativo');
      return;
    }
    if (!esNegativo && importeNum < 0) {
      toast.error('Importe debe ser mayor que 0');
      return;
    }
    if (esLocal) {
      // Local: solo guardamos en el array del padre. Se persistira tras guardar el gasto.
      const nuevo = {
        _localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fecha: draft.fecha,
        importe: importeNum,
        metodo: draft.metodo,
        notas: draft.notas || null,
      };
      setLocalPagos([...localPagos, nuevo]);
      setDraft({ fecha: todayISO(), importe: '', metodo: draft.metodo, notas: '' });
      return;
    }
    try {
      const res = await window.api.pagosGasto.create(gastoId, {
        fecha: draft.fecha,
        importe: importeNum,
        metodo: draft.metodo,
        notas: draft.notas || null,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Pago registrado');
      setDraft({
        fecha: todayISO(),
        importe: '',
        metodo: draft.metodo,
        notas: '',
      });
      recargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function eliminar(id) {
    if (esLocal) {
      // Local: borrar del array por _localId.
      setLocalPagos(localPagos.filter((p) => p._localId !== id));
      return;
    }
    if (!confirm('¿Eliminar este pago?')) return;
    try {
      const res = await window.api.pagosGasto.delete(id);
      if (res?.error) toast.error(res.error);
      else recargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  if (loading) return null;

  return (
    <section className="border border-slate-200 rounded-lg p-4 bg-slate-50/40">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
          {esNegativo ? 'Abonos recibidos' : 'Pagos realizados'}
        </h3>
        <span className="text-xs text-slate-500">
          {pagos.length}{' '}
          {esNegativo
            ? pagos.length === 1 ? 'abono' : 'abonos'
            : pagos.length === 1 ? 'pago' : 'pagos'}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-slate-700">
            {esNegativo ? 'Recibido' : 'Pagado'}{' '}
            <strong>{formatEUR(pagado)}</strong> de {formatEUR(total)}
          </span>
          <span className={completo ? 'text-emerald-700 font-semibold' : 'text-slate-600'}>
            {pct}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={
              'h-full rounded-full transition-all ' +
              (completo ? 'bg-emerald-500' : 'bg-brand')
            }
            style={{ width: `${pct}%` }}
          />
        </div>
        {restante > 0 && (
          <p className="text-xs text-slate-500 mt-1">
            Restante: {formatEUR(restante)}
          </p>
        )}
        {completo && (
          <div className="mt-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm flex items-center gap-2">
            <BadgeCheck size={16} />
            <span className="flex-1">
              {esNegativo
                ? 'Abono recibido completo.'
                : 'Gasto totalmente pagado.'}
            </span>
          </div>
        )}
      </div>

      {pagos.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-4 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Método</th>
                <th className="px-3 py-2 font-medium text-right">Importe</th>
                <th className="px-3 py-2 font-medium">Notas</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => {
                const rowKey = p.id ?? p._localId;
                return (
                  <tr key={rowKey} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{formatFechaES(p.fecha)}</td>
                    <td className="px-3 py-2 text-slate-700">{p.metodo || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-800">
                      {formatEUR(p.importe)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">
                      {p.notas || ''}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => eliminar(rowKey)}
                        className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-[140px_110px_140px_1fr_auto] gap-2 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">Fecha</label>
          <input
            type="date"
            className={inputCls + ' w-full'}
            value={draft.fecha}
            onChange={(e) => setDraft({ ...draft, fecha: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">Importe (€)</label>
          <input
            type="number"
            onFocus={(e) => e.target.select()}
            step="0.01"
            className={inputCls + ' w-full text-right'}
            value={draft.importe}
            onChange={(e) => setDraft({ ...draft, importe: e.target.value })}
            placeholder={
              restante > 0
                ? (esNegativo ? '-' : '') + restante.toFixed(2)
                : '0.00'
            }
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">Método</label>
          <select
            className={inputCls + ' w-full bg-white'}
            value={draft.metodo}
            onChange={(e) => setDraft({ ...draft, metodo: e.target.value })}
          >
            {METODOS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">Notas</label>
          <input
            className={inputCls + ' w-full'}
            value={draft.notas}
            placeholder="Opcional"
            onChange={(e) => setDraft({ ...draft, notas: e.target.value })}
          />
        </div>
        <button
          type="button"
          onClick={añadir}
          className="px-3 py-1.5 rounded bg-brand hover:bg-brand-dark text-white text-sm inline-flex items-center gap-1.5"
        >
          <Plus size={14} /> Añadir
        </button>
      </div>
    </section>
  );
}

export default PagosGastoSection;
