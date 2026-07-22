// Modal para marcar un pedido como "recibido". El usuario ajusta la cantidad
// recibida por linea (default = cantidad pedida). Al confirmar:
//   - Se crea un GASTO con las cantidades recibidas (importes calculados con
//     el precio_unitario del pedido + iva_porcentaje del pedido).
//   - Si alguna linea quedo con cantidad pendiente, se genera un PEDIDO nuevo
//     (back-order) en estado 'borrador' con esa cantidad restante. El usuario
//     puede mantenerlo activo (esperando el resto del proveedor) o eliminarlo
//     si renuncia a esa parte del pedido.

import { useEffect, useMemo, useState } from 'react';
import { X, Package, ArrowRight } from 'lucide-react';
import { formatEUR } from '../utils/format.js';

function RecibirPedidoModal({ pedido, lineas, onConfirm, onCancel }) {
  // recibidas: { [linea_id]: number } — default = cantidad pedida.
  const initial = useMemo(() => {
    const out = {};
    for (const l of lineas) {
      out[l.id] = Number(l.cantidad) || 0;
    }
    return out;
  }, [lineas]);
  const [recibidas, setRecibidas] = useState(initial);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  // v1.5.5: diana_pct aplicado a TODAS las lineas del gasto generado.
  const [dianaPct, setDianaPct] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !submitting) onCancel(); }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel, submitting]);

  function setCant(linea_id, v) {
    setRecibidas((curr) => ({ ...curr, [linea_id]: Math.max(0, Number(v) || 0) }));
  }
  function recibirTodo() {
    setRecibidas(initial);
  }
  function recibirNada() {
    const out = {};
    for (const l of lineas) out[l.id] = 0;
    setRecibidas(out);
  }

  // Computar resumen: base, pendientes, hay back-order.
  const { baseRecibida, pendientesCount, totalRecibido } = useMemo(() => {
    let base = 0;
    let pend = 0;
    const iva = Number(pedido?.iva_porcentaje) || 0;
    for (const l of lineas) {
      const cant = Number(l.cantidad) || 0;
      const rec = Number(recibidas[l.id]) || 0;
      const precio = Number(l.precio_unitario) || 0;
      base += rec * precio;
      if (rec < cant) pend += 1;
    }
    const total = base * (1 + iva / 100);
    return {
      baseRecibida: Math.round(base * 100) / 100,
      pendientesCount: pend,
      totalRecibido: Math.round(total * 100) / 100,
    };
  }, [lineas, recibidas, pedido?.iva_porcentaje]);

  async function aceptar() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const recepciones = Object.entries(recibidas).map(([linea_id, cantidad_recibida]) => ({
        linea_id: Number(linea_id),
        cantidad_recibida,
      }));
      await onConfirm({ recepciones, fecha_gasto: fecha, diana_pct_default: dianaPct });
    } catch (e) {
      setError(e?.message || String(e));
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-700">
              <Package size={18} />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              Recibir pedido {pedido?.numero}
            </h2>
          </div>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-700 disabled:opacity-50"
            title="Cancelar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          Marca la cantidad recibida de cada línea. Al confirmar, se generará
          un <strong>gasto</strong> con los importes recibidos. Si dejas algo pendiente,
          se creará un <strong>pedido nuevo</strong> (back-order) con lo que falte.
        </p>

        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={recibirTodo}
            className="text-xs px-2.5 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          >
            Recibido todo
          </button>
          <button
            type="button"
            onClick={recibirNada}
            className="text-xs px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            Nada recibido
          </button>
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600">% Diana:</label>
              <select
                value={dianaPct}
                onChange={(e) => setDianaPct(Number(e.target.value))}
                disabled={submitting}
                className="px-2 py-1 border border-slate-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                title="Se aplica a todas las líneas del gasto generado"
              >
                <option value={0}>—</option>
                <option value={50}>D 50%</option>
                <option value={100}>D 100%</option>
                <option value={-50}>E 50%</option>
                <option value={-100}>E 100%</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600">Fecha del gasto:</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                disabled={submitting}
                className="px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Concepto</th>
                <th className="px-3 py-2 font-medium text-right w-20">Pedido</th>
                <th className="px-3 py-2 font-medium text-right w-24">Recibido</th>
                <th className="px-3 py-2 font-medium text-right w-24">Pendiente</th>
                <th className="px-3 py-2 font-medium text-right w-24">Importe</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => {
                const cant = Number(l.cantidad) || 0;
                const rec = Number(recibidas[l.id]) || 0;
                const pend = Math.max(0, cant - rec);
                const precio = Number(l.precio_unitario) || 0;
                const imp = Math.round(rec * precio * 100) / 100;
                return (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-800">
                      <div className="font-medium">{l.titulo || '—'}</div>
                      {l.descripcion ? (
                        <div className="text-xs text-slate-500 mt-0.5">{l.descripcion}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{cant}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number" step="0.01" min="0" max={cant}
                        value={rec}
                        onChange={(e) => setCant(l.id, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        disabled={submitting}
                        className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </td>
                    <td className={
                      'px-3 py-2 text-right tabular-nums ' +
                      (pend > 0 ? 'text-amber-700 font-medium' : 'text-slate-400')
                    }>
                      {pend > 0 ? pend : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-800">
                      {formatEUR(imp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-slate-600">Base imponible del gasto:</span>
            <span className="font-medium tabular-nums">{formatEUR(baseRecibida)}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-slate-600">Total con IVA {pedido?.iva_porcentaje || 0}%:</span>
            <span className="font-semibold tabular-nums">{formatEUR(totalRecibido)}</span>
          </div>
          {pendientesCount > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-amber-700">
              Se generará un <strong>back-order</strong> con {pendientesCount} línea{pendientesCount !== 1 ? 's' : ''} pendiente{pendientesCount !== 1 ? 's' : ''}. Lo puedes eliminar después si renuncias a recibirlo.
            </div>
          )}
        </div>

        {error ? (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
            {error}
          </div>
        ) : null}

        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={aceptar}
            disabled={submitting || baseRecibida <= 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? 'Generando gasto…' : 'Confirmar recepción'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecibirPedidoModal;
