import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Receipt, ChevronDown, FileBadge, Wallet2, RotateCcw, FileCheck } from 'lucide-react';
import { formatEUR } from '../utils/format.js';
import { useToast } from '../components/Toast.jsx';
import NuevoConSerie from '../components/NuevoConSerie.jsx';
import ConvertirProformaModal from '../components/ConvertirProformaModal.jsx';

const ESTADO_BADGE = {
  borrador: 'bg-slate-200 text-slate-700',
  emitida:  'bg-blue-100 text-blue-700',
  cobrada:  'bg-emerald-100 text-emerald-700',
};

const SUBTIPO_BADGE = {
  proforma:     { label: 'Proforma',      cls: 'bg-amber-100 text-amber-800' },
  nota_contado: { label: 'Nota contado',  cls: 'bg-violet-100 text-violet-800' },
  rectificativa:{ label: 'Rectificativa', cls: 'bg-rose-100 text-rose-800' },
};

// Filtro de cobro: 'todas' incluye todo; 'pendientes' = facturas/rectificativas
// emitidas no cobradas; 'cobradas' = facturas/rectificativas con estado cobrada;
// 'vencidas' = pendientes con fecha_vencimiento < hoy. proforma/nota_contado
// quedan fuera de pendientes/cobradas/vencidas.
function filtrarPorEstado(f, modo) {
  if (modo === 'todas') return true;
  const esFiscal = !f.subtipo || f.subtipo === 'factura' || f.subtipo === 'rectificativa';
  if (!esFiscal) return false;
  if (modo === 'pendientes') return f.estado === 'emitida';
  if (modo === 'cobradas') return f.estado === 'cobrada';
  if (modo === 'vencidas') {
    if (f.estado !== 'emitida') return false;
    if (!f.fecha_vencimiento) return false;
    const hoy = new Date().toISOString().slice(0, 10);
    return f.fecha_vencimiento < hoy;
  }
  return true;
}

