// Sección "Cobros" en el editor de factura. Permite registrar pagos
// parciales recibidos. Muestra barra de progreso (cobrado / total) y
// sugiere pasar la factura a estado "cobrada" cuando se completa el 100%.
//
// NO afecta a los modelos fiscales: el modelo 130/303 sigue contabilizando
// facturas por devengo (emitidas+cobradas según el estado del documento),
// no por suma de cobros parciales. El registro de cobros es solo info
// interna para que el autónomo sepa cuánto ha cobrado realmente.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, BadgeCheck } from 'lucide-react';
import { formatEUR, formatFechaES } from '../utils/format.js';
import { useToast } from './Toast.jsx';

const METODOS = ['Transferencia', 'Bizum', 'Efectivo', 'Tarjeta', 'Otro'];

const inputCls =
  'px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function CobrosSection({ facturaId, totalFactura, onSugerirCobrada, onCobrosChange }) {
  const toast = useToast();
  const [cobros, setCobros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({
    fecha: todayISO(),
    importe: '',
    metodo: 'Transferencia',
    notas: '',
  });

  const recargar = useCallback(async () => {
    if (!window.api || !facturaId) return;
    try {
      const res = await window.api.cobros.list(facturaId);
      const arr = Array.isArray(res) ? res : [];
      setCobros(arr);
      // Notificar al editor para que el PDF preview tenga los cobros al dia
      // (mostrar_en_pdf, fecha, importe). Sin esto, marcar el check no se
      // refleja en la vista previa hasta recargar la pagina.
      if (typeof onCobrosChange === 'function') onCobrosChange(arr);
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [facturaId, toast, onCobrosChange]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const cobrado = useMemo(
    () => cobros.reduce((s, c) => s + (Number(c.importe) || 0), 0),
    [cobros],
  );
  const total = Number(totalFactura) || 0;
  // Rectificativa / abono: el total es negativo y los "cobros" son en realidad
  // devoluciones (importe negativo). Trabajamos siempre con abs() para el
  // progreso visual y completamos cuando |cobrado| >= |total|.
  const esNegativa = total < 0;
  const absTotal = Math.abs(total);
  const absCobrado = Math.abs(cobrado);
  const restante = Math.max(0, Math.round((absTotal - absCobrado) * 100) / 100);
  const pct = absTotal > 0 ? Math.min(100, Math.round((absCobrado / absTotal) * 100)) : 0;
  const completo = absTotal > 0 && absCobrado >= absTotal - 0.001;

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
    if (esNegativa && importeNum > 0) {
      toast.error('En una rectificativa el importe debe ser negativo (devolución)');
      return;
    }
    if (!esNegativa && importeNum < 0) {
      toast.error('Importe debe ser mayor que 0');
      return;
    }
    try {
      const res = await window.api.cobros.create(facturaId, {
        fecha: draft.fecha,
        importe: importeNum,
        metodo: draft.metodo,
        notas: draft.notas || null,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Cobro registrado');
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
    if (!confirm('¿Eliminar este cobro?')) return;
    try {
      const res = await window.api.cobros.delete(id);
      if (res?.error) toast.error(res.error);
      else recargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  // v1.2.36: toggle "mostrar_en_pdf" por cobro. Si =1, el cobro aparece en
  // el PDF como pago a cuenta debajo del TOTAL en rojo. Si =0 (default) es
  // solo contabilidad interna. Optimistic update: cambiamos local y luego
  // persistimos; en fallo recargamos para sincronizar.
  async function toggleMostrarPdf(c) {
    const next = c.mostrar_en_pdf ? 0 : 1;
    setCobros((curr) => {
      const updated = curr.map((x) => x.id === c.id ? { ...x, mostrar_en_pdf: next } : x);
      if (typeof onCobrosChange === 'function') onCobrosChange(updated);
      return updated;
    });
    try {
      const res = await window.api.cobros.update(c.id, {
        ...c,
        mostrar_en_pdf: next,
      });
      if (res?.error) {
        toast.error(res.error);
        recargar();
      }
    } catch (e) {
      toast.error(e.message ?? String(e));
      recargar();
    }
  }

  if (loading) return null;

  return (
    <section className="bg-white rounded-lg shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
          {esNegativa ? 'Devoluciones realizadas' : 'Cobros recibidos'}
        </h3>
        <span className="text-xs text-slate-500">
          {cobros.length}{' '}
          {esNegativa
            ? cobros.length === 1 ? 'devolución' : 'devoluciones'
            : cobros.length === 1 ? 'cobro' : 'cobros'}
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-slate-700">
            {esNegativa ? 'Devuelto' : 'Cobrado'}{' '}
            <strong>{formatEUR(cobrado)}</strong> de {formatEUR(total)}
          </span>
          <span
            className={
              completo
                ? 'text-emerald-700 font-semibold'
                : 'text-slate-600'
            }
          >
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
              {esNegativa
                ? 'Devolución completa. ¿Marcar la rectificativa como liquidada?'
                : 'Factura totalmente cobrada. ¿Marcarla como cobrada?'}
            </span>
            {onSugerirCobrada && (
              <button
                type="button"
                onClick={onSugerirCobrada}
                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
              >
                {esNegativa ? 'Marcar liquidada' : 'Marcar cobrada'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lista de cobros */}
      {cobros.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Método</th>
                <th className="px-3 py-2 font-medium text-right">Importe</th>
                <th className="px-3 py-2 font-medium">Notas</th>
                <th
                  className="px-3 py-2 font-medium text-center w-20"
                  title="Marca para que este cobro aparezca como 'pago a cuenta' en el PDF de la factura"
                >
                  En PDF
                </th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {cobros.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{formatFechaES(c.fecha)}</td>
                  <td className="px-3 py-2 text-slate-700">{c.metodo || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-800">
                    {formatEUR(c.importe)}
                  </td>
                  <td className="px-3 py-2 text-slate-600 text-xs">
                    {c.notas || ''}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!c.mostrar_en_pdf}
                      onChange={() => toggleMostrarPdf(c)}
                      className="h-4 w-4 cursor-pointer accent-brand"
                      title="Mostrar este cobro como 'pago a cuenta' en el PDF (en rojo, bajo el TOTAL)"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => eliminar(c.id)}
                      className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulario añadir */}
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
            type="number" onFocus={(e) => e.target.select()}
            step="0.01"
            className={inputCls + ' w-full text-right'}
            value={draft.importe}
            onChange={(e) => setDraft({ ...draft, importe: e.target.value })}
            placeholder={
              restante > 0
                ? (esNegativa ? '-' : '') + restante.toFixed(2)
                : '0.00'
            }
            title={esNegativa ? 'Devolución: introduce un importe negativo' : ''}
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

export default CobrosSection;
