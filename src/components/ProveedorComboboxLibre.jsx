// Combobox de proveedor con opcion de texto libre (para pedidos). A
// diferencia de ProveedorCombobox (que solo permite elegir un proveedor
// fichado), este acepta tipear un proveedor "ocasional" sin ficharlo.
//
// Uso:
//   value       = { id: number|null, text: string }
//   onChange(v) = callback con {id, text}
//     - Si eligio de la lista → {id, text: nombre_ficha}
//     - Si tipo libre         → {id: null, text: lo_que_escribio}
//   proveedores = array [{id, nombre, nif, email, ...}]
//   disabled    = bloquea edicion
//
// v1.2.44: extraido de ProveedorCombobox para que Gastos siga usando la
// version clasica (value = id) sin romperse.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X, Check, Edit3 } from 'lucide-react';

function ProveedorComboboxLibre({ value, onChange, proveedores, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const id = value?.id ?? null;
  const text = value?.text ?? '';

  const seleccionado = useMemo(
    () => proveedores.find((p) => p.id === id) || null,
    [proveedores, id],
  );

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return proveedores;
    return proveedores.filter((p) => {
      const haystack = [p.nombre, p.nif, p.email].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [proveedores, query]);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  function elegir(p) {
    onChange({ id: p.id, text: p.nombre || '' });
    setOpen(false);
  }
  function usarTextoLibre() {
    onChange({ id: null, text: query.trim() });
    setOpen(false);
  }
  function limpiar() {
    onChange({ id: null, text: '' });
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtrados.length > 0) elegir(filtrados[0]);
      else if (query.trim()) usarTextoLibre();
    }
  }

  const label = id && seleccionado
    ? seleccionado.nombre
    : (text || '');

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={
          'w-full px-3 py-2 border rounded-lg text-sm flex items-center justify-between gap-2 ' +
          'focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand ' +
          (disabled
            ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
            : 'bg-white border-slate-300 hover:border-slate-400 cursor-pointer')
        }
      >
        <span className="truncate text-left flex-1">
          {label ? (
            <>
              <span className="text-slate-800">{label}</span>
              {id && seleccionado?.nif && (
                <span className="text-slate-400"> · {seleccionado.nif}</span>
              )}
              {!id && text ? (
                <span className="ml-1 text-[10px] text-slate-400 italic">(manual)</span>
              ) : null}
            </>
          ) : (
            <span className="text-slate-400">— Elige un proveedor o tipea manual —</span>
          )}
        </span>
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-[340px] flex flex-col">
          <div className="relative p-2 border-b border-slate-100">
            <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar proveedor o escribir uno manual..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="overflow-y-auto flex-1">
            {query.trim() && !filtrados.some((p) => (p.nombre || '').toLowerCase() === query.trim().toLowerCase()) ? (
              <button
                type="button"
                onClick={usarTextoLibre}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 text-emerald-700 flex items-center gap-2 border-b border-slate-100"
              >
                <Edit3 size={14} className="shrink-0" />
                <span>Usar <strong>"{query.trim()}"</strong> como proveedor manual</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={limpiar}
              className={
                'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-50 ' +
                (!id && !text ? 'text-brand' : 'text-slate-500')
              }
            >
              <X size={14} className="shrink-0" />
              <span className="italic">Sin proveedor</span>
              {(!id && !text) && <Check size={14} className="ml-auto" />}
            </button>

            {filtrados.length === 0 && !query.trim() && (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                No hay proveedores fichados todavía.
              </div>
            )}

            {filtrados.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => elegir(p)}
                className={
                  'w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 ' +
                  (id === p.id ? 'bg-brand/5' : '')
                }
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 truncate">
                    {p.nombre}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {[p.nif, p.email].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                {id === p.id && (
                  <Check size={16} className="shrink-0 text-brand" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProveedorComboboxLibre;