function Facturas() {
  const nav = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [series, setSeries] = useState([{ id: 'A', label: 'General' }]);
  // Filtro v1.2.23: pedido por la madre — ver solo facturas pendientes de
  // cobro de un vistazo. 'todas' (default) | 'pendientes' | 'cobradas'.
  // Pendiente = emitida (no cobrada). Solo aplica a facturas y rectificativas
  // (proforma/nota_contado no estan pendientes de cobro: una es presupuesto
  // y la otra es venta al contado liquidada en el acto).
  const [filtroCobro, setFiltroCobro] = useState('todas');
  // v1.2.39: filtro por subtipo. 'todos' | 'factura' | 'proforma' |
  // 'nota_contado' | 'rectificativa'. Madre lo pidio para poder ver solo
  // proformas (o solo notas de contado) cuando llega gente a verlas.
  const [filtroSubtipo, setFiltroSubtipo] = useState('todos');
  // v1.2.39: ocultar proformas YA convertidas a factura. Default ON
  // (= no se ven en el listado) para limpiarlo visualmente. Checkbox
  // 'Mostrar proformas convertidas' las vuelve a mostrar.
  const [ocultarConvertidas, setOcultarConvertidas] = useState(true);
  // Estado del modal de conversion proforma -> factura. null = cerrado;
  // si tiene valor, contiene la fila de proforma sobre la que se acciono.
  const [proformaConvertir, setProformaConvertir] = useState(null);
  // Cache de proformas ya convertidas para mostrar chip "Convertida a X" en
  // la lista. Mapa { proforma_id: { facturaId, facturaNumero } }. Se llena
  // al cargar la lista (1 query agregada para no pegar N veces).
  const [proformasConvertidas, setProformasConvertidas] = useState({});

  async function recargar() {
    if (!window.api) {
      setError('Esta aplicación debe ejecutarse desde Electron.');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const [res, sets] = await Promise.all([
        window.api.facturas.list(),
        window.api.settings.get(),
      ]);
      if (res && res.error) setError(res.error);
      else setItems(res || []);
      if (sets && !sets.error && Array.isArray(sets.series_facturas_list)) {
        setSeries(sets.series_facturas_list);
      }
      // v1.2.35: indexar conversiones proforma -> factura para chip "Convertida".
      // Recorremos las facturas que vienen ya cargadas; si alguna tiene
      // proforma_origen_id, marcamos esa proforma como convertida con la
      // referencia a la factura nueva. Sin ir a backend de mas.
      const convertidas = {};
      for (const f of (res || [])) {
        if (f.proforma_origen_id) {
          convertidas[f.proforma_origen_id] = {
            facturaId: f.id,
            facturaNumero: f.numero,
          };
        }
      }
      setProformasConvertidas(convertidas);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  async function crear(serie, subtipo) {
    setError(null);
    try {
      const res = await window.api.facturas.create(serie || 'A', subtipo || 'factura');
      if (res && res.error) {
        setError(res.error);
        return;
      }
      nav(`/facturas/${res.id}`);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }

  // Dropdown para abrir alternativas a "Nueva factura" (proforma y nota
  // de contado). Tanto proforma como nota_contado se crean siempre con
  // serie 'A' — las series adicionales solo aplican a facturas normales.
  function SubtipoMenu() {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      function onClickOutside(e) {
        if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      }
      if (open) document.addEventListener('mousedown', onClickOutside);
      return () => document.removeEventListener('mousedown', onClickOutside);
    }, [open]);
    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm"
          title="Otros tipos: proforma o nota de contado"
        >
          Más <ChevronDown size={14} />
        </button>
        {open && (
          <div className="absolute right-0 mt-1 z-20 min-w-[220px] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
            <button
              type="button"
              onClick={() => { setOpen(false); crear('A', 'proforma'); }}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 text-sm text-slate-700 flex items-center gap-2"
            >
              <FileBadge size={14} className="text-amber-600" />
              <div>
                <div className="font-medium">Factura proforma</div>
                <div className="text-[11px] text-slate-500">Pre-factura, no cuenta como fiscal</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); crear('A', 'nota_contado'); }}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 text-sm text-slate-700 flex items-center gap-2"
            >
              <Wallet2 size={14} className="text-violet-600" />
              <div>
                <div className="font-medium">Nota de contado</div>
                <div className="text-[11px] text-slate-500">Ticket simplificado</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); crear('A', 'rectificativa'); }}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 text-sm text-slate-700 flex items-center gap-2 border-t border-slate-100"
            >
              <RotateCcw size={14} className="text-rose-600" />
              <div>
                <div className="font-medium">Factura rectificativa</div>
                <div className="text-[11px] text-slate-500">Credit note / abono (admite importes negativos)</div>
              </div>
            </button>
          </div>
        )}
      </div>
    );
  }

  async function convertirProforma(opts) {
    if (!proformaConvertir) return;
    const res = await window.api.facturas.convertirProforma(proformaConvertir.id, opts);
    if (res && res.error) {
      throw new Error(res.error);
    }
    toast.success(`Factura ${res.facturaNumero} creada desde proforma ${proformaConvertir.numero}`);
    setProformaConvertir(null);
    window.dispatchEvent(new CustomEvent('data-changed'));
    await recargar();
    nav(`/facturas/${res.facturaId}`);
  }

  async function eliminar(id, numero) {
    if (!confirm(`¿Eliminar factura ${numero}?`)) return;
    setError(null);
    try {
      const res = await window.api.facturas.delete(id);
      if (res && res.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        recargar();
        toast.success(`Factura ${numero} eliminada`);
        // Sidebar / Home refrescan stats (incluye contador de vencidas).
        window.dispatchEvent(new CustomEvent('data-changed'));
      }
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(e.message ?? String(e));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-slate-800">Facturas</h1>
        <div className="flex items-center gap-2">
          <NuevoConSerie
            series={series}
            onCreate={(s) => crear(s, 'factura')}
            label="Nueva factura"
          />
          <SubtipoMenu />
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {/* Filtro por subtipo (factura / proforma / contado / rectificativa). */}
      {!loading && items.length > 0 && (
        <div className="mb-2 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500 mr-1">Tipo:</span>
          {[
            { v: 'todos',         label: 'Todos' },
            { v: 'factura',       label: 'Facturas' },
            { v: 'proforma',      label: 'Proformas' },
            { v: 'nota_contado',  label: 'Contado' },
            { v: 'rectificativa', label: 'Rectificativas' },
          ].map((opt) => {
            const norm = (f) => (!f.subtipo || f.subtipo === 'factura') ? 'factura' : f.subtipo;
            const count = opt.v === 'todos'
              ? items.length
              : items.filter((f) => norm(f) === opt.v).length;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => setFiltroSubtipo(opt.v)}
                className={
                  'px-3 py-1.5 rounded-lg text-sm border ' +
                  (filtroSubtipo === opt.v
                    ? 'bg-brand text-white border-brand'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')
                }
              >
                {opt.label}
                <span className={
                  'ml-1.5 text-xs ' +
                  (filtroSubtipo === opt.v ? 'opacity-80' : 'text-slate-400')
                }>({count})</span>
              </button>
            );
          })}
          <label className="ml-3 inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={!ocultarConvertidas}
              onChange={(e) => setOcultarConvertidas(!e.target.checked)}
              className="accent-brand"
            />
            Mostrar proformas convertidas
          </label>
        </div>
      )}

      {/* Filtro por estado de cobro. Aparece solo si hay items. */}
      {!loading && items.length > 0 && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500 mr-1">Mostrar:</span>
          {[
            { v: 'todas',      label: 'Todas' },
            { v: 'pendientes', label: 'Pendientes de cobro' },
            { v: 'vencidas',   label: 'Vencidas' },
            { v: 'cobradas',   label: 'Cobradas' },
          ].map((opt) => {
            // Calculo del contador dentro del map para no repetir bucles.
            const count = opt.v === 'todas'
              ? items.length
              : items.filter((f) => filtrarPorEstado(f, opt.v)).length;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => setFiltroCobro(opt.v)}
                className={
                  'px-3 py-1.5 rounded-lg text-sm border ' +
                  (filtroCobro === opt.v
                    ? 'bg-brand text-white border-brand'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')
                }
              >
                {opt.label}
                <span className={
                  'ml-1.5 text-xs ' +
                  (filtroCobro === opt.v ? 'opacity-80' : 'text-slate-400')
                }>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        {loading && <div className="px-6 py-4 text-slate-500">Cargando…</div>}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
              <Receipt size={36} />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              Todavía no has emitido ninguna factura
            </h3>
            <p className="text-slate-500 max-w-sm mb-6">
              Crea una factura desde cero, o convierte un presupuesto
              aceptado en factura con un clic desde la lista de
              presupuestos.
            </p>
            <button
              onClick={() => crear('A')}
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-lg transition-colors font-medium"
            >
              <Plus size={18} />
              Crear mi primera factura
            </button>
          </div>
        )}

        {!loading && items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-6 py-3 font-medium">Número</th>
                <th className="px-6 py-3 font-medium">Fecha</th>
                <th className="px-6 py-3 font-medium">Cliente</th>
                <th className="px-6 py-3 font-medium text-right">Total</th>
                <th className="px-6 py-3 font-medium">Estado</th>
                <th className="px-6 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items
                .filter((f) => filtrarPorEstado(f, filtroCobro))
                .filter((f) => {
                  // v1.2.39: filtro por subtipo.
                  if (filtroSubtipo === 'todos') return true;
                  const sub = (!f.subtipo || f.subtipo === 'factura') ? 'factura' : f.subtipo;
                  return sub === filtroSubtipo;
                })
                .filter((f) => {
                  // v1.2.39: ocultar proformas convertidas si el toggle esta ON.
                  if (!ocultarConvertidas) return true;
                  if (f.subtipo !== 'proforma') return true;
                  return !proformasConvertidas[f.id];
                })
                .map((f) => (
                <tr key={f.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{f.numero}</span>
                      {f.subtipo && f.subtipo !== 'factura' && SUBTIPO_BADGE[f.subtipo] && (
                        <span className={
                          'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ' +
                          SUBTIPO_BADGE[f.subtipo].cls
                        }>
                          {SUBTIPO_BADGE[f.subtipo].label}
                        </span>
                      )}
                      {f.subtipo === 'proforma' && proformasConvertidas[f.id] ? (
                        <button
                          onClick={() => nav(`/facturas/${proformasConvertidas[f.id].facturaId}`)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                          title="Ver la factura generada desde esta proforma"
                        >
                          ✓ Convertida a {proformasConvertidas[f.id].facturaNumero}
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    <div>{f.fecha}</div>
                    {f.fecha_vencimiento && (
                      <div className="text-[11px] text-slate-400">
                        Vto: {f.fecha_vencimiento}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-700">
                    {f.cliente_nombre || (
                      <span className="text-red-600">⚠ Sin cliente</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-800">
                    {formatEUR(f.total)}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={
                          'inline-block px-2.5 py-1 rounded-full text-xs font-medium ' +
                          (ESTADO_BADGE[f.estado] || ESTADO_BADGE.borrador)
                        }
                      >
                        {f.estado}
                      </span>
                      {filtrarPorEstado(f, 'vencidas') && (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 border border-red-200"
                          title={`Vencida el ${f.fecha_vencimiento}`}
                        >
                          ⏰ Vencida
                        </span>
                      )}
                      {f.enviado_at && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-700 border border-sky-200"
                          title={`Enviada por correo: ${f.enviado_at}`}
                        >
                          ✓ Enviada
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {f.subtipo === 'proforma' && !proformasConvertidas[f.id] ? (
                        <button
                          onClick={() => setProformaConvertir(f)}
                          title="Convertir esta proforma en factura"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors text-sm"
                        >
                          <FileCheck size={15} />
                          Convertir
                        </button>
                      ) : null}
                      <button
                        onClick={() => nav(`/facturas/${f.id}`)}
                        className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        Abrir
                      </button>
                      <button
                        onClick={() => eliminar(f.id, f.numero)}
                        title="Eliminar"
                        className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {proformaConvertir ? (
        <ConvertirProformaModal
          proforma={proformaConvertir}
          series={series}
          defaultSerie={proformaConvertir.serie || 'A'}
          onConfirm={convertirProforma}
          onCancel={() => setProformaConvertir(null)}
        />
      ) : null}
    </div>
  );
}

export default Facturas;
