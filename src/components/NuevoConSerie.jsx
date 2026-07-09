import { useEffect, useRef, useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';

// Boton "Nueva factura" / "Nuevo presupuesto" que se comporta de dos maneras:
// - Si solo hay UNA serie (la general 'A'), es un boton normal que llama
//   onCreate('A') al pulsarlo.
// - Si hay varias series, abre un dropdown con la lista para elegir antes
//   de crear.
//
// Patron clasico de "split button": el click principal usa la default y
// el click en la flecha abre el menu. Para simplificar implementacion, aqui
// usamos un solo boton que se comporta segun el numero de series.
function NuevoConSerie({ series, onCreate, label = 'Nuevo' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const list = Array.isArray(series) && series.length > 0
    ? series
    : [{ id: 'A', label: 'General' }];
  const multiple = list.length > 1;

  useEffect(() => {
    function onClick(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }
  }, [open]);

  function handleClick() {
    if (multiple) {
      setOpen((o) => !o);
    } else {
      onCreate('A');
    }
  }

  function pick(serieId) {
    setOpen(false);
    onCreate(serieId);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg transition-colors"
      >
        <Plus size={18} />
        {label}
        {multiple && <ChevronDown size={16} className="opacity-80" />}
      </button>
      {open && multiple && (
        <div className="absolute right-0 top-full mt-1 min-w-[220px] bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
          <div className="px-3 py-1.5 text-xs uppercase tracking-wide text-slate-500">
            Elegir serie
          </div>
          {list.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(s.id)}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-3"
            >
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                {s.id}
              </span>
              <span className="text-sm text-slate-800">{s.label || s.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default NuevoConSerie;
