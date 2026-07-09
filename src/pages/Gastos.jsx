// Pagina "Gastos" — registro de gastos deducibles del autonomo. Lista por
// anyo, edicion via modal. Los datos alimentan el resumen fiscal (Modelos
// 130 y 303).

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Wallet, Pencil, RotateCcw } from 'lucide-react';
import { formatEUR, formatFechaES } from '../utils/format.js';
import { useToast } from '../components/Toast.jsx';
import GastoEditorModal from '../components/GastoEditorModal.jsx';
import ProveedorCombobox from '../components/ProveedorCombobox.jsx';

const TRIMESTRE_LABELS = ['Todo el año', '1T (ene-mar)', '2T (abr-jun)', '3T (jul-sep)', '4T (oct-dic)'];

// Badge de estado de pago basado en pagado_total (suma de pagos_gasto) vs
// total del gasto. Soporta abonos (total negativo) usando valores absolutos.
function EstadoPagoBadge({ total, pagado }) {
  const t = Math.abs(Number(total) || 0);
  const p = Math.abs(Number(pagado) || 0);
  if (t === 0) {
    return <span className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">—</span>;
  }
  if (p === 0) {
    return <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Pendiente</span>;
  }
  if (p >= t - 0.005) {
    return <span className="text-[10px] uppercase tracking-wide text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Pagado</span>;
  }
  return <span className="text-[10px] uppercase tracking-wide text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">Parcial</span>;
}

