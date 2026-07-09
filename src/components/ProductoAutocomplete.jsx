// Autocomplete sobre el catalogo de productos. Reemplaza al input del
// "Titulo" de una linea cuando la empresa tiene tipo_negocio != 'servicios'.
//
// Comportamiento:
//   - Es un input normal hasta que el usuario empieza a escribir.
//   - Mientras hay foco y texto, debajo aparece una lista flotante con los
//     productos que coinciden (busqueda por nombre Y por codigo).
//   - Al hacer click en un producto: el padre recibe el objeto entero via
//     onSelectProducto(producto) — se aplica el patch que quiera (titulo,
//     importe, iva, descripcion).
//   - Si lo que el usuario escribe no matchea ningun producto, no pasa
//     nada: simplemente sigue siendo texto libre.
//
// Reutiliza el patron de ClienteCombobox (búsqueda en vivo, Esc cierra,
// Enter selecciona el primero, click fuera cierra).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Package } from 'lucide-react';
import { formatEUR } from '../utils/format.js';

function ProductoAutocomplete({
  value,
  onChange,
  onSelectProducto,
  disabled,
  className,
  placeholder,
}) {
  const [productos, setProductos] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!window.api) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await window.api.productos.list();
        if (!cancelled) setProductos(Array.isArray(list) ? list : []);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Cierra al hacer click fuera.
  useEffect(() => {
    function onClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) return productos.slice(0, 6); // si vacio: top 6 alfabeticos
    return productos
      .filter((p) => {
        const hay = `${p.codigo || ''} ${p.nombre || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [productos, value]);

  function seleccionar(p) {
    setOpen(false);
    if (onSelectProducto) onSelectProducto(p);
    else if (onChange) onChange(p.nombre);
  }

  function onKeyDown(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      if (filtered[highlight]) {
        e.preventDefault();
        seleccionar(filtered[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        className={className}
        placeholder={placeholder}
        value={value ?? ''}
        disabled={disabled}
        onFocus={() => { setOpen(true); setHighlight(0); }}
        onChange={(e) => {
          if (onChange) onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
      />
      {open && filtered.length > 0 && (
        <ul
          className="absolute z-30 left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-auto min-w-full"
          style={{ width: 'max-content', maxWidth: 'min(560px, 90vw)' }}
        >
          {filtered.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); seleccionar(p); }}
                onMouseEnter={() => setHighlight(i)}
                title={
                  (p.codigo ? p.codigo + ' · ' : '') +
                  (p.nombre || '') +
                  (p.descripcion ? '\n' + p.descripcion : '')
                }
                className={
                  'w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors whitespace-nowrap ' +
                  (i === highlight ? 'bg-brand/10' : 'hover:bg-slate-50')
                }
              >
                <Package size={13} className="text-brand shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-slate-800">
                    {p.codigo && (
                      <span className="font-mono text-xs text-slate-500 mr-2">
                        {p.codigo}
                      </span>
                    )}
                    {p.nombre}
                  </div>
                  {p.descripcion && (
                    <div className="text-xs text-slate-500 truncate">
                      {p.descripcion}
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-600 tabular-nums shrink-0 pl-2">
                  {formatEUR(p.precio_unitario || 0)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ProductoAutocomplete;
