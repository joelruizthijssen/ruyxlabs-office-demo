// Selector de empresa activa para la sidebar (multi-empresa v1.15).
//
// Muestra la empresa activa con un dropdown que lista todas las demas
// empresas activas + acciones rapidas (Anyadir nueva, Vista combinada).
// Al cambiar de empresa, dispara 'settings-changed' y 'empresa-changed' para
// que la app se refresque (sidebar, ajustes, listings).
//
// La gestion completa (crear/editar/eliminar/duplicar/etc.) vive en Ajustes;
// este componente es solo "switch rapido + atajo a Ajustes".

import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Check, Plus, Eye, EyeOff } from 'lucide-react';

function EmpresaSelector() {
  const [empresas, setEmpresas] = useState([]);
  const [activa, setActiva] = useState(null); // objeto empresa
  const [vistaCombinada, setVistaCombinada] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const wrapperRef = useRef(null);

  async function recargar() {
    if (!window.api) return;
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        window.api.empresas.list(),
        window.api.settings.get(),
      ]);
      const arr = Array.isArray(list) ? list : [];
      setEmpresas(arr);
      const id = s?.empresa_activa_id ?? arr[0]?.id;
      setActiva(arr.find((e) => e.id === id) || arr[0] || null);
      setVistaCombinada(!!s?.vista_combinada);
    } catch { /* noop */ }
    setLoading(false);
  }

  useEffect(() => {
    recargar();
    const onChanged = () => recargar();
    window.addEventListener('settings-changed', onChanged);
    window.addEventListener('empresa-changed', onChanged);
    return () => {
      window.removeEventListener('settings-changed', onChanged);
      window.removeEventListener('empresa-changed', onChanged);
    };
  }, []);

  // Cierra el dropdown al hacer click fuera.
  useEffect(() => {
    function onClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  async function cambiarEmpresa(id) {
    if (!window.api) return;
    if (id === activa?.id) { setOpen(false); return; }
    setOpen(false);
    try {
      await window.api.empresas.setActive(id);
      window.dispatchEvent(new CustomEvent('settings-changed'));
      window.dispatchEvent(new CustomEvent('empresa-changed'));
      window.dispatchEvent(new CustomEvent('data-changed'));
    } catch { /* noop */ }
  }

  async function toggleVistaCombinada() {
    if (!window.api) return;
    try {
      const next = !vistaCombinada;
      // Cargar settings actuales para no perder otras keys.
      const cur = await window.api.settings.get();
      await window.api.settings.update({ ...cur, vista_combinada: next ? 1 : 0 });
      setVistaCombinada(next);
      window.dispatchEvent(new CustomEvent('data-changed'));
    } catch { /* noop */ }
  }

  if (loading || empresas.length === 0) return null;

  const tipoLabel = activa?.tipo === 'empresa' ? 'Empresa' : 'Autónomo';

  return (
    <div ref={wrapperRef} className="relative mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors"
        title="Cambiar empresa activa"
      >
        <Building2 size={16} className="text-brand shrink-0" />
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 truncate">
            {tipoLabel}
          </div>
          <div className="text-sm font-medium truncate">
            {activa?.nombre || 'Sin nombre'}
          </div>
        </div>
        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1 z-30 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
          <ul className="max-h-72 overflow-auto">
            {empresas.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => cambiarEmpresa(e.id)}
                  className={
                    'w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors ' +
                    (e.id === activa?.id
                      ? 'bg-brand/20 text-white'
                      : 'text-slate-200 hover:bg-slate-700')
                  }
                >
                  <Building2 size={14} className="text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{e.nombre || 'Sin nombre'}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {e.tipo === 'empresa' ? 'Empresa' : 'Autónomo'}
                      {e.nif ? ` · ${e.nif}` : ''}
                    </div>
                  </div>
                  {e.id === activa?.id && (
                    <Check size={14} className="text-brand shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-700">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new CustomEvent('navigate-ajustes', { detail: { focus: 'empresas' } }));
                window.location.hash = '#/ajustes?focus=empresas';
              }}
              className="w-full text-left px-3 py-2 flex items-center gap-2 text-sm text-slate-200 hover:bg-slate-700"
            >
              <Plus size={14} className="text-brand" /> Añadir / gestionar empresas
            </button>
            <button
              type="button"
              onClick={toggleVistaCombinada}
              className="w-full text-left px-3 py-2 flex items-center gap-2 text-sm text-slate-200 hover:bg-slate-700"
              title="Cuando está activa, los listados muestran datos de TODAS las empresas a la vez."
            >
              {vistaCombinada ? (
                <Eye size={14} className="text-brand" />
              ) : (
                <EyeOff size={14} className="text-slate-400" />
              )}
              Vista combinada: <span className="ml-auto text-[11px] text-slate-400">{vistaCombinada ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmpresaSelector;
