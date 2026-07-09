// Modal de creacion de recurrencia "desde catalogo" (modo='catalogo' en BD).
//
// El usuario elige:
// - Cliente al que se enviaran las facturas/presupuestos generados
// - Tipo de documento: factura o presupuesto
// - 1+ lineas (productos del catalogo, o texto libre con precio manual)
// - Periodicidad + fecha de la primera generacion
//
// Al confirmar, se crea la recurrencia. Las lineas viven en
// `recurrencia_lineas` y se reproducen como lineas del documento cada
// vez que se ejecuta `recurrencias.generar(id)`.

import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Package, Calendar } from 'lucide-react';
import ClienteCombobox from './ClienteCombobox.jsx';
import ProductoAutocomplete from './ProductoAutocomplete.jsx';
import { formatEUR } from '../utils/format.js';

const PERIODICIDADES = [
  { id: 'semanal',    label: 'Semanal'    },
  { id: 'mensual',    label: 'Mensual'    },
  { id: 'trimestral', label: 'Trimestral' },
  { id: 'anual',      label: 'Anual'      },
];

function emptyLinea() {
  return {
    producto_id: null,
    titulo: '',
    descripcion: '',
    cantidad: 1,
    precio_unitario: 0,
    iva_pct: 21,
    _key: Math.random().toString(36).slice(2),
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function RecurrenciaCatalogoModal({ onClose, onSaved }) {
  const [clienteId, setClienteId] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [tipoDoc, setTipoDoc] = useState('factura');
  const [periodicidad, setPeriodicidad] = useState('mensual');
  const [proximaFecha, setProximaFecha] = useState(todayISO());
  const [notas, setNotas] = useState('');
  const [lineas, setLineas] = useState(() => [emptyLinea()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Cargar lista de clientes al montar (la pasamos a ClienteCombobox).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await window.api.clientes.list();
        if (!cancelled && Array.isArray(list)) setClientes(list);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  function patchLinea(idx, patch) {
    setLineas((arr) => arr.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLinea() {
    setLineas((arr) => [...arr, emptyLinea()]);
  }
  function removeLinea(idx) {
    setLineas((arr) => (arr.length <= 1 ? arr : arr.filter((_, i) => i !== idx)));
  }
  function onSelectProducto(idx, p) {
    if (!p) return;
    patchLinea(idx, {
      producto_id: p.id,
      titulo: p.nombre,
      descripcion: p.descripcion || '',
      precio_unitario: Number(p.precio_unitario) || 0,
      iva_pct: Number(p.iva_pct) || 21,
    });
  }

  const total = lineas.reduce((s, l) => {
    return s + (Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0);
  }, 0);

  async function guardar() {
    if (!clienteId) {
      setError('Selecciona un cliente.');
      return;
    }
    if (lineas.length === 0 || !lineas.some((l) => (l.titulo || '').trim())) {
      setError('Añade al menos una línea con título.');
      return;
    }
    if (!proximaFecha) {
      setError('Indica la fecha de la próxima generación.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await window.api.recurrencias.create({
        modo: 'catalogo',
        tipo_doc: tipoDoc,
        cliente_id: clienteId,
        periodicidad,
        proxima_fecha: proximaFecha,
        notas: notas || null,
        lineas: lineas
          .filter((l) => (l.titulo || '').trim())
          .map((l) => ({
            producto_id: l.producto_id,
            titulo: l.titulo,
            descripcion: l.descripcion || null,
            cantidad: Number(l.cantidad) || 1,
            precio_unitario: Number(l.precio_unitario) || 0,
            iva_pct: Number(l.iva_pct) || 21,
          })),
      });
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
    'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Package size={16} className="text-brand" />
            Nueva recurrencia desde catálogo
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            title="Cancelar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Cliente + tipo doc */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Cliente *</label>
              <ClienteCombobox
                value={clienteId}
                onChange={setClienteId}
                clientes={clientes}
              />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <select
                value={tipoDoc}
                onChange={(e) => setTipoDoc(e.target.value)}
                className={inputCls}
              >
                <option value="factura">Factura</option>
                <option value="presupuesto">Presupuesto</option>
              </select>
            </div>
          </div>

          {/* Líneas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Líneas a facturar
              </h3>
              <button
                type="button"
                onClick={addLinea}
                className="inline-flex items-center gap-1 text-sm text-brand hover:text-brand-dark"
              >
                <Plus size={14} /> Añadir línea
              </button>
            </div>
            <div className="space-y-2">
              {lineas.map((l, idx) => (
                <div
                  key={l._key}
                  className="grid grid-cols-12 gap-2 items-start p-2 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <div className="col-span-5">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide">Concepto</label>
                    <ProductoAutocomplete
                      value={l.titulo}
                      onChange={(v) => patchLinea(idx, { titulo: v })}
                      onSelectProducto={(p) => onSelectProducto(idx, p)}
                      placeholder="Producto o servicio…"
                      className={inputCls}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide">Cantidad</label>
                    <input
                      type="number" onFocus={(e) => e.target.select()}
                      step="0.01"
                      className={inputCls + ' text-right'}
                      value={l.cantidad}
                      onChange={(e) => patchLinea(idx, { cantidad: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide">Precio uni.</label>
                    <input
                      type="number" onFocus={(e) => e.target.select()}
                      step="0.01"
                      className={inputCls + ' text-right'}
                      value={l.precio_unitario}
                      onChange={(e) => patchLinea(idx, { precio_unitario: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide">IVA %</label>
                    <input
                      type="number" onFocus={(e) => e.target.select()}
                      step="0.01"
                      className={inputCls + ' text-right'}
                      value={l.iva_pct}
                      onChange={(e) => patchLinea(idx, { iva_pct: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1 flex items-end justify-end h-full">
                    <button
                      type="button"
                      onClick={() => removeLinea(idx)}
                      disabled={lineas.length <= 1}
                      className="p-2 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-sm text-slate-700">
              Total estimado (sin IVA): <span className="font-medium">{formatEUR(total)}</span>
            </div>
          </div>

          {/* Periodicidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Periodicidad *</label>
              <select
                value={periodicidad}
                onChange={(e) => setPeriodicidad(e.target.value)}
                className={inputCls}
              >
                {PERIODICIDADES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                <Calendar size={11} className="inline -mt-0.5 mr-0.5" />
                Próxima generación *
              </label>
              <input
                type="date"
                className={inputCls}
                value={proximaFecha}
                onChange={(e) => setProximaFecha(e.target.value)}
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className={labelCls}>Notas (opcional)</label>
            <textarea
              rows={2}
              className={inputCls}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Información interna (no aparece en el PDF)"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button
            onClick={onClose}
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
            {submitting ? 'Creando…' : 'Crear recurrencia'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecurrenciaCatalogoModal;
