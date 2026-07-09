// Pagina de detalle de cliente: ficha + agregados + listas de facturas,
// presupuestos, cobros y recurrencias. Vista global de "todo lo de este
// cliente" en un solo sitio. Reusa estilos de las paginas de listado.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, MapPin, FileText, Receipt, Wallet,
  Repeat, TrendingUp, Hash, Pencil,
} from 'lucide-react';
import { formatEUR, formatFechaES } from '../utils/format.js';
import { useToast } from '../components/Toast.jsx';
import ClienteFormModal from '../components/ClienteFormModal.jsx';

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

function StatTile({ icon: Icon, label, value, hint, accent = 'slate' }) {
  const colors = {
    slate:   'bg-slate-100 text-slate-700',
    brand:   'bg-brand/10 text-brand',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber:   'bg-amber-100 text-amber-700',
    blue:    'bg-blue-100 text-blue-700',
  };
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${colors[accent]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-xl font-semibold text-slate-800 mt-0.5 truncate">
          {value}
        </div>
        {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, count, children, action }) {
  return (
    <section className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-2">
          {Icon && <Icon size={16} className="text-slate-500" />}
          {title}
          {typeof count === 'number' && (
            <span className="text-xs font-normal text-slate-400 normal-case">
              ({count})
            </span>
          )}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function ClienteDetalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const cargar = useCallback(async () => {
    if (!window.api) return;
    setLoading(true);
    setError(null);
    try {
      const res = await window.api.clientes.detalle(Number(id));
      if (res?.error) {
        setError(res.error);
      } else if (!res) {
        setError('Cliente no encontrado.');
      } else {
        setData(res);
      }
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 mb-2">Cliente</h1>
        <p className="text-slate-500">Cargando…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <button
          onClick={() => nav('/clientes')}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft size={18} /> Volver
        </button>
        <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {error || 'Cliente no encontrado.'}
        </div>
      </div>
    );
  }

  const { cliente, facturas, presupuestos, cobros, recurrencias, agregados } = data;
  const direccionCompleta = [cliente.direccion, [cliente.cp, cliente.ciudad].filter(Boolean).join(' '), cliente.provincia]
    .filter(Boolean)
    .join(' · ');

  return (
    <div>
      <button
        onClick={() => nav('/clientes')}
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
      >
        <ArrowLeft size={18} /> Clientes
      </button>

      {/* Ficha */}
      <div className="bg-white shadow-sm rounded-lg p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold text-slate-800 truncate">
              {cliente.nombre}
            </h1>
            {cliente.nombre_comercial && cliente.nombre_comercial !== cliente.nombre && (
              <div className="text-sm text-slate-500 italic mt-0.5">
                {cliente.nombre_comercial}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              {cliente.tipo && (
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-slate-100 text-slate-700">
                  {cliente.tipo === 'autonomo'
                    ? 'Autónomo'
                    : cliente.tipo === 'particular'
                      ? 'Particular'
                      : 'Empresa'}
                </span>
              )}
              {cliente.nif && (
                <div className="text-sm text-slate-500 inline-flex items-center gap-1">
                  <Hash size={13} /> {cliente.nif}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm"
          >
            <Pencil size={14} /> Editar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
          {cliente.email && (
            <a
              href={`mailto:${cliente.email}`}
              className="inline-flex items-center gap-2 text-slate-700 hover:text-brand"
            >
              <Mail size={14} className="text-slate-400" />
              {cliente.email}
            </a>
          )}
          {cliente.telefono && (
            <a
              href={`tel:${cliente.telefono}`}
              className="inline-flex items-center gap-2 text-slate-700 hover:text-brand"
            >
              <Phone size={14} className="text-slate-400" />
              {cliente.telefono}
            </a>
          )}
          {direccionCompleta && (
            <div className="inline-flex items-center gap-2 text-slate-700">
              <MapPin size={14} className="text-slate-400 shrink-0" />
              <span className="truncate" title={direccionCompleta}>{direccionCompleta}</span>
            </div>
          )}
        </div>
        {cliente.notas && (
          <p className="mt-3 text-sm text-slate-600 italic">"{cliente.notas}"</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatTile
          icon={TrendingUp}
          label="Facturado historico"
          value={formatEUR(agregados.total_facturado)}
          hint={`${formatEUR(agregados.facturado_anio)} en ${agregados.anio}`}
          accent="brand"
        />
        <StatTile
          icon={Receipt}
          label="Cobrado"
          value={formatEUR(agregados.total_cobrado)}
          hint={`${agregados.n_cobros} cobros registrados`}
          accent="emerald"
        />
        <StatTile
          icon={Wallet}
          label="Pendiente"
          value={formatEUR(agregados.pendiente)}
          hint="facturado - cobrado"
          accent={agregados.pendiente > 0 ? 'amber' : 'slate'}
        />
        <StatTile
          icon={FileText}
          label="Documentos"
          value={`${agregados.n_facturas + agregados.n_presupuestos}`}
          hint={`${agregados.n_facturas} fact · ${agregados.n_presupuestos} pres`}
          accent="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Facturas */}
        <Section title="Facturas" icon={Receipt} count={facturas.length}>
          {facturas.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">Sin facturas para este cliente.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Numero</th>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium text-right">Total</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr
                    key={f.id}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => nav(`/facturas/${f.id}`)}
                  >
                    <td className="px-4 py-2 font-medium text-slate-800">{f.numero}</td>
                    <td className="px-4 py-2 text-slate-700">{formatFechaES(f.fecha)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-800">
                      {formatEUR(f.total)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          'inline-block px-2 py-0.5 rounded-full text-xs font-medium ' +
                          (ESTADO_BADGE_FACTURA[f.estado] || ESTADO_BADGE_FACTURA.borrador)
                        }
                      >
                        {f.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Presupuestos */}
        <Section title="Presupuestos" icon={FileText} count={presupuestos.length}>
          {presupuestos.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">Sin presupuestos.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Numero</th>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium text-right">Total</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {presupuestos.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => nav(`/presupuestos/${p.id}`)}
                  >
                    <td className="px-4 py-2 font-medium text-slate-800">{p.numero}</td>
                    <td className="px-4 py-2 text-slate-700">{formatFechaES(p.fecha)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-800">
                      {formatEUR(p.total)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          'inline-block px-2 py-0.5 rounded-full text-xs font-medium ' +
                          (ESTADO_BADGE_PRESUPUESTO[p.estado] || ESTADO_BADGE_PRESUPUESTO.borrador)
                        }
                      >
                        {p.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Cobros */}
        <Section title="Cobros recibidos" icon={Wallet} count={cobros.length}>
          {cobros.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">Sin cobros registrados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">Factura</th>
                  <th className="px-4 py-2 font-medium">Metodo</th>
                  <th className="px-4 py-2 font-medium text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {cobros.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => nav(`/facturas/${c.factura_id}`)}
                  >
                    <td className="px-4 py-2 text-slate-700">{formatFechaES(c.fecha)}</td>
                    <td className="px-4 py-2 text-slate-700">{c.factura_numero}</td>
                    <td className="px-4 py-2 text-slate-600">{c.metodo || '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-emerald-700">
                      {formatEUR(c.importe)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Recurrencias */}
        <Section title="Recurrencias" icon={Repeat} count={recurrencias.length}>
          {recurrencias.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              Sin recurrencias activas para este cliente.{' '}
              <Link to="/recurrencias" className="text-brand hover:underline">
                Crear una
              </Link>
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Modelo</th>
                  <th className="px-4 py-2 font-medium">Frecuencia</th>
                  <th className="px-4 py-2 font-medium">Proxima</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recurrencias.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-700">
                      {r.tipo} {r.source_numero || ''}
                    </td>
                    <td className="px-4 py-2 text-slate-700 capitalize">{r.periodicidad}</td>
                    <td className="px-4 py-2 text-slate-700">{formatFechaES(r.proxima_fecha)}</td>
                    <td className="px-4 py-2">
                      {r.activa ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Activa
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          Pausada
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      {showEditModal && (
        <ClienteFormModal
          cliente={cliente}
          onSaved={() => {
            setShowEditModal(false);
            cargar();
            toast.success('Cliente actualizado');
          }}
          onCancel={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}

export default ClienteDetalle;
