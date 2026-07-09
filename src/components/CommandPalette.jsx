// Paleta de busqueda global tipo command palette / cmdk.
//
// Se abre con Ctrl+K (registrado en KeyboardShortcuts.jsx). Modal centrado
// con un input de busqueda y resultados agrupados por tipo: Clientes,
// Presupuestos, Facturas, Gastos. Selecciona con click o Enter (resaltado
// activo navegable con flechas arriba/abajo).
//
// Estrategia: al abrir, hacemos las 4 llamadas IPC en paralelo y guardamos
// los datos en memoria. Filtrado en cliente (lista pequenya, autonomos
// rara vez pasan de 200 entidades). Si en el futuro crece, paginar/ipc.
//
// Props:
//   open       → boolean, controla visibilidad
//   onClose()  → cerrar paleta
//
// Comportamiento: click fuera cierra. Esc cierra. Enter selecciona.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, FileText, Receipt, Wallet, X } from 'lucide-react';
import { formatEUR, formatFechaES } from '../utils/format.js';

function CommandPalette({ open, onClose }) {
  const nav = useNavigate();
  const [query, setQuery] = useState('');
  const [clientes, setClientes] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [deepMatch, setDeepMatch] = useState({ factura_ids: new Set(), presupuesto_ids: new Set() });
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef(null);

  // Cargar datos al abrir. No mantenemos cache entre aperturas — el coste
  // es bajo y asi siempre vemos lo ultimo.
  useEffect(() => {
    if (!open || !window.api) return;
    setQuery('');
    setHighlightIdx(0);
    setDeepMatch({ factura_ids: new Set(), presupuesto_ids: new Set() });
    Promise.all([
      window.api.clientes.list(),
      window.api.presupuestos.list(),
      window.api.facturas.list(),
      window.api.gastos.list(),
    ])
      .then(([cs, ps, fs, gs]) => {
        setClientes(Array.isArray(cs) ? cs : []);
        setPresupuestos(Array.isArray(ps) ? ps : []);
        setFacturas(Array.isArray(fs) ? fs : []);
        setGastos(Array.isArray(gs) ? gs : []);
      })
      .catch(() => { /* silent — la paleta seguira funcionando vacia */ });
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Busqueda profunda (texto en lineas/sublineas/notas) — debounced 200ms
  // para no martillear la BD mientras se escribe. Solo se dispara con >= 2
  // caracteres porque hace LIKE en varias tablas y mas corto no es util.
  useEffect(() => {
    if (!open || !window.api) return;
    const q = query.trim();
    if (q.length < 2) {
      setDeepMatch({ factura_ids: new Set(), presupuesto_ids: new Set() });
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      window.api.search.global(q).then((res) => {
        if (cancelled || !res) return;
        setDeepMatch({
          factura_ids: new Set(res.factura_ids || []),
          presupuesto_ids: new Set(res.presupuesto_ids || []),
        });
      }).catch(() => { /* silent */ });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, query]);

  // Resultado: filtra cada lista por query (limita 8 por grupo para no
  // saturar la UI) y arma una lista plana con saltos de grupo para que
  // las flechas naveguen como un solo array.
  const grupos = useMemo(() => {
    const q = query.trim().toLowerCase();
    function match(text) {
      return !q || text.toLowerCase().includes(q);
    }

    const csFilt = clientes
      .filter((c) => match([c.nombre, c.nif, c.email, c.telefono].filter(Boolean).join(' ')))
      .slice(0, 8)
      .map((c) => ({
        type: 'cliente',
        id: c.id,
        primary: c.nombre,
        secondary: [c.nif, c.email, c.telefono].filter(Boolean).join(' · '),
      }));

    // Para presupuestos/facturas combinamos el match por cabecera (rapido,
    // en memoria) con el match profundo en lineas/sublineas (vino del
    // backend via search:global) — asi un termino que aparece en el
    // contenido de la factura tambien aparece en resultados, con un badge
    // visual indicando que es "match en contenido".
    const psFilt = presupuestos
      .filter((p) => match([p.numero, p.cliente_nombre, p.asunto].filter(Boolean).join(' ')) || deepMatch.presupuesto_ids.has(p.id))
      .slice(0, 8)
      .map((p) => ({
        type: 'presupuesto',
        id: p.id,
        primary: `${p.numero} — ${p.cliente_nombre || p.asunto || 'Sin cliente'}`,
        secondary: `${p.fecha} · ${formatEUR(p.total || 0)} · ${p.estado}`,
        deepHit: deepMatch.presupuesto_ids.has(p.id)
          && !match([p.numero, p.cliente_nombre, p.asunto].filter(Boolean).join(' ')),
      }));

    const fsFilt = facturas
      .filter((f) => match([f.numero, f.cliente_nombre, f.asunto].filter(Boolean).join(' ')) || deepMatch.factura_ids.has(f.id))
      .slice(0, 8)
      .map((f) => ({
        type: 'factura',
        id: f.id,
        primary: `${f.numero} — ${f.cliente_nombre || f.asunto || 'Sin cliente'}`,
        secondary: `${f.fecha} · ${formatEUR(f.total || 0)} · ${f.estado}`,
        deepHit: deepMatch.factura_ids.has(f.id)
          && !match([f.numero, f.cliente_nombre, f.asunto].filter(Boolean).join(' ')),
      }));

    const gsFilt = gastos
      .filter((g) => match([g.proveedor, g.concepto, g.categoria, g.notas].filter(Boolean).join(' ')))
      .slice(0, 8)
      .map((g) => ({
        type: 'gasto',
        id: g.id,
        primary: `${g.proveedor || 'Sin proveedor'} — ${g.concepto || g.categoria || '—'}`,
        secondary: `${formatFechaES(g.fecha)} · ${formatEUR(g.total || 0)}${g.deducible ? '' : ' · no deducible'}`,
      }));

    return { clientes: csFilt, presupuestos: psFilt, facturas: fsFilt, gastos: gsFilt };
  }, [query, clientes, presupuestos, facturas, gastos, deepMatch]);

  // Lista plana de items navegables (para teclado).
  const flatItems = useMemo(
    () => [...grupos.clientes, ...grupos.presupuestos, ...grupos.facturas, ...grupos.gastos],
    [grupos],
  );

  // Reset highlight cuando cambia el filtro o los datos.
  useEffect(() => {
    setHighlightIdx(0);
  }, [query, clientes, presupuestos, facturas, gastos]);

  function elegir(item) {
    onClose?.();
    if (item.type === 'cliente') {
      nav('/clientes');
    } else if (item.type === 'presupuesto') {
      nav(`/presupuestos/${item.id}`);
    } else if (item.type === 'factura') {
      nav(`/facturas/${item.id}`);
    } else if (item.type === 'gasto') {
      // Los gastos no tienen pagina propia — la edicion es modal en /gastos.
      nav('/gastos');
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatItems[highlightIdx]) {
      e.preventDefault();
      elegir(flatItems[highlightIdx]);
    }
  }

  if (!open) return null;

  // Indices base por grupo, para detectar el highlight activo.
  const baseClientes = 0;
  const basePresupuestos = baseClientes + grupos.clientes.length;
  const baseFacturas = basePresupuestos + grupos.presupuestos.length;
  const baseGastos = baseFacturas + grupos.facturas.length;

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-slate-100">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar clientes, presupuestos o facturas…"
            className="w-full pl-12 pr-12 py-4 text-base focus:outline-none placeholder-slate-400"
          />
          <button
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Cerrar (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-2">
          {flatItems.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-500 text-sm">
              {query
                ? `No hay resultados para "${query}".`
                : 'Empieza a escribir para buscar.'}
            </div>
          )}

          <Group
            title="Clientes"
            icon={Users}
            items={grupos.clientes}
            baseIdx={baseClientes}
            highlightIdx={highlightIdx}
            onPick={elegir}
          />
          <Group
            title="Presupuestos"
            icon={FileText}
            items={grupos.presupuestos}
            baseIdx={basePresupuestos}
            highlightIdx={highlightIdx}
            onPick={elegir}
          />
          <Group
            title="Facturas"
            icon={Receipt}
            items={grupos.facturas}
            baseIdx={baseFacturas}
            highlightIdx={highlightIdx}
            onPick={elegir}
          />
          <Group
            title="Gastos"
            icon={Wallet}
            items={grupos.gastos}
            baseIdx={baseGastos}
            highlightIdx={highlightIdx}
            onPick={elegir}
          />
        </div>

        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex items-center gap-4">
          <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">↑↓</kbd> navegar</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">Enter</kbd> abrir</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">Esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}

function Group({ title, icon: Icon, items, baseIdx, highlightIdx, onPick }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-1">
      <div className="px-4 pt-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
        <Icon size={12} />
        {title}
      </div>
      {items.map((it, i) => {
        const idx = baseIdx + i;
        const active = idx === highlightIdx;
        return (
          <button
            key={`${it.type}-${it.id}`}
            onClick={() => onPick(it)}
            onMouseEnter={() => { /* keep keyboard highlight independent */ }}
            className={
              'w-full text-left px-4 py-2.5 flex items-center gap-3 ' +
              (active ? 'bg-brand/10' : 'hover:bg-slate-50')
            }
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-800 truncate flex items-center gap-2">
                {it.primary}
                {it.deepHit && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 font-normal shrink-0"
                    title="Match en el contenido de las lineas o notas"
                  >
                    en contenido
                  </span>
                )}
              </div>
              {it.secondary && (
                <div className="text-xs text-slate-500 truncate">
                  {it.secondary}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default CommandPalette;
