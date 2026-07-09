// Tres graficos SVG inline para el dashboard del Home:
//   1) Bar chart: ingresos mensuales (12 meses).
//   2) Bar horizontal: top 5 clientes.
//   3) Donut: estados de factura del anyo en curso.
//
// Sin libreria de graficos — solo SVG nativo. El bundle queda igual de
// pequeno y el control visual es total. Si en el futuro la complejidad
// crece (tooltips ricos, ejes con zoom, etc.) se puede migrar a recharts
// o visx; para 3 graficos esquematicos es overkill.

import { formatEUR } from '../utils/format.js';

const COLORS_ESTADO = {
  borrador: '#cbd5e1', // slate-300
  emitida:  '#3b82f6', // blue-500
  cobrada:  '#10b981', // emerald-500
};

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function shortEUR(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000)    return `${(v / 1000).toFixed(1)}k`;
  return `${Math.round(v)}`;
}

// --- Bar chart: ingresos mensuales ---
function IngresosMensuales({ data, brandColor = '#1abc9c' }) {
  const W = 600;
  const H = 220;
  const PAD = { top: 16, right: 8, bottom: 28, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const max = Math.max(1, ...data.map((d) => d.total));
  const barW = innerW / data.length;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (max * i) / yTicks);

  // Ano del primer mes mostrado; si los 12 meses cubren 2 anyos, mostramos
  // el cambio de anyo como label de mes.
  const totalAnio = data.reduce((s, d) => s + d.total, 0);

  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Ingresos mensuales
        </h3>
        <div className="text-xs text-slate-500">
          Total 12 meses: <strong className="text-slate-700">{formatEUR(totalAnio)}</strong>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Ejes Y */}
        {ticks.map((t, i) => {
          const y = PAD.top + innerH - (innerH * i) / yTicks;
          return (
            <g key={i}>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
                stroke="#e2e8f0" strokeWidth="1"
              />
              <text
                x={PAD.left - 6} y={y + 3} textAnchor="end"
                fontSize="10" fill="#64748b"
              >
                {shortEUR(t)}
              </text>
            </g>
          );
        })}
        {/* Barras */}
        {data.map((d, i) => {
          const h = max > 0 ? (innerH * d.total) / max : 0;
          const x = PAD.left + i * barW + 3;
          const y = PAD.top + innerH - h;
          const monthLabel = MESES_CORTO[parseInt(d.ym.slice(5, 7), 10) - 1];
          return (
            <g key={d.ym}>
              <rect
                x={x} y={y} width={Math.max(2, barW - 6)} height={Math.max(0, h)}
                fill={brandColor} rx="2" ry="2"
              >
                <title>{`${monthLabel} ${d.ym.slice(0, 4)}: ${formatEUR(d.total)} (${d.count} facturas)`}</title>
              </rect>
              <text
                x={x + (barW - 6) / 2} y={H - 10}
                textAnchor="middle" fontSize="10" fill="#64748b"
              >
                {monthLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- Bar horizontal: top clientes ---
function TopClientes({ data }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Top clientes
        </h3>
        <p className="text-sm text-slate-500">
          Aun no hay facturas emitidas para mostrar un ranking.
        </p>
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.total));
  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
        Top clientes
      </h3>
      <ul className="space-y-2">
        {data.map((c) => {
          const pct = max > 0 ? (c.total / max) * 100 : 0;
          return (
            <li key={c.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-700 truncate" title={c.nombre}>
                  {c.nombre}
                </span>
                <span className="text-slate-700 tabular-nums font-medium ml-2">
                  {formatEUR(c.total)}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {c.facturas} factura{c.facturas !== 1 ? 's' : ''}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --- Donut: estados de factura ---
function EstadosFacturas({ data }) {
  const total =
    (data.count?.borrador || 0) +
    (data.count?.emitida || 0) +
    (data.count?.cobrada || 0);

  if (total === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Facturas {data.anio}
        </h3>
        <p className="text-sm text-slate-500">
          No hay facturas emitidas en {data.anio} todavia.
        </p>
      </div>
    );
  }

  const radius = 60;
  const stroke = 22;
  const center = 80;
  const circumference = 2 * Math.PI * radius;

  const slices = [
    { key: 'cobrada',  value: data.count.cobrada,  color: COLORS_ESTADO.cobrada },
    { key: 'emitida',  value: data.count.emitida,  color: COLORS_ESTADO.emitida },
    { key: 'borrador', value: data.count.borrador, color: COLORS_ESTADO.borrador },
  ].filter((s) => s.value > 0);

  let offset = 0;

  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
        Facturas {data.anio}
      </h3>
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 160 160" className="w-32 h-32 shrink-0">
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke="#f1f5f9" strokeWidth={stroke}
          />
          {slices.map((s, idx) => {
            const len = (s.value / total) * circumference;
            const dasharray = `${len} ${circumference - len}`;
            const dashoffset = -offset;
            offset += len;
            return (
              <circle
                key={s.key}
                cx={center} cy={center} r={radius}
                fill="none" stroke={s.color} strokeWidth={stroke}
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
                transform={`rotate(-90 ${center} ${center})`}
              >
                <title>{`${s.key}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}</title>
              </circle>
            );
          })}
          <text
            x={center} y={center - 4}
            textAnchor="middle" fontSize="22" fontWeight="600" fill="#1e293b"
          >
            {total}
          </text>
          <text
            x={center} y={center + 14}
            textAnchor="middle" fontSize="10" fill="#64748b"
          >
            facturas
          </text>
        </svg>

        <ul className="text-sm space-y-1.5 flex-1">
          {['cobrada', 'emitida', 'borrador'].map((k) => {
            const v = data.count[k] || 0;
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return (
              <li key={k} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm inline-block"
                  style={{ background: COLORS_ESTADO[k] }}
                />
                <span className="capitalize text-slate-700 flex-1">{k}</span>
                <span className="text-slate-500 tabular-nums">
                  {v} · {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Cobrado: <strong className="text-slate-600">{formatEUR(data.suma.cobrada || 0)}</strong>
        {' · '}Pendiente: <strong className="text-slate-600">{formatEUR(data.suma.emitida || 0)}</strong>
      </p>
    </div>
  );
}

function DashboardCharts({ data, brandColor }) {
  if (!data) return null;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
      <div className="xl:col-span-2">
        <IngresosMensuales data={data.ingresos_mensuales || []} brandColor={brandColor} />
      </div>
      <EstadosFacturas data={data.estados_facturas || { count: {}, suma: {}, anio: new Date().getFullYear() }} />
      <div className="xl:col-span-3">
        <TopClientes data={data.top_clientes || []} />
      </div>
    </div>
  );
}

export default DashboardCharts;
