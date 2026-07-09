import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';

// Editor visual de la lista de series. Recibe el array {id,label}[] como
// `value` y dispara `onChange(nuevoArray)` con cada modificacion. La serie
// 'A' (general) es protegida: no se puede eliminar ni renombrar el id.
//
// Uso desde Ajustes.jsx:
//   <SeriesEditor
//     value={form.series_facturas_list}
//     onChange={(arr) => setField('series_facturas', arr)}
//     kind="facturas"
//   />
function SeriesEditor({ value, onChange, kind }) {
  const series = useMemo(() => {
    const arr = Array.isArray(value) ? value : [];
    if (!arr.find((s) => s.id === 'A')) {
      return [{ id: 'A', label: 'General' }, ...arr];
    }
    return arr;
  }, [value]);

  function update(idx, patch) {
    const next = series.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  }

  function add() {
    onChange([...series, { id: '', label: '' }]);
  }

  function remove(idx) {
    onChange(series.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {series.map((s, idx) => {
        const protegida = s.id === 'A';
        return (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              maxLength={5}
              placeholder="A"
              className="w-20 px-2 py-1.5 border border-slate-300 rounded text-sm font-mono uppercase disabled:bg-slate-100"
              value={s.id || ''}
              disabled={protegida}
              onChange={(e) =>
                update(idx, {
                  id: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                })
              }
              title={protegida ? 'Serie general (no editable)' : 'Identificador (A-Z, 0-9)'}
            />
            <input
              type="text"
              maxLength={60}
              placeholder="Etiqueta (ej: Rectificativas)"
              className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
              value={s.label || ''}
              onChange={(e) => update(idx, { label: e.target.value })}
            />
            <button
              type="button"
              disabled={protegida}
              onClick={() => remove(idx)}
              className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
              title={protegida ? 'No se puede eliminar la serie general' : 'Eliminar serie'}
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 text-sm text-brand hover:text-brand-dark"
      >
        <Plus size={14} /> Añadir serie
      </button>
      <p className="text-xs text-slate-500 mt-2">
        Las series adicionales mantienen su propia numeración. {kind === 'facturas'
          ? 'Las facturas de serie no general llevan prefijo (ej: R-2026/01).'
          : 'Los presupuestos de serie no general llevan prefijo (ej: R-2026/01).'}
      </p>
    </div>
  );
}

export default SeriesEditor;
