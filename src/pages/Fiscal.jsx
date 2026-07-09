// Pagina "Resumen fiscal" — vista trimestral con los numeros relevantes
// para los modelos 130 (IRPF) y 303 (IVA), autonomos en estimacion directa.
//
// Importante: NO sustituye al asesoramiento profesional. Las cifras son
// estimaciones basadas en los registros de la app (facturas emitidas + gastos
// marcados como deducibles).

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calculator, AlertTriangle, ChevronLeft, ChevronRight, Wallet, X, List } from 'lucide-react';
import { formatEUR, formatFechaES } from '../utils/format.js';

const TRIMESTRE_LABELS = [
  { id: 1, nombre: '1T (ene-mar)' },
  { id: 2, nombre: '2T (abr-jun)' },
  { id: 3, nombre: '3T (jul-sep)' },
  { id: 4, nombre: '4T (oct-dic)' },
];

function StatRow({ label, value, hint, accent }) {
  const accents = {
    base:    'text-slate-700',
    iva:     'text-blue-700',
    irpf:    'text-amber-700',
    modelo:  'text-emerald-700',
  };
  return (
    <div className="flex items-baseline justify-between py-3 border-b border-slate-100 last:border-0">
      <div className="flex-1">
        <div className={`font-medium ${accents[accent] || 'text-slate-700'}`}>
          {label}
        </div>
        {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${accents[accent] || 'text-slate-800'}`}>
        {value}
      </div>
    </div>
  );
}

function Fiscal() {
  const nav = useNavigate();
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  const [trimestre, setTrimestre] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [modoCustom, setModoCustom] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // v1.2.38: modal con el listado de facturas o gastos del periodo. Madre lo
  // pidio: "clicas en ingresos / gastos deducibles y sale listado para ver
  // de donde vienen los importes". `detalleTipo` = 'facturas' | 'gastos' | null.
  const [detalleTipo, setDetalleTipo] = useState(null);
  const [detalleItems, setDetalleItems] = useState([]);
  const [detalleLoading, setDetalleLoading] = useState(false);

  async function abrirDetalle(tipo) {
    setDetalleTipo(tipo);
    setDetalleLoading(true);
    setDetalleItems([]);
    try {
      const opts = modoCustom ? { desde, hasta, tipo } : { anio, trimestre, tipo };
      const res = await window.api.fiscal.detalle(opts);
      setDetalleItems(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setDetalleLoading(false);
    }
  }

  async function cargar() {
    if (!window.api) return;
    setLoading(true);
    setError(null);
    try {
      if (modoCustom && (!desde || !hasta)) {
        setLoading(false);
        return;
      }
      const opts = modoCustom ? { desde, hasta } : { anio, trimestre };
      const r = await window.api.fiscal.resumen(opts);
      if (r?.error) setError(r.error);
      else setResumen(r);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, trimestre, modoCustom, desde, hasta]);

  const trimActual = useMemo(
    () => TRIMESTRE_LABELS.find((t) => t.id === trimestre),
    [trimestre],
  );

  function prevTrim() {
    if (trimestre === 1) {
      setAnio((y) => y - 1);
      setTrimestre(4);
    } else {
      setTrimestre((t) => t - 1);
    }
  }
  function nextTrim() {
    if (trimestre === 4) {
      setAnio((y) => y + 1);
      setTrimestre(1);
    } else {
      setTrimestre((t) => t + 1);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800 flex items-center gap-3">
            <Calculator size={28} className="text-brand" />
            Resumen fiscal
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Estimación trimestral basada en tus facturas emitidas y cobradas.
          </p>
        </div>
      </div>

      {/* Selector de trimestre/anyo o rango personalizado */}
      <div className="flex items-center justify-center gap-3 bg-white rounded-lg shadow-sm p-3 mb-4 flex-wrap">
        {!modoCustom ? (
          <>
            <button
              onClick={prevTrim}
              className="p-2 rounded-md text-slate-500 hover:bg-slate-100"
              title="Trimestre anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center min-w-[180px]">
              <div className="text-xs text-slate-500">Trimestre</div>
              <div className="font-semibold text-slate-800">
                {trimActual?.nombre} de {anio}
              </div>
            </div>
            <button
              onClick={nextTrim}
              className="p-2 rounded-md text-slate-500 hover:bg-slate-100"
              title="Trimestre siguiente"
            >
              <ChevronRight size={18} />
            </button>
          </>
        ) : (
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
        <button
          onClick={() => {
            if (modoCustom) {
              setModoCustom(false);
            } else {
              setModoCustom(true);
              if (!desde) setDesde(`${anio}-01-01`);
              if (!hasta) setHasta(`${anio}-12-31`);
            }
          }}
          className="ml-2 text-xs px-3 py-1.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
        >
          {modoCustom ? 'Volver a trimestres' : 'Rango personalizado'}
        </button>
      </div>

      {resumen?.custom_periodo && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            Estás viendo un rango personalizado. Los <strong>modelos 130 y 303 se presentan POR TRIMESTRE</strong> ante la AEAT — los importes que aparecen abajo son orientativos sobre este periodo, no son los importes que vas a presentar.
          </span>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && !resumen ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center text-slate-500">
          Calculando…
        </div>
      ) : (
        <>
          {/* Bloque 1: Ingresos */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Ingresos (facturas emitidas)
              </h2>
              {resumen?.num_facturas > 0 && (
                <button
                  onClick={() => abrirDetalle('facturas')}
                  className="text-xs text-brand hover:text-brand-dark inline-flex items-center gap-1"
                  title="Ver lista de facturas del periodo"
                >
                  <List size={14} />
                  Ver listado
                </button>
              )}
            </div>
            <div className="text-sm text-slate-500 mb-3">
              {resumen?.num_facturas
                ? `${resumen.num_facturas} factura${resumen.num_facturas !== 1 ? 's' : ''} en este trimestre`
                : 'No hay facturas emitidas en este trimestre'}
            </div>
            <StatRow
              label="Base imponible"
              value={formatEUR(resumen?.base_imponible || 0)}
              hint="Suma de las bases de las facturas (sin IVA)"
              accent="base"
            />
            <StatRow
              label="IVA repercutido"
              value={formatEUR(resumen?.iva_repercutido || 0)}
              hint="IVA que has cobrado a tus clientes"
              accent="iva"
            />
            <StatRow
              label="IRPF retenido por clientes"
              value={formatEUR(resumen?.irpf_retenido || 0)}
              hint="Retenciones que tus clientes ya han ingresado en tu nombre"
              accent="irpf"
            />
          </div>

          {/* Bloque 2: Gastos */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
            <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Gastos deducibles
              </h2>
              <div className="flex items-center gap-3">
                {resumen?.num_gastos > 0 && (
                  <button
                    onClick={() => abrirDetalle('gastos')}
                    className="text-xs text-brand hover:text-brand-dark inline-flex items-center gap-1"
                    title="Ver lista de gastos del periodo"
                  >
                    <List size={14} />
                    Ver listado
                  </button>
                )}
                <Link
                  to="/gastos"
                  className="text-xs text-brand hover:text-brand-dark inline-flex items-center gap-1"
                >
                  <Wallet size={14} />
                  Gestionar gastos
                </Link>
              </div>
            </div>
            <div className="text-sm text-slate-500 mb-3">
              {resumen?.num_gastos
                ? `${resumen.num_gastos} gasto${resumen.num_gastos !== 1 ? 's' : ''} deducible${resumen.num_gastos !== 1 ? 's' : ''} en este trimestre`
                : 'No hay gastos registrados en este trimestre'}
            </div>
            <StatRow
              label="Base de gastos"
              value={formatEUR(resumen?.gastos_base || 0)}
              hint="Suma de bases imponibles de gastos deducibles"
              accent="base"
            />
            <StatRow
              label="IVA soportado"
              value={formatEUR(resumen?.gastos_iva || 0)}
              hint="IVA pagado en gastos (deducible del IVA repercutido)"
              accent="iva"
            />
          </div>

          {/* Bloque 3: Modelos a presentar */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
              Modelos trimestrales (estimación)
            </h2>
            <StatRow
              label="Modelo 130 estimado (IRPF)"
              value={formatEUR(resumen?.modelo_130_estimado || 0)}
              hint="20% × (ingresos − gastos) − IRPF retenido"
              accent="modelo"
            />
            <StatRow
              label="Modelo 303 estimado (IVA)"
              value={formatEUR(resumen?.modelo_303_estimado || 0)}
              hint="IVA repercutido − IVA soportado deducible (negativo = a compensar)"
              accent="modelo"
            />
          </div>

          <div className="mt-4 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 leading-relaxed">
              <strong>Aviso:</strong> estimación informativa basada en los
              datos registrados en la app. Asegúrate de tener todos los
              gastos del trimestre dados de alta y consulta con tu asesoría
              antes de presentar los modelos.
            </div>
          </div>
        </>
      )}

      {detalleTipo ? (
        <DetalleFiscalModal
          tipo={detalleTipo}
          items={detalleItems}
          loading={detalleLoading}
          periodo={
            modoCustom
              ? `${desde || '—'} → ${hasta || '—'}`
              : `${trimActual?.nombre || ''} de ${anio}`
          }
          onClose={() => setDetalleTipo(null)}
          onRowClick={(row) => {
            if (detalleTipo === 'facturas') nav(`/facturas/${row.id}`);
            else nav(`/gastos`, { state: { abrirGastoId: row.id } });
            setDetalleTipo(null);
          }}
        />
      ) : null}
    </div>
  );
}

function DetalleFiscalModal({ tipo, items, loading, periodo, onClose, onRowClick }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const titulo = tipo === 'gastos' ? 'Gastos deducibles' : 'Facturas emitidas';
  const sumBase = items.reduce((s, x) => s + (Number(x.base_imponible) || 0), 0);
  const sumIva = items.reduce((s, x) => s + (Number(x.iva_importe) || 0), 0);
  const sumTotal = items.reduce((s, x) => s + (Number(x.total) || 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-800">
              {titulo}
            </h3>
            <div className="text-xs text-slate-500 mt-0.5">
              {periodo} — {items.length} {items.length === 1 ? 'documento' : 'documentos'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            title="Cerrar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center text-sm text-slate-500 py-12">
              Cargando…
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-12">
              No hay {tipo === 'gastos' ? 'gastos' : 'facturas'} en este periodo.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-left text-xs sticky top-0">
                <tr>
                  <th className="px-4 py-2 font-medium">{tipo === 'gastos' ? 'Fecha' : 'Nº'}</th>
                  <th className="px-4 py-2 font-medium">{tipo === 'gastos' ? 'Proveedor' : 'Fecha'}</th>
                  <th className="px-4 py-2 font-medium">{tipo === 'gastos' ? 'Concepto' : 'Cliente'}</th>
                  <th className="px-4 py-2 font-medium text-right">Base</th>
                  <th className="px-4 py-2 font-medium text-right">IVA</th>
                  <th className="px-4 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((x) => (
                  <tr
                    key={x.id}
                    onClick={() => onRowClick && onRowClick(x)}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-2 text-slate-800 font-medium">
                      {tipo === 'gastos' ? formatFechaES(x.fecha) : x.numero}
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {tipo === 'gastos' ? (x.proveedor || '—') : formatFechaES(x.fecha)}
                    </td>
                    <td className="px-4 py-2 text-slate-700 truncate max-w-[260px]">
                      {tipo === 'gastos' ? (x.concepto || x.categoria || '—') : (x.cliente_nombre || '—')}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-800">
                      {formatEUR(x.base_imponible || 0)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                      {formatEUR(x.iva_importe || 0)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-800">
                      {formatEUR(x.total || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold">
                <tr>
                  <td className="px-4 py-2 text-slate-600" colSpan={3}>
                    Total
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatEUR(sumBase)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatEUR(sumIva)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatEUR(sumTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Fiscal;
