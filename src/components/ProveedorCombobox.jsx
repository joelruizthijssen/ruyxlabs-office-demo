// Combobox de proveedor con autocomplete + opcion "crear nuevo". Espejo de
// ClienteCombobox adaptado a proveedores. Cuando el usuario escribe un
// nombre que no existe, ofrece crear el proveedor sobre la marcha.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X, Check, Plus } from 'lucide-react';

function ProveedorCombobox({ value, onChange, proveedores, disabled, onCrearNuevo }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const seleccionado = useMemo(
    () => proveedores.find((p) => p.id === value) || null,
    [proveedores, value],
  );

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return proveedores;
    return proveedores.filter((p) => {
      const hay = [p.nombre, p.nif, p.email, p.telefono]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
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

  function elegir(id) {
    onChange(id);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Enter' && filtrados.length > 0) {
      e.preventDefault();
      elegir(filtrados[0].id);
    }
  }

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
          {seleccionado ? (
            <>
              <span className="text-slate-800">{seleccionado.nombre}</span>
              {seleccionado.nif && (
                <span className="text-slate-400"> · {seleccionado.nif}</span>
              )}
            </>
          ) : (
            <span className="text-slate-400">— Elegir proveedor —</span>
          )}
        </span>
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-[320px] flex flex-col">
          <div className="relative p-2 border-b border-slate-100">
            <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar por nombre, NIF, email…"
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="overflow-y-auto flex-1">
            <button
              type="button"
              onClick={() => elegir(null)}
              className={
                'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-50 ' +
                (value === null ? 'text-brand' : 'text-slate-500')
              }
            >
              <X size={14} className="shrink-0" />
              <span className="italic">Sin proveedor (escribir texto)</span>
              {value === null && <Check size={14} className="ml-auto" />}
            </button>

            {filtrados.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                No hay proveedores que coincidan.
              </div>
            )}

            {filtrados.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => elegir(p.id)}
                className={
                  'w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 ' +
                  (value === p.id ? 'bg-brand/5' : '')
                }
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 truncate">{p.nombre}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {[p.nif, p.email, p.telefono].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                {value === p.id && <Check size={16} className="shrink-0 text-brand" />}
              </button>
            ))}

            {onCrearNuevo && (
              <button
                type="button"
                onClick={() => { setOpen(false); onCrearNuevo(query); }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-brand/5 flex items-center gap-2 border-t border-slate-100 text-brand"
              >
                <Plus size={14} />
                <span>
                  Crear proveedor nuevo{query ? `: "${query}"` : ''}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProveedorCombobox;
