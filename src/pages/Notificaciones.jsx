// Página /notificaciones — feed unificado de avisos derivados de los datos:
// recurrencias pendientes, facturas sin cobrar, presupuestos sin respuesta,
// borradores estancados y próximos cierres trimestrales.
//
// Las notificaciones se calculan al vuelo en el backend (no hay una tabla
// con la lista entera). Aquí solo persistimos lo que el usuario ha hecho con
// cada una: marcar leída, descartar, posponer.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, BellOff, Clock, CheckCheck, Eye, X, ChevronRight,
  FileText, Receipt, Repeat, Calendar, Settings, Play, Check,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import { formatEUR, formatFechaES } from '../utils/format.js';

const KIND_LABEL = {
  recurrencia_pendiente:     'Recurrencias pendientes',
  factura_sin_cobrar:        'Facturas sin cobrar',
  presupuesto_sin_respuesta: 'Presupuestos sin respuesta',
  borrador_estancado:        'Borradores estancados',
  cierre_trimestral:         'Cierre trimestral',
};

// Icono y color de fondo por categoría. El color refuerza la prioridad
// visualmente sin necesidad de leer el título.
const KIND_META = {
  recurrencia_pendiente:     { Icon: Repeat,   color: 'bg-amber-100 text-amber-700' },
  factura_sin_cobrar:        { Icon: Receipt,  color: 'bg-red-100 text-red-700' },
  presupuesto_sin_respuesta: { Icon: FileText, color: 'bg-blue-100 text-blue-700' },
  borrador_estancado:        { Icon: FileText, color: 'bg-slate-100 text-slate-600' },
  cierre_trimestral:         { Icon: Calendar, color: 'bg-purple-100 text-purple-700' },
};

// Acción primaria contextual: resuelve el aviso sin abrir el documento.
// Solo las categorías con una acción de resolución obvia la tienen; las
// demás (borrador estancado, cierre trimestral) se gestionan con "Ir".
const ACCION_PRIMARIA = {
  recurrencia_pendiente:     { label: 'Generar ahora', Icon: Play },
  factura_sin_cobrar:        { label: 'Marcar cobrada', Icon: Check },
  presupuesto_sin_respuesta: { label: 'Marcar aceptado', Icon: Check },
};

// Mapeo del entity_type a la ruta de detalle. Para `cierre` vamos al resumen
// fiscal; para `recurrencia` a la lista de recurrencias (no hay /:id).
function pathDe(notif) {
  switch (notif.entity_type) {
    case 'factura':     return `/facturas/${notif.entity_id}`;
    case 'presupuesto': return `/presupuestos/${notif.entity_id}`;
    case 'recurrencia': return '/recurrencias';
    case 'cierre':      return '/fiscal';
    default:            return null;
  }
}

