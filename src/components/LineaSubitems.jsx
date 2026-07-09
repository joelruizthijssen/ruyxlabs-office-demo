// Lista de subitems de una linea (modo detallado). Componente compartido entre
// PresupuestoEditor y FacturaEditor — se diferencian solo en el `kind` y la
// API IPC que usan.
//
// Props:
//   - lineaId: id numerico de la linea padre.
//   - kind: 'presupuesto' | 'factura' — selecciona la API IPC.
//   - subitems: array controlado de subitems (con id, descripcion, cantidad,
//     precio_unitario, importe).
//   - onChange(newList): se llama cada vez que cambia la lista local. El
//     padre debe actualizar su estado y, si quiere, recalcular el importe de
//     la linea como suma.
//   - disabled: bloquea inputs.
//
// Persistencia:
//   - Los cambios de campos se guardan con debounce 500ms via api[kind].update.
//   - Crear/borrar subitem son sincronos (un click → una IPC).

import { useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';

function LineaSubitems({ lineaId, kind, subitems, onChange, disabled }) {
  const apiNS = useMemo(
    () =>
      kind === 'factura'
        ? window.api?.sublineasFactura
        : window.api?.sublineasPresupuesto,
    [kind],
  );

  const timersRef = useRef(new Map());

  function patchSub(subId, patch) {
    if (disabled) return;
    const newList = subitems.map((s) => {
      if (s.id !== subId) return s;
      const merged = { ...s, ...patch };
      // Auto-calc del importe SOLO si el usuario no toco directamente importe
      // y hay cantidad + precio. Si toca importe a mano, lo respetamos.
      if (!('importe' in patch)) {
        const cVal = merged.cantidad;
        const pVal = merged.precio_unitario;
        const cSet = cVal !== null && cVal !== undefined && cVal !== '';
        const pSet = pVal !== null && pVal !== undefined && pVal !== '';
        if (cSet && pSet) {
          merged.importe = Math.round(Number(cVal) * Number(pVal) * 100) / 100;
        }
      }
      return merged;
    });
    onChange(newList);

    const prev = timersRef.current.get(subId);
    if (prev) clearTimeout(prev);
    const t = setTimeout(async () => {
      const sub = newList.find((s) => s.id === subId);
      if (!sub) return;
      try {
        await apiNS.update(subId, {
          descripcion: sub.descripcion ?? '',
          cantidad:
            sub.cantidad === '' || sub.cantidad == null
              ? null
              : Number(sub.cantidad),
          precio_unitario:
            sub.precio_unitario === '' || sub.precio_unitario == null
              ? null
              : Number(sub.precio_unitario),
          importe: Number(sub.importe) || 0,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[sublineas] update fallo:', e);
      }
    }, 500);
    timersRef.current.set(subId, t);
  }

  async function addSub() {
    if (disabled) return;
    try {
      const res = await apiNS.create(lineaId, {
        descripcion: '',
        importe: 0,
      });
      if (res && !res.error) {
        onChange([...subitems, res]);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[sublineas] create fallo:', e);
    }
  }

  async function delSub(subId) {
    if (disabled) return;
    onChange(subitems.filter((s) => s.id !== subId));
    try {
      await apiNS.delete(subId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[sublineas] delete fallo:', e);
    }
  }

  // Limpiar timers al desmontar.
  useEffect(() => {
    const map = timersRef.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  return (
    <div className="mt-2 pl-3 border-l-2 border-slate-200 space-y-1.5">
      {subitems.length === 0 && (
        <div className="text-xs text-slate-400 italic py-0.5">
          Sin subitems aún. Pulsa "+ Subitem" para añadir uno.
        </div>
      )}
      {subitems.map((s) => {
        const cVal = s.cantidad;
        const pVal = s.precio_unitario;
        const cSet = cVal !== null && cVal !== undefined && cVal !== '';
        const pSet = pVal !== null && pVal !== undefined && pVal !== '';
        const isCalc = cSet && pSet;
        return (
          <div key={s.id} className="flex gap-1.5 items-center">
            <input
              className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
              placeholder="Concepto (ej: Lijado)"
              value={s.descripcion ?? ''}
              disabled={disabled}
              onChange={(e) =>
                patchSub(s.id, { descripcion: e.target.value })
              }
            />
            <input
              type="number" onFocus={(e) => e.target.select()}
              step="0.01"
              className="w-14 px-2 py-1 border border-slate-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
              placeholder="qty"
              value={cVal ?? ''}
              disabled={disabled}
              onChange={(e) =>
                patchSub(s.id, {
                  cantidad: e.target.value === '' ? null : e.target.value,
                })
              }
              title="Cantidad (opcional)"
            />
            <span className="text-xs text-slate-300">×</span>
            <input
              type="number" onFocus={(e) => e.target.select()}
              step="0.01"
              className="w-16 px-2 py-1 border border-slate-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
              placeholder="precio"
              value={pVal ?? ''}
              disabled={disabled}
              onChange={(e) =>
                patchSub(s.id, {
                  precio_unitario:
                    e.target.value === '' ? null : e.target.value,
                })
              }
              title="Precio unitario (opcional)"
            />
            <span className="text-xs text-slate-300">=</span>
            <div className="relative w-24">
              <input
                type="number" onFocus={(e) => e.target.select()}
                step="0.01"
                className={
                  'w-full pr-5 pl-2 py-1 border rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-brand ' +
                  (isCalc
                    ? 'border-slate-100 bg-slate-50 text-slate-600 cursor-not-allowed'
                    : 'border-slate-200 focus:border-brand')
                }
                value={Number(s.importe) || 0}
                readOnly={isCalc}
                disabled={disabled}
                onChange={(e) =>
                  patchSub(s.id, {
                    importe:
                      e.target.value === ''
                        ? 0
                        : Number(e.target.value) || 0,
                  })
                }
                title={isCalc ? 'Calculado automáticamente' : 'Importe directo'}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                €
              </span>
            </div>
            <button
              onClick={() => delSub(s.id)}
              disabled={disabled}
              className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-30"
              title="Eliminar subitem"
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
      <button
        onClick={addSub}
        disabled={disabled}
        className="text-xs text-brand hover:text-brand-dark inline-flex items-center gap-1 disabled:opacity-50"
      >
        <Plus size={12} /> Subitem
      </button>
    </div>
  );
}

export default LineaSubitems;
