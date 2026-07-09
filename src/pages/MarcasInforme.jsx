// Pagina "Ingresos/Gastos por marca". Relacion de ingresos (facturas
// emitidas/cobradas) y gastos etiquetados, agrupados por marca, en un
// periodo (anyo o anyo+trimestre). Las facturas/gastos sin marca van a
// una fila "Sin marca".
//
// Importante: es una vista interna de gestion, NO un documento fiscal. El
// ingreso es la base imponible (sin IVA); el beneficio = ingresos - gastos
// (ambos en base, sin impuestos).

import { useEffect, useRef, useState } from 'react';
import { TrendingUp, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { formatEUR, formatFechaES } from '../utils/format.js';

const TRIMESTRES = [
  { id: 0, nombre: 'Todo el año' },
  { id: 1, nombre: '1T (ene-mar)' },
  { id: 2, nombre: '2T (abr-jun)' },
  { id: 3, nombre: '3T (jul-sep)' },
  { id: 4, nombre: '4T (oct-dic)' },
  { id: -1, nombre: 'Personalizado…' },
];

const SIN_MARCA_KEY = -1;

function MarcasInforme() {
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  // trimestre: 0 = todo el año, 1-4 = trimestre, -1 = personalizado (usa desde/hasta).
  const [trimestre, setTrimestre] = useState(0);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Filtro temporal: subset de marca ids (incluye -1 para "Sin marca").
  // null = sin filtro temporal (se usa la config persistente).
  const [marcasDisponibles, setMarcasDisponibles] = useState([]);
  const [filtroTemporal, setFiltroTemporal] = useState(null);
  const [filtroOpen, setFiltroOpen] = useState(false);
  const filtroRef = useRef(null);
  // v1.2.43: drill-down por marca en modal.
  const [detalle, setDetalle] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  async function abrirDetalle(fila) {
    if (!window.api?.informes?.marcasDetalle) return;
    setDetalleLoading(true);
    setDetalle({ marca_nombre: fila.nombre, ingresos: [], gastos: [] });
    try {
      const esCustom = trimestre === -1;
      const opts = esCustom
        ? { desde, hasta, marcaId: fila.marca_id }
        : { anio, trimestre: trimestre || undefined, marcaId: fila.marca_id };
      const r = await window.api.informes.marcasDetalle(opts);
      if (r && !r.error) setDetalle(r);
    } catch { /* noop */ }
    finally { setDetalleLoading(false); }
  }

  async function cargar() {
    if (!window.api?.informes) return;
    setLoading(true);
    setError(null);
    try {
      // Si estamos en modo personalizado pero falta alguna fecha, no
      // disparamos la query: dejamos los totales como estaban y esperamos
      // a que el usuario rellene ambos campos.
      const esCustom = trimestre === -1;
      if (esCustom && (!desde || !hasta)) {
        setLoading(false);
        return;
      }
      const opts = esCustom
        ? { desde, hasta, marcaIds: filtroTemporal }
        : { anio, trimestre: trimestre || undefined, marcaIds: filtroTemporal };
      const r = await window.api.informes.marcas(opts);
      if (r?.error) setError(r.error);
      else setData(r);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function cargarMarcasDisponibles() {
    if (!window.api?.marcas) return;
    try {
      const l = await window.api.marcas.list();
      setMarcasDisponibles(Array.isArray(l) ? l : []);
    } catch {
      setMarcasDisponibles([]);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, trimestre, desde, hasta, filtroTemporal]);

  useEffect(() => {
    cargarMarcasDisponibles();
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (filtroRef.current && !filtroRef.current.contains(e.target)) {
        setFiltroOpen(false);
      }
    }
    if (filtroOpen) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [filtroOpen]);

  useEffect(() => {
    const onChanged = () => cargar();
    window.addEventListener('empresa-changed', onChanged);
    window.addEventListener('data-changed', onChanged);
    return () => {
      window.removeEventListener('empresa-changed', onChanged);
      window.removeEventListener('data-changed', onChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filas = data?.filas || [];
  const tot = filas.reduce(
    (a, f) => ({
      ingresos: a.ingresos + (f.ingresos_base || 0),
      gastos: a.gastos + (f.gastos_base || 0),
      beneficio: a.beneficio + (f.beneficio || 0),
    }),
    { ingresos: 0, gastos: 0, beneficio: 0 },
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-brand/10 text-brand">
          <TrendingUp size={22} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            Ingresos y gastos por marca
          </h1>
          <p className="text-sm text-slate-500">
            Ingresos = base de facturas emitidas/cobradas. Gastos = base de
            gastos etiquetados a la marca. Vista interna, no fiscal.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {trimestre !== -1 && (
          <>
            <button
              onClick={() => setAnio((a) => a - 1)}
              className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
              aria-label="Año anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-lg font-semibold tabular-nums w-16 text-center">
              {anio}
            </span>
            <button
              onClick={() => setAnio((a) => a + 1)}
              className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
              aria-label="Año siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
        <select
          className="ml-2 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          value={trimestre}
          onChange={(e) => {
            const v = Number(e.target.value);
            setTrimestre(v);
            if (v === -1 && !desde && !hasta) {
              setDesde(`${anio}-01-01`);
              setHasta(`${anio}-12-31`);
            }
          }}
        >
          {TRIMESTRES.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
        {trimestre === -1 && (
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-300">
            <input
              type="date"
              className="px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-brand"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
            <span className="text-slate-500 text-sm">→</span>
            <input
              type="date"
              className="px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-brand"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
        )}
        <div ref={filtroRef} className="relative ml-auto">
          <button
            onClick={() => setFiltroOpen((v) => !v)}
            className={
              'inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ' +
              (filtroTemporal
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')
            }
            title="Filtrar marcas mostradas (no afecta a la configuración global)"
          >
            <Filter size={14} />
            {filtroTemporal
              ? `Mostrando ${filtroTemporal.length} marca${filtroTemporal.length === 1 ? '' : 's'}`
              : 'Filtrar marcas'}
          </button>
          {filtroOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 w-72 bg-white border border-slate-200 rounded-lg shadow-xl p-2">
              <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-600 uppercase">
                  Marcas a mostrar
                </span>
                <button
                  onClick={() => setFiltroTemporal(null)}
                  className="text-xs text-brand hover:text-brand-dark disabled:opacity-50"
                  disabled={!filtroTemporal}
                >
                  Quitar filtro
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {marcasDisponibles.map((m) => {
                  const checked = !filtroTemporal || filtroTemporal.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-brand focus:ring-brand"
                        checked={checked}
                        onChange={(e) => {
                          const base = filtroTemporal
                            ? [...filtroTemporal]
                            : [
                                ...marcasDisponibles.map((mm) => mm.id),
                                SIN_MARCA_KEY,
                              ];
                          const next = e.target.checked
                            ? [...new Set([...base, m.id])]
                            : base.filter((x) => x !== m.id);
                          setFiltroTemporal(next);
                        }}
                      />
                      <span className="flex-1 truncate text-slate-700">
                        {m.nombre_comercial}
                      </span>
                      {m.incluir_en_informe === 0 && (
                        <span className="text-xs text-slate-400">(oculta)</span>
                      )}
                    </label>
                  );
                })}
                <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm border-t border-slate-100 mt-1 pt-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-brand focus:ring-brand"
                    checked={!filtroTemporal || filtroTemporal.includes(SIN_MARCA_KEY)}
                    onChange={(e) => {
                      const base = filtroTemporal
                        ? [...filtroTemporal]
                        : [
                            ...marcasDisponibles.map((mm) => mm.id),
                            SIN_MARCA_KEY,
                          ];
                      const next = e.target.checked
                        ? [...new Set([...base, SIN_MARCA_KEY])]
                        : base.filter((x) => x !== SIN_MARCA_KEY);
                      setFiltroTemporal(next);
                    }}
                  />
                  <span className="flex-1 italic text-slate-500">Sin marca</span>
                </label>
              </div>
              <p className="text-xs text-slate-400 px-2 pt-1 border-t border-slate-100">
                Filtro temporal. Para ocultar siempre una marca, desmárcala en
                Ajustes → Marcas.
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-left">
              <th className="px-4 py-3 font-medium">Marca</th>
              <th className="px-4 py-3 font-medium text-right">Ingresos</th>
              <th className="px-4 py-3 font-medium text-right">Gastos</th>
              <th className="px-4 py-3 font-medium text-right">Beneficio</th>
              <th className="px-4 py-3 font-medium text-right">Fact.</th>
              <th className="px-4 py-3 font-medium text-right">Gastos nº</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No hay datos en este periodo.
                </td>
              </tr>
            ) : (
              filas.map((f) => (
                <tr
                  key={f.marca_id == null ? 'sin' : f.marca_id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => abrirDetalle(f)}
                  title="Click para ver el detalle de facturas y gastos de esta marca"
                >
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {f.nombre}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                    {formatEUR(f.ingresos_base || 0)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600">
                    {formatEUR(f.gastos_base || 0)}
                  </td>
                  <td
                    className={
                      'px-4 py-3 text-right tabular-nums font-semibold ' +
                      ((f.beneficio || 0) >= 0 ? 'text-slate-800' : 'text-red-600')
                    }
                  >
                    {formatEUR(f.beneficio || 0)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                    {f.n_facturas || 0}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                    {f.n_gastos || 0}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {!loading && filas.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-4 py-3 text-slate-800">TOTAL</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                  {formatEUR(tot.ingresos)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-red-600">
                  {formatEUR(tot.gastos)}
                </td>
                <td
                  className={
                    'px-4 py-3 text-right tabular-nums ' +
                    (tot.beneficio >= 0 ? 'text-slate-800' : 'text-red-600')
                  }
                >
                  {formatEUR(tot.beneficio)}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {detalle && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
          onClick={() => setDetalle(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Detalle de marca
                </div>
                <div className="text-lg font-semibold text-slate-800">
                  {detalle.marca_nombre}
                </div>
              </div>
              <button
                onClick={() => setDetalle(null)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {detalleLoading ? (
                <div className="text-center text-slate-400 py-8">Cargando…</div>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-2">
                      Ingresos ({detalle.ingresos.length})
                    </h3>
                    {detalle.ingresos.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">
                        No hay ingresos en este periodo.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600 text-left">
                          <tr>
                            <th className="px-3 py-2 font-medium">Fecha</th>
                            <th className="px-3 py-2 font-medium">Nº</th>
                            <th className="px-3 py-2 font-medium">Cliente</th>
                            <th className="px-3 py-2 font-medium text-right">Base</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalle.ingresos.map((r) => (
                            <tr key={`ing-${r.id}`} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-700">{formatFechaES(r.fecha)}</td>
                              <td className="px-3 py-2 text-slate-700 font-medium">{r.numero || '—'}</td>
                              <td className="px-3 py-2 text-slate-700">{r.contraparte || '—'}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-medium">
                                {formatEUR(r.importe_base)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-2">
                      Gastos ({detalle.gastos.length})
                    </h3>
                    {detalle.gastos.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">
                        No hay gastos en este periodo.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600 text-left">
                          <tr>
                            <th className="px-3 py-2 font-medium">Fecha</th>
                            <th className="px-3 py-2 font-medium">Proveedor</th>
                            <th className="px-3 py-2 font-medium">Concepto</th>
                            <th className="px-3 py-2 font-medium text-right">Base</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalle.gastos.map((r) => (
                            <tr key={`gas-${r.id}`} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-700">{formatFechaES(r.fecha)}</td>
                              <td className="px-3 py-2 text-slate-700">{r.contraparte || '—'}</td>
                              <td className="px-3 py-2 text-slate-700">{r.concepto || '—'}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-red-600 font-medium">
                                {formatEUR(r.importe_base)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarcasInforme;
