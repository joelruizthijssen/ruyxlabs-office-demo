// Ficha de producto: agregados + tabla de movimientos del codigo en la
// empresa activa. Filtros: anio y tipo (entrada/salida/todo). Pedido por la
// madre: cuando hace clic en un producto, ver sus movimientos cronologicos.
//
// Movs:
//   - Salida = linea de factura emitida con codigo del producto (contraparte = cliente).
//   - Entrada = linea de gasto con codigo del producto (contraparte = proveedor).
//                Incluye gastos legacy single-line con `producto_codigo` en cabecera.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Package, TrendingUp, TrendingDown, Hash, Pencil, ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react';
import { formatEUR, formatFechaES } from '../utils/format.js';
import { useToast } from '../components/Toast.jsx';

function StatTile({ icon: Icon, label, value, hint, accent = 'slate' }) {
  const colors = {
    slate:   'bg-slate-100 text-slate-700',
    brand:   'bg-brand/10 text-brand',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber:   'bg-amber-100 text-amber-700',
    blue:    'bg-blue-100 text-blue-700',
    red:     'bg-red-100 text-red-700',
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

function ProductoDetalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [anio, setAnio] = useState('');     // '' = todos
  const [tipo, setTipo] = useState('todo'); // 'todo' | 'entrada' | 'salida'

  const cargar = useCallback(async () => {
    if (!window.api?.productos?.detalle) return;
    setLoading(true);
    setError(null);
    try {
      const opts = { tipo };
      if (anio) opts.anio = Number(anio);
      const res = await window.api.productos.detalle(Number(id), opts);
      if (res?.error) {
        setError(res.error);
      } else if (!res) {
        setError('Producto no encontrado.');
      } else {
        setData(res);
      }
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [id, anio, tipo, toast]);

  useEffect(() => { cargar(); }, [cargar]);

  // Recargar si cambia empresa activa.
  useEffect(() => {
    const onEmpresaChange = () => cargar();
    window.addEventListener('empresa-changed', onEmpresaChange);
    return () => window.removeEventListener('empresa-changed', onEmpresaChange);
  }, [cargar]);

  const aniosDisponibles = useMemo(() => data?.anios || [], [data]);

  if (loading && !data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-slate-800 mb-2">Producto</h1>
        <p className="text-slate-500">Cargando…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <button
          onClick={() => nav('/productos')}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft size={18} /> Productos
        </button>
        <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {error || 'Producto no encontrado.'}
        </div>
      </div>
    );
  }

  const { producto, movimientos, agregados } = data;
  const precioVenta = producto.precio_venta ?? producto.precio_unitario ?? 0;
  const precioCompra = producto.precio_compra ?? 0;

  return (
    <div className="p-6">
      <button
        onClick={() => nav('/productos')}
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
      >
        <ArrowLeft size={18} /> Productos
      </button>

      {/* Ficha */}
      <div className="bg-white shadow-sm rounded-lg p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold text-slate-800 truncate flex items-center gap-3">
              <Package size={26} className="text-slate-400" />
              {producto.nombre}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {producto.codigo && (
                <div className="text-sm text-slate-500 inline-flex items-center gap-1">
                  <Hash size={13} /> {producto.codigo}
                </div>
              )}
              {producto.unidad && (
                <div className="text-sm text-slate-500">Unidad: {producto.unidad}</div>
              )}
              {producto.iva_pct != null && (
                <div className="text-sm text-slate-500">IVA: {producto.iva_pct}%</div>
              )}
              {producto.proveedor && (
                <div className="text-sm text-slate-500">Proveedor habitual: {producto.proveedor}</div>
              )}
            </div>
            {producto.descripcion && (
              <p className="mt-3 text-sm text-slate-600">{producto.descripcion}</p>
            )}
          </div>
          <button
            onClick={() => nav('/productos', { state: { abrirProductoId: producto.id } })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm"
            title="Volver al listado para editar"
          >
            <Pencil size={14} /> Editar
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
          <div className="bg-slate-50 rounded p-3">
            <div className="text-xs text-slate-500">Precio venta</div>
            <div className="text-lg font-semibold text-slate-800 mt-0.5">{formatEUR(precioVenta)}</div>
          </div>
          <div className="bg-slate-50 rounded p-3">
            <div className="text-xs text-slate-500">Precio compra</div>
            <div className="text-lg font-semibold text-slate-800 mt-0.5">{formatEUR(precioCompra)}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <StatTile
          icon={TrendingUp}
          label="Vendido"
          value={formatEUR(agregados.total_vendido)}
          hint="Salidas en el filtro"
          accent="emerald"
        />
        <StatTile
          icon={TrendingDown}
          label="Comprado"
          value={formatEUR(agregados.total_comprado)}
          hint="Entradas en el filtro"
          accent="red"
        />
        <StatTile
          icon={Package}
          label="Movimientos"
          value={`${agregados.n_movs}`}
          hint="Total en el filtro"
          accent="blue"
        />
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-3 flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-2">
          <label className="text-xs text-slate-500">Año</label>
          <select
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">Todos</option>
            {aniosDisponibles.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="inline-flex items-center gap-1 ml-2">
          {[
            { v: 'todo', label: 'Todo' },
            { v: 'entrada', label: 'Solo entradas' },
            { v: 'salida', label: 'Solo salidas' },
          ].map((opt) => (
            <button
              key={opt.v}
              onClick={() => setTipo(opt.v)}
              className={
                'px-3 py-1.5 rounded-lg text-sm border ' +
                (tipo === opt.v
                  ? 'bg-brand text-white border-brand'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de movimientos */}
      <section className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <Package size={16} className="text-slate-500" />
            Movimientos
            <span className="text-xs font-normal text-slate-400 normal-case">
              ({movimientos.length})
            </span>
          </h3>
        </div>
        {movimientos.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            Sin movimientos {producto.codigo ? 'con este código' : '(este producto no tiene código asignado)'} en el filtro actual.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium">Documento</th>
                <th className="px-4 py-2 font-medium">Contraparte</th>
                <th className="px-4 py-2 font-medium text-right">Cantidad</th>
                <th className="px-4 py-2 font-medium text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m, idx) => {
                const esSalida = m.tipo === 'salida';
                const ruta = m.ref_tipo === 'factura'
                  ? '/facturas'
                  : '/gastos';
                const navState = m.ref_tipo === 'factura'
                  ? { abrirFacturaId: m.ref_id }
                  : { abrirGastoId: m.ref_id };
                return (
                  <tr
                    key={`${m.ref_tipo}-${m.ref_id}-${idx}`}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => nav(ruta, { state: navState })}
                  >
                    <td className="px-4 py-2 text-slate-700">{formatFechaES(m.fecha)}</td>
                    <td className="px-4 py-2">
                      {esSalida ? (
                        <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          <ArrowUpFromLine size={11} /> Salida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                          <ArrowDownToLine size={11} /> Entrada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {m.doc_numero || '—'}
                      {m.subtipo === 'abono' && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                          Abono
                        </span>
                      )}
                      {m.subtipo === 'rectificativa' && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                          Rect.
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-700 truncate max-w-[260px]" title={m.contraparte || ''}>
                      {m.contraparte || '—'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                      {m.cantidad != null ? m.cantidad : '—'}
                    </td>
                    <td className={
                      'px-4 py-2 text-right tabular-nums font-semibold ' +
                      (esSalida ? 'text-emerald-700' : 'text-red-700')
                    }>
                      {formatEUR(m.importe || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default ProductoDetalle;