function Gastos() {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  // trimestre: 0 = todo el año, 1-4 trimestre, -1 = rango personalizado.
  const [trimestre, setTrimestre] = useState(0);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [proveedoresDisp, setProveedoresDisp] = useState([]);
  const [proveedorFiltro, setProveedorFiltro] = useState(null);
  // v1.2.24: filtro "solo vencidos" = fecha_vencimiento < hoy y no pagado del todo.
  const [soloVencidos, setSoloVencidos] = useState(false);
  // v1.2.43: vista vencimientos = solo los que tienen fecha_vencimiento,
  // ordenados por vencimiento ascendente, columna pendiente visible.
  const [vistaVenc, setVistaVenc] = useState(false);

  async function recargar() {
    if (!window.api) {
      setError('Esta aplicación debe ejecutarse desde Electron.');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const esCustom = trimestre === -1;
      if (esCustom && (!desde || !hasta)) {
        setLoading(false);
        return;
      }
      const opts = esCustom
        ? { desde, hasta }
        : (trimestre === 0 ? { anio } : { anio, trimestre });
      if (proveedorFiltro) opts.proveedorId = proveedorFiltro;
      const res = await window.api.gastos.list(opts);
      if (res && res.error) setError(res.error);
      else setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, trimestre, desde, hasta, proveedorFiltro]);

  // v1.2.33: intercepta nav state {abrirGastoId} de la ficha del proveedor
  // (y otras pantallas en el futuro). Al recibir el id, carga el gasto
  // completo y abre el editor automaticamente. Limpia el state para que un
  // refresh manual de la pagina no vuelva a abrirlo.
  useEffect(() => {
    const id = location.state?.abrirGastoId;
    if (!id || !window.api?.gastos) return;
    (async () => {
      try {
        const full = await window.api.gastos.get(id);
        if (full && !full.error) {
          setEditTarget(full);
          setModalOpen(true);
        }
      } catch { /* noop */ }
      navigate(location.pathname, { replace: true, state: {} });
    })();
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!window.api?.proveedores) return;
    window.api.proveedores.list().then((l) =>
      setProveedoresDisp(Array.isArray(l) ? l : []),
    );
  }, []);

  const totales = useMemo(() => {
    let base = 0, iva = 0, total = 0;
    for (const g of items) {
      if (!g.deducible) continue;
      base += Number(g.base_imponible) || 0;
      iva += Number(g.iva_importe) || 0;
      total += Number(g.total) || 0;
    }
    return {
      base: Math.round(base * 100) / 100,
      iva: Math.round(iva * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }, [items]);

  // v1.2.43: cuando "Vista vencimientos" esta activa, mostrar solo los que
  // tienen fecha_vencimiento y ordenarlos por vencimiento ascendente
  // (mas cercano primero — util para ver que toca pagar antes).
  const itemsMostrados = useMemo(() => {
    if (!vistaVenc) return items;
    return items
      .filter((g) => !!g.fecha_vencimiento)
      .slice()
      .sort((a, b) => (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || ''));
  }, [items, vistaVenc]);

  const totalesPend = useMemo(() => {
    if (!vistaVenc) return null;
    let total = 0, pagado = 0, pend = 0;
    for (const g of itemsMostrados) {
      const t = Math.abs(Number(g.total) || 0);
      const p = Math.abs(Number(g.pagado_total) || 0);
      total += t;
      pagado += p;
      pend += Math.max(0, t - p);
    }
    return {
      total: Math.round(total * 100) / 100,
      pagado: Math.round(pagado * 100) / 100,
      pendiente: Math.round(pend * 100) / 100,
    };
  }, [itemsMostrados, vistaVenc]);

  function abrirNuevo(subtipo = 'gasto') {
    // Pasar `subtipo` como objeto-semilla para el modal: si crea un gasto
    // nuevo, lo crea con ese subtipo. Si es 'abono', GastoEditorModal sabe
    // que admite importes negativos sin chillar.
    setEditTarget({ __nuevo: true, subtipo });
    setModalOpen(true);
  }

  async function abrirEditar(g) {
    // La lista no trae las líneas; pedimos el gasto completo (gastos.get
    // adjunta sus líneas, sintetizando una desde la cabecera si es antiguo).
    try {
      const full = await window.api.gastos.get(g.id);
      setEditTarget(full && !full.error ? full : g);
    } catch {
      setEditTarget(g);
    }
    setModalOpen(true);
  }

  async function eliminar(g) {
    if (!confirm(`¿Eliminar gasto del ${g.fecha} (${formatEUR(g.total)})?`)) return;
    try {
      const res = await window.api.gastos.delete(g.id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        recargar();
        toast.success('Gasto eliminado');
      }
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function onSaved() {
    setModalOpen(false);
    setEditTarget(null);
    recargar();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-3xl font-semibold text-slate-800 flex items-center gap-3">
          <Wallet size={28} className="text-brand" />
          Gastos
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => abrirNuevo('abono')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors text-sm"
            title="Crear abono de proveedor (factura rectificativa negativa)"
          >
            <RotateCcw size={16} />
            Nuevo abono
          </button>
          <button
            onClick={() => abrirNuevo('gasto')}
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={18} />
            Nuevo gasto
          </button>
        </div>
      </div>

      {/* Filtros: anyo + trimestre + rango personalizado */}
      <div className="flex items-center gap-3 bg-white rounded-lg shadow-sm p-3 mb-4 flex-wrap">
        {trimestre !== -1 && (
          <label className="text-sm text-slate-600 inline-flex items-center gap-2">
            Año
            <input
              type="number" onFocus={(e) => e.target.select()}
              className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm"
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value) || now.getFullYear())}
            />
          </label>
        )}
        <div className="flex gap-1 flex-wrap">
          {TRIMESTRE_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => setTrimestre(i)}
              className={
                'px-3 py-1.5 rounded text-sm transition-colors ' +
                (trimestre === i
                  ? 'bg-brand text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
              }
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => {
              setTrimestre(-1);
              if (!desde) setDesde(`${anio}-01-01`);
              if (!hasta) setHasta(`${anio}-12-31`);
            }}
            className={
              'px-3 py-1.5 rounded text-sm transition-colors ' +
              (trimestre === -1
                ? 'bg-brand text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
            }
          >
            Personalizado
          </button>
        </div>
        {trimestre === -1 && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
            <span className="text-slate-500 text-sm">→</span>
            <input
              type="date"
              className="px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
        )}
        {/* Filtro por proveedor: incluye los gastos antiguos (texto suelto) que
            matcheen por nombre con la ficha elegida, no solo los enlazados
            por FK. Asi "todos los gastos de Artero" sale completo. */}
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={soloVencidos}
            onChange={(e) => {
              setSoloVencidos(e.target.checked);
              if (e.target.checked) setVistaVenc(false);
            }}
            className="rounded border-slate-300"
          />
          Solo vencidos
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={vistaVenc}
            onChange={(e) => {
              setVistaVenc(e.target.checked);
              if (e.target.checked) setSoloVencidos(false);
            }}
            className="rounded border-slate-300"
          />
          Vista vencimientos
        </label>
        <div className="flex items-center gap-2 min-w-[260px] ml-auto">
          <span className="text-sm text-slate-600 whitespace-nowrap">Proveedor</span>
          <div className="flex-1">
            <ProveedorCombobox
              value={proveedorFiltro}
              onChange={setProveedorFiltro}
              proveedores={proveedoresDisp}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        {loading && <div className="px-6 py-4 text-slate-500">Cargando…</div>}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
              <Wallet size={28} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              Sin gastos en este periodo
            </h3>
            <p className="text-slate-500 text-sm max-w-sm mb-5">
              Apunta los gastos deducibles (suministros, material, asesoría,
              transporte, software, …) para que los modelos 130 y 303 salgan
              más precisos.
            </p>
            <button
              onClick={() => abrirNuevo('gasto')}
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={18} />
              Añadir el primer gasto
            </button>
          </div>
        )}

        {!loading && items.length > 0 && (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-left">
                <tr>
                  <th className="px-6 py-3 font-medium">{vistaVenc ? 'Vencimiento' : 'Fecha'}</th>
                  <th className="px-6 py-3 font-medium">Proveedor</th>
                  <th className="px-6 py-3 font-medium">Concepto</th>
                  <th className="px-6 py-3 font-medium">Estado</th>
                  {vistaVenc ? (
                    <>
                      <th className="px-6 py-3 font-medium text-right">Total</th>
                      <th className="px-6 py-3 font-medium text-right">Pagado</th>
                      <th className="px-6 py-3 font-medium text-right">Pendiente</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-3 font-medium text-right">Base</th>
                      <th className="px-6 py-3 font-medium text-right">IVA</th>
                      <th className="px-6 py-3 font-medium text-right">Total</th>
                    </>
                  )}
                  <th className="px-6 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {itemsMostrados.filter((g) => {
                  if (!soloVencidos) return true;
                  if (!g.fecha_vencimiento) return false;
                  const hoy = new Date().toISOString().slice(0, 10);
                  if (g.fecha_vencimiento >= hoy) return false;
                  // No pagado del todo: pagado < |total|
                  const pagado = Number(g.pagado_total) || 0;
                  const total = Math.abs(Number(g.total) || 0);
                  return pagado < total - 0.005;
                }).map((g) => (
                  <tr
                    key={g.id}
                    className={
                      'border-t border-slate-100 hover:bg-slate-50 ' +
                      (!g.deducible ? 'opacity-60' : '')
                    }
                  >
                    <td className="px-6 py-3 text-slate-700">
                      {vistaVenc ? (
                        <>
                          <div className={
                            g.fecha_vencimiento < new Date().toISOString().slice(0,10)
                              && (Number(g.pagado_total) || 0) < Math.abs(Number(g.total) || 0) - 0.005
                              ? 'text-red-600 font-semibold'
                              : 'font-medium'
                          }>
                            {formatFechaES(g.fecha_vencimiento)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Emitido: {formatFechaES(g.fecha)}
                          </div>
                        </>
                      ) : (
                        <>
                          <div>{formatFechaES(g.fecha)}</div>
                          {g.fecha_vencimiento && (
                            <div className={
                              'text-[11px] ' +
                              (g.fecha_vencimiento < new Date().toISOString().slice(0,10)
                                && (Number(g.pagado_total) || 0) < Math.abs(Number(g.total) || 0) - 0.005
                                ? 'text-red-600 font-semibold'
                                : 'text-slate-400')
                            }>
                              Vto: {formatFechaES(g.fecha_vencimiento)}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-800">
                      {g.proveedor || '—'}
                      {g.subtipo === 'abono' && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                          Abono
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-700">{g.concepto || '—'}</td>
                    <td className="px-6 py-3 text-slate-600">
                      <EstadoPagoBadge total={g.total} pagado={g.pagado_total} />
                      {!g.deducible && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          no deducible
                        </span>
                      )}
                    </td>
                    {vistaVenc ? (
                      <>
                        <td className="px-6 py-3 text-right tabular-nums text-slate-700">
                          {formatEUR(g.total)}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-slate-500">
                          {formatEUR(g.pagado_total || 0)}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums font-semibold text-slate-900">
                          {formatEUR(Math.max(0, Math.abs(Number(g.total) || 0) - Math.abs(Number(g.pagado_total) || 0)))}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-3 text-right tabular-nums text-slate-700">
                          {formatEUR(g.base_imponible)}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-slate-700">
                          {formatEUR(g.iva_importe)}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums font-medium text-slate-900">
                          {formatEUR(g.total)}
                        </td>
                      </>
                    )}
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => abrirEditar(g)}
                          title="Editar"
                          className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => eliminar(g)}
                          title="Eliminar"
                          className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 text-slate-700 font-medium">
                {vistaVenc && totalesPend ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-3 text-right uppercase tracking-wide text-xs">
                      Totales
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatEUR(totalesPend.total)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-slate-500">
                      {formatEUR(totalesPend.pagado)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-red-700">
                      {formatEUR(totalesPend.pendiente)}
                    </td>
                    <td />
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-3 text-right uppercase tracking-wide text-xs">
                      Totales deducibles
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatEUR(totales.base)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatEUR(totales.iva)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatEUR(totales.total)}
                    </td>
                    <td />
                  </tr>
                )}
              </tfoot>
            </table>
          </>
        )}
      </div>

      {modalOpen && (
        <GastoEditorModal
          gasto={editTarget}
          onClose={() => {
            setModalOpen(false);
            setEditTarget(null);
          }}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

export default Gastos;