function Notificaciones() {
  const nav = useNavigate();
  const toast = useToast();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas'); // 'todas' | 'sin_leer'

  const recargar = useCallback(async () => {
    if (!window.api?.notif) return;
    setLoading(true);
    try {
      const res = await window.api.notif.listar();
      setLista(Array.isArray(res) ? res : []);
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { recargar(); }, [recargar]);

  function dispararRefresh() {
    window.dispatchEvent(new CustomEvent('notif-changed'));
  }

  async function onIr(notif) {
    const p = pathDe(notif);
    // Auto-marcar como leída al hacer click (igual que cualquier feed).
    if (notif.state === 'unread') {
      try {
        await window.api.notif.marcarLeida(notif.kind, notif.entity_type, notif.entity_id);
        dispararRefresh();
      } catch { /* noop */ }
    }
    if (p) nav(p);
  }

  async function onMarcarLeida(notif) {
    try {
      await window.api.notif.marcarLeida(notif.kind, notif.entity_type, notif.entity_id);
      await recargar();
      dispararRefresh();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function onDescartar(notif) {
    try {
      await window.api.notif.descartar(notif.kind, notif.entity_type, notif.entity_id);
      await recargar();
      dispararRefresh();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function onSnooze(notif, dias) {
    try {
      await window.api.notif.snooze(notif.kind, notif.entity_type, notif.entity_id, dias);
      toast.success(`Pospuesto ${dias} día${dias === 1 ? '' : 's'}`);
      await recargar();
      dispararRefresh();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function onMarcarTodasLeidas() {
    try {
      await window.api.notif.marcarTodasLeidas();
      await recargar();
      dispararRefresh();
      toast.success('Todas marcadas como leídas');
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  // Acción primaria contextual según el tipo de notificación. Resuelve el
  // problema de raíz (genera la recurrencia, marca la factura cobrada, etc.)
  // sin tener que abrir el documento. Tras ejecutarla, la notificación
  // desaparece sola en el siguiente recargar() porque la entidad ya no
  // cumple el criterio que la generaba.
  const [accionEnCurso, setAccionEnCurso] = useState(null);

  async function onAccionPrimaria(notif) {
    const claveEnCurso = `${notif.kind}-${notif.entity_type}-${notif.entity_id}`;
    setAccionEnCurso(claveEnCurso);
    try {
      if (notif.kind === 'recurrencia_pendiente') {
        const res = await window.api.recurrencias.generar(notif.entity_id);
        if (res?.error) { toast.error(res.error); return; }
        toast.success(
          `Generado ${res.tipo === 'factura' ? 'factura' : 'presupuesto'} ${res.numero}`,
        );
        const ruta = res.tipo === 'factura'
          ? `/facturas/${res.id}` : `/presupuestos/${res.id}`;
        window.dispatchEvent(new CustomEvent('data-changed'));
        await recargar();
        dispararRefresh();
        nav(ruta);
        return;
      }
      if (notif.kind === 'factura_sin_cobrar') {
        const res = await window.api.facturas.update(notif.entity_id, { estado: 'cobrada' });
        if (res?.error) { toast.error(res.error); return; }
        toast.success('Factura marcada como cobrada');
      } else if (notif.kind === 'presupuesto_sin_respuesta') {
        const res = await window.api.presupuestos.update(notif.entity_id, { estado: 'aceptado' });
        if (res?.error) { toast.error(res.error); return; }
        toast.success('Presupuesto marcado como aceptado');
      }
      window.dispatchEvent(new CustomEvent('data-changed'));
      await recargar();
      dispararRefresh();
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setAccionEnCurso(null);
    }
  }

  const filtrada = useMemo(() => {
    if (filtro === 'sin_leer') return lista.filter((n) => n.state === 'unread');
    return lista;
  }, [lista, filtro]);

  // Agrupar por kind manteniendo el orden global (priority).
  const grupos = useMemo(() => {
    const m = new Map();
    for (const n of filtrada) {
      if (!m.has(n.kind)) m.set(n.kind, []);
      m.get(n.kind).push(n);
    }
    return Array.from(m.entries()); // [[kind, items[]], ...]
  }, [filtrada]);

  const totalSinLeer = lista.filter((n) => n.state === 'unread').length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
            <Bell size={22} /> Notificaciones
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Avisos derivados de tus datos: lo que toca cobrar, generar o revisar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => nav('/ajustes?tab=notificaciones')}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
          title="Configurar umbrales de aviso"
        >
          <Settings size={16} /> Configurar
        </button>
      </div>

      {/* Filtros + acción global */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="inline-flex bg-slate-100 rounded-lg p-1 text-sm">
          <button
            type="button"
            onClick={() => setFiltro('todas')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filtro === 'todas' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600'
            }`}
          >
            Todas ({lista.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltro('sin_leer')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filtro === 'sin_leer' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600'
            }`}
          >
            Sin leer ({totalSinLeer})
          </button>
        </div>
        {totalSinLeer > 0 && (
          <button
            type="button"
            onClick={onMarcarTodasLeidas}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
          >
            <CheckCheck size={16} /> Marcar todas como leídas
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando…</p>
      ) : grupos.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-10 text-center">
          <BellOff size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-700 font-medium mb-1">
            {filtro === 'sin_leer' ? 'No tienes notificaciones sin leer' : 'Sin notificaciones'}
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Esta página te avisará cuando tengas facturas sin cobrar, presupuestos sin respuesta,
            recurrencias pendientes o se acerque un cierre trimestral.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(([kind, items]) => {
            const meta = KIND_META[kind] || KIND_META.borrador_estancado;
            const Icon = meta.Icon;
            return (
              <section key={kind}>
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-700">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${meta.color}`}>
                    <Icon size={14} />
                  </span>
                  <span>{KIND_LABEL[kind] || kind}</span>
                  <span className="text-xs text-slate-400">({items.length})</span>
                </div>
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  {items.map((n, i) => (
                    <NotifRow
                      key={`${n.kind}-${n.entity_type}-${n.entity_id}`}
                      notif={n}
                      borderTop={i > 0}
                      accionEnCurso={accionEnCurso === `${n.kind}-${n.entity_type}-${n.entity_id}`}
                      onIr={() => onIr(n)}
                      onAccionPrimaria={() => onAccionPrimaria(n)}
                      onMarcarLeida={() => onMarcarLeida(n)}
                      onDescartar={() => onDescartar(n)}
                      onSnooze={(d) => onSnooze(n, d)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotifRow({
  notif, borderTop, accionEnCurso,
  onIr, onAccionPrimaria, onMarcarLeida, onDescartar, onSnooze,
}) {
  const sinLeer = notif.state === 'unread';
  const accion = ACCION_PRIMARIA[notif.kind];
  return (
    <div
      className={
        'flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors ' +
        (borderTop ? 'border-t border-slate-100 ' : '') +
        (sinLeer ? 'bg-blue-50/30' : '')
      }
    >
      {/* Punto azul de "no leído" */}
      <div className="pt-2 w-2 flex-shrink-0">
        {sinLeer && <span className="inline-block w-2 h-2 rounded-full bg-brand" />}
      </div>

      {/* Contenido principal — click va al detalle */}
      <button
        type="button"
        onClick={onIr}
        className="flex-1 text-left min-w-0"
      >
        <div className="flex items-center gap-2">
          <span className={'text-sm ' + (sinLeer ? 'font-semibold text-slate-800' : 'text-slate-700')}>
            {notif.message}
          </span>
        </div>
        {notif.total !== undefined && notif.total !== null && (
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {formatEUR(notif.total)}
          </div>
        )}
      </button>

      {/* Acciones */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {accion && (
          <button
            type="button"
            onClick={onAccionPrimaria}
            disabled={accionEnCurso}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 mr-1 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            title={accion.label}
          >
            <accion.Icon size={13} />
            {accionEnCurso ? '…' : accion.label}
          </button>
        )}
        {sinLeer && (
          <button
            type="button"
            onClick={onMarcarLeida}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500"
            title="Marcar como leída"
          >
            <Eye size={15} />
          </button>
        )}
        <SnoozeButton onSnooze={onSnooze} />
        <button
          type="button"
          onClick={onDescartar}
          className="p-1.5 rounded hover:bg-slate-200 text-slate-500"
          title="Descartar (no me la enseñes más)"
        >
          <X size={15} />
        </button>
        <button
          type="button"
          onClick={onIr}
          className="p-1.5 rounded hover:bg-slate-200 text-slate-500"
          title="Ir al detalle"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// Botón Snooze con menú emergente: 1 día / 3 días / 1 semana / 30 días.
function SnoozeButton({ onSnooze }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-500"
        title="Posponer"
      >
        <Clock size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10 text-sm">
          {[
            { dias: 1,  label: '1 día' },
            { dias: 3,  label: '3 días' },
            { dias: 7,  label: '1 semana' },
            { dias: 30, label: '1 mes' },
          ].map((o) => (
            <button
              key={o.dias}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSnooze(o.dias); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default Notificaciones;
