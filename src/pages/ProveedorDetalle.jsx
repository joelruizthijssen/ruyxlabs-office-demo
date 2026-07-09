// Ficha de proveedor: agregados + listado de gastos de la empresa activa.
// Mirror de ClienteDetalle.jsx. Pedido por la madre — quiere ver de un
// vistazo cuanto ha gastado con cada proveedor y su histórico.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, MapPin, Wallet, Receipt, TrendingUp, Hash, Pencil, Truck,
} from 'lucide-react';
import { formatEUR, formatFechaES } from '../utils/format.js';
import { useToast } from '../components/Toast.jsx';
import ProveedorFormModal from '../components/ProveedorFormModal.jsx';

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

function ProveedorDetalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const cargar = useCallback(async () => {
    if (!window.api?.proveedores?.detalle) return;
    setLoading(true);
    setError(null);
    try {
      const res = await window.api.proveedores.detalle(Number(id));
      if (res?.error) {
        setError(res.error);
      } else if (!res) {
        setError('Proveedor no encontrado.');
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

  // Recargar si cambia empresa activa (los gastos van por empresa).
  useEffect(() => {
    const onEmpresaChange = () => cargar();
    window.addEventListener('empresa-changed', onEmpresaChange);
    return () => window.removeEventListener('empresa-changed', onEmpresaChange);
  }, [cargar]);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 mb-2">Proveedor</h1>
        <p className="text-slate-500">Cargando…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <button
          onClick={() => nav('/proveedores')}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft size={18} /> Volver
        </button>
        <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {error || 'Proveedor no encontrado.'}
        </div>
      </div>
    );
  }

  const { proveedor, gastos, agregados } = data;
  const direccionCompleta = [
    proveedor.direccion,
    [proveedor.cp, proveedor.ciudad].filter(Boolean).join(' '),
    proveedor.provincia,
  ].filter(Boolean).join(' · ');

  return (
    <div>
      <button
        onClick={() => nav('/proveedores')}
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
      >
        <ArrowLeft size={18} /> Proveedores
      </button>

      {/* Ficha */}
      <div className="bg-white shadow-sm rounded-lg p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold text-slate-800 truncate flex items-center gap-3">
              <Truck size={26} className="text-slate-400" />
              {proveedor.nombre}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              {proveedor.nif && (
                <div className="text-sm text-slate-500 inline-flex items-center gap-1">
                  <Hash size={13} /> {proveedor.nif}
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
          {proveedor.email && (
            <a
              href={`mailto:${proveedor.email}`}
              className="inline-flex items-center gap-2 text-slate-700 hover:text-brand"
            >
              <Mail size={14} className="text-slate-400" />
              {proveedor.email}
            </a>
          )}
          {proveedor.telefono && (
            <a
              href={`tel:${proveedor.telefono}`}
              className="inline-flex items-center gap-2 text-slate-700 hover:text-brand"
            >
              <Phone size={14} className="text-slate-400" />
              {proveedor.telefono}
            </a>
          )}
          {direccionCompleta && (
            <div className="inline-flex items-center gap-2 text-slate-700">
              <MapPin size={14} className="text-slate-400 shrink-0" />
              <span className="truncate" title={direccionCompleta}>{direccionCompleta}</span>
            </div>
          )}
        </div>
        {proveedor.iban && (
          <p className="mt-3 text-sm text-slate-600">
            IBAN: <span className="font-mono">{proveedor.iban}</span>
          </p>
        )}
        {proveedor.notas && (
          <p className="mt-3 text-sm text-slate-600 italic">"{proveedor.notas}"</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatTile
          icon={TrendingUp}
          label="Gastado histórico"
          value={formatEUR(agregados.total_gastado)}
          hint={`${formatEUR(agregados.gastado_anio)} en ${agregados.anio}`}
          accent="brand"
        />
        <StatTile
          icon={Receipt}
          label="Pagado"
          value={formatEUR(agregados.total_pagado)}
          hint="suma de pagos registrados"
          accent="emerald"
        />
        <StatTile
          icon={Wallet}
          label="Pendiente"
          value={formatEUR(agregados.pendiente)}
          hint="gastado - pagado"
          accent={agregados.pendiente > 0 ? 'amber' : 'slate'}
        />
        <StatTile
          icon={Receipt}
          label="Gastos"
          value={`${agregados.n_gastos}`}
          hint={`en esta empresa`}
          accent="blue"
        />
      </div>

      {/* Lista de gastos */}
      <section className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <Receipt size={16} className="text-slate-500" />
            Gastos
            <span className="text-xs font-normal text-slate-400 normal-case">
              ({gastos.length})
            </span>
          </h3>
        </div>
        {gastos.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            Sin gastos para este proveedor en la empresa activa.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Nº factura</th>
                <th className="px-4 py-2 font-medium">Concepto</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
                <th className="px-4 py-2 font-medium text-right">Pagado</th>
                <th className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => {
                const pagado = Number(g.pagado_total) || 0;
                const total = Number(g.total) || 0;
                const liquidado = Math.abs(total - pagado) < 0.005;
                const sinPago = pagado === 0;
                return (
                  <tr
                    key={g.id}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => nav('/gastos', { state: { abrirGastoId: g.id } })}
                  >
                    <td className="px-4 py-2 text-slate-700">{formatFechaES(g.fecha)}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {g.numero_factura_proveedor || '—'}
                      {g.subtipo === 'abono' && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                          Abono
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-700 truncate max-w-[280px]" title={g.concepto || ''}>
                      {g.concepto || '—'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-800">
                      {formatEUR(total)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-700">
                      {formatEUR(pagado)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          'inline-block px-2 py-0.5 rounded-full text-xs font-medium ' +
                          (liquidado
                            ? 'bg-emerald-100 text-emerald-700'
                            : sinPago
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700')
                        }
                      >
                        {liquidado ? 'Pagado' : sinPago ? 'Pendiente' : 'Parcial'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {showEditModal && (
        <ProveedorFormModal
          proveedor={proveedor}
          onSaved={() => {
            setShowEditModal(false);
            cargar();
            toast.success('Proveedor actualizado');
          }}
          onCancel={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}

export default ProveedorDetalle;
