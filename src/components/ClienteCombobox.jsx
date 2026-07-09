// Combobox con buscador para elegir cliente. Sustituye a un <select> simple
// cuando hay muchos clientes y desplazarse por una lista plana es lento.
//
// Props:
//   value         → cliente_id seleccionado (number o null)
//   onChange(id)  → callback con el id elegido (o null si "sin cliente")
//   clientes      → array completo de clientes [{ id, nombre, nif, email, ... }]
//   disabled      → bloquea la edicion (factura/presupuesto bloqueados)
//
// Comportamiento:
// - Trigger muestra el cliente seleccionado o "Sin cliente (usar asunto)".
// - Al abrir, focus automatico en el input de busqueda.
// - Filtra por nombre/NIF/email/telefono mientras escribes.
// - Click fuera cierra. Esc cierra. Enter selecciona el primero filtrado.
// - Click en "Sin cliente" desasigna y deja el campo libre.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

function ClienteCombobox({ value, onChange, clientes, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const seleccionado = useMemo(
    () => clientes.find((c) => c.id === value) || null,
    [clientes, value],
  );

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => {
      const haystack = [c.nombre, c.nif, c.email, c.telefono]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [clientes, query]);

  // Cerrar al hacer click fuera.
  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (!wrapperRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  // Auto-focus en el input cuando abre, y reset query.
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
            <span className="text-slate-400">— Sin cliente (usar asunto) —</span>
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
              <span className="italic">Sin cliente (usar asunto)</span>
              {value === null && <Check size={14} className="ml-auto" />}
            </button>

            {filtrados.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                No hay clientes que coincidan.
              </div>
            )}

            {filtrados.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => elegir(c.id)}
                className={
                  'w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 ' +
                  (value === c.id ? 'bg-brand/5' : '')
                }
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 truncate">
                    {c.nombre}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {[c.nif, c.email, c.telefono].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                {value === c.id && (
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

export default ClienteCombobox;
