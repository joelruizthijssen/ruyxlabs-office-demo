import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Receipt,
  Users as UsersIcon,
  TrendingUp,
  Clock,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Repeat,
  FileDown,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import { formatEUR } from '../utils/format.js';
import { APP_NAME, APP_VERSION, COMPANY_NAME } from '../utils/appInfo.js';
import DashboardCharts from '../components/DashboardCharts.jsx';
import ExportInformeModal from '../components/ExportInformeModal.jsx';

const ESTADO_BADGE_PRESUPUESTO = {
  borrador:   'bg-slate-200 text-slate-700',
  enviado:    'bg-blue-100 text-blue-700',
  aceptado:   'bg-emerald-100 text-emerald-700',
  rechazado:  'bg-red-100 text-red-700',
  convertido: 'bg-purple-100 text-purple-700',
};

const ESTADO_BADGE_FACTURA = {
  borrador: 'bg-slate-200 text-slate-700',
  emitida:  'bg-blue-100 text-blue-700',
  cobrada:  'bg-emerald-100 text-emerald-700',
};

function StatCard({ icon: Icon, label, value, hint, accent = 'brand' }) {
  const accents = {
    brand:   'bg-brand/10 text-brand',
    blue:    'bg-blue-100 text-blue-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber:   'bg-amber-100 text-amber-700',
  };
  return (
    <div className="bg-white rounded-lg shadow-sm p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${accents[accent]}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-semibold text-slate-800 mt-0.5 truncate">
          {value}
        </div>
        {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
      </div>
    </div>
  );
}

function Home() {
  const nav = useNavigate();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [recientes, setRecientes] = useState([]);
  const [settings, setSettings] = useState(null);
  const [pendientesRec, setPendientesRec] = useState([]);
  const [generandoTodas, setGenerandoTodas] = useState(false);
  const [showInformeModal, setShowInformeModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function cargar() {
    if (!window.api) {
      setError('Esta aplicación debe ejecutarse desde Electron.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [s, d, r, sets, pend] = await Promise.all([
        window.api.home.stats(),
        window.api.home.dashboard(),
        window.api.home.recientes(5),
        window.api.settings.get(),
        window.api.recurrencias.pendientes(),
      ]);
      if (s?.error) setError(s.error);
      else setStats(s);
      if (d && !d.error) setDashboard(d);
      if (Array.isArray(r)) setRecientes(r);
      if (sets && !sets.error) setSettings(sets);
      if (Array.isArray(pend)) setPendientesRec(pend);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function generarTodasPendientes() {
    if (pendientesRec.length === 0) return;
    const ok = confirm(
      `Se generaran ${pendientesRec.length} borrador${pendientesRec.length !== 1 ? 'es' : ''} `
        + 'en base a las recurrencias pendientes. ¿Continuar?',
    );
    if (!ok) return;
    setGenerandoTodas(true);
    let ok_count = 0;
    let err_count = 0;
    for (const r of pendientesRec) {
      try {
        const res = await window.api.recurrencias.generar(r.id);
        if (res?.error) err_count++;
        else ok_count++;
      } catch {
        err_count++;
      }
    }
    setGenerandoTodas(false);
    toast.success(
      `${ok_count} borrador${ok_count !== 1 ? 'es' : ''} generados`
        + (err_count > 0 ? ` (${err_count} con errores)` : ''),
    );
    await cargar();
  }

  useEffect(() => {
    cargar();
  }, []);

  async function nuevoPresupuesto() {
    setError(null);
    try {
      const res = await window.api.presupuestos.create();
      if (res?.error) {
        setError(res.error);
        return;
      }
      nav(`/presupuestos/${res.id}`);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }

  async function nuevaFactura() {
    setError(null);
    try {
      const res = await window.api.facturas.create();
      if (res?.error) {
        setError(res.error);
        return;
      }
      nav(`/facturas/${res.id}`);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-slate-800 mb-2">Inicio</h1>
        <p className="text-slate-500">Cargando…</p>
      </div>
    );
  }

  const nombre = settings?.emisor_nombre?.split(' ')?.[0]?.toLowerCase() || '';
  const saludo = nombre
    ? `Hola, ${nombre.charAt(0).toUpperCase() + nombre.slice(1)}`
    : 'Hola';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800">{saludo}</h1>
          <p className="text-slate-500 mt-1">Resumen de tu actividad</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInformeModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors text-sm"
            title="Exportar dashboard como PDF (trimestre, anyo, custom)"
          >
            <FileDown size={15} />
            Informe
          </button>
          <button
            onClick={nuevoPresupuesto}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FileText size={16} />
            Nuevo presupuesto
          </button>
          <button
            onClick={nuevaFactura}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white transition-colors"
          >
            <Receipt size={16} />
            Nueva factura
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {/* Recurrencias pendientes (solo si hay) */}
      {pendientesRec.length > 0 && (
        <div className="w-full mb-4 px-5 py-4 rounded-lg border border-sky-300 bg-sky-50 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-sky-200 text-sky-800 shrink-0">
            <Repeat size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sky-900">
              Tienes {pendientesRec.length} recurrencia{pendientesRec.length !== 1 ? 's' : ''}{' '}
              pendiente{pendientesRec.length !== 1 ? 's' : ''} de generar
            </div>
            <div className="text-sm text-sky-800 mt-0.5">
              Genera los borradores de este ciclo (los revisas antes de emitir).
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => nav('/recurrencias')}
              className="px-3 py-1.5 rounded-md border border-sky-300 bg-white text-sky-800 hover:bg-sky-100 text-sm"
            >
              Ver detalle
            </button>
            <button
              onClick={generarTodasPendientes}
              disabled={generandoTodas}
              className="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-sm disabled:opacity-50"
            >
              {generandoTodas ? 'Generando…' : 'Generar todas'}
            </button>
          </div>
        </div>
      )}

      {/* Aviso destacado de facturas vencidas (solo si hay) */}
      {stats?.facturas_vencidas?.count > 0 && (
        <button
          onClick={() => nav('/facturas')}
          className="w-full mb-4 px-5 py-4 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center gap-4 text-left"
        >
          <div className="p-2.5 rounded-lg bg-amber-200 text-amber-800 shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-amber-900">
              Tienes {stats.facturas_vencidas.count} factura
              {stats.facturas_vencidas.count !== 1 ? 's' : ''} sin cobrar hace
              más de {stats.facturas_vencidas.dias} días
            </div>
            <div className="text-sm text-amber-800 mt-0.5">
              Importe pendiente: {formatEUR(stats.facturas_vencidas.suma || 0)}.
              Es buen momento para mandar un recordatorio al cliente.
            </div>
          </div>
          <ArrowRight size={20} className="text-amber-700 shrink-0" />
        </button>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={TrendingUp}
          label="Facturado este año"
          value={formatEUR(stats?.facturado_anio || 0)}
          hint={`${stats?.facturas_anio?.count ?? 0} facturas emitidas`}
          accent="brand"
        />
        <StatCard
          icon={AlertCircle}
          label="Pendiente de cobro"
          value={formatEUR(stats?.facturas_pendientes?.suma || 0)}
          hint={`${stats?.facturas_pendientes?.count ?? 0} facturas emitidas sin cobrar`}
          accent="amber"
        />
        <StatCard
          icon={FileText}
          label="Presupuestos del mes"
          value={`${stats?.presupuestos_mes?.count ?? 0}`}
          hint={formatEUR(stats?.presupuestos_mes?.suma || 0)}
          accent="blue"
        />
        <StatCard
          icon={UsersIcon}
          label="Clientes"
          value={`${stats?.total_clientes ?? 0}`}
          hint="en tu agenda"
          accent="emerald"
        />
      </div>

      {/* Dashboard: graficos */}
      <DashboardCharts data={dashboard} brandColor={settings?.brand_color} />

      {/* Actividad reciente */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Clock size={18} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-800">
            Actividad reciente
          </h2>
        </div>

        {recientes.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500">
            Aún no hay actividad. Empieza creando un presupuesto o una factura.
          </div>
        ) : (
          <div>
            {recientes.map((d) => {
              const path =
                d.tipo === 'factura'
                  ? `/facturas/${d.id}`
                  : `/presupuestos/${d.id}`;
              const badgeMap =
                d.tipo === 'factura' ? ESTADO_BADGE_FACTURA : ESTADO_BADGE_PRESUPUESTO;
              const badgeCls = badgeMap[d.estado] || 'bg-slate-200 text-slate-700';
              const TipoIcon = d.tipo === 'factura' ? Receipt : FileText;
              return (
                <button
                  key={`${d.tipo}-${d.id}`}
                  onClick={() => nav(path)}
                  className="w-full px-6 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 flex items-center gap-4 text-left transition-colors"
                >
                  <TipoIcon
                    size={18}
                    className={
                      d.tipo === 'factura' ? 'text-blue-500' : 'text-slate-400'
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800">
                      {d.tipo === 'factura' ? 'Factura' : 'Presupuesto'}{' '}
                      {d.numero}
                      <span className="text-slate-400 font-normal">
                        {' '}— {d.cliente_nombre || d.asunto || 'Sin cliente'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {d.fecha}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-slate-800">
                      {formatEUR(d.total)}
                    </div>
                    <span
                      className={
                        'inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ' +
                        badgeCls
                      }
                    >
                      {d.estado}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-12 text-center">
        {APP_NAME} v{APP_VERSION} · by {COMPANY_NAME}
      </p>

      {showInformeModal && (
        <ExportInformeModal
          settings={settings}
          onClose={() => setShowInformeModal(false)}
        />
      )}
    </div>
  );
}

export default Home;
