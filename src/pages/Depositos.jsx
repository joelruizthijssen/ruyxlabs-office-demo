// v1.5.0: modulo stock en deposito.
//
// Un "deposito" es una tienda (cliente) donde tenemos material fisico
// nuestro. Al facturar, el stock se descuenta automaticamente. Aqui:
//   - listar depositos + ver saldo total.
//   - ficha por deposito: stock actual por producto + movimientos + entrada
//     rapida + PDF hoja de stock.

import { useEffect, useMemo, useState } from 'react';
import { Warehouse, Plus, Trash2, Download, ArrowLeft } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { formatFechaES, formatEUR } from '../utils/format.js';
import { HojaStockPDF } from '../pdf/HojaStockPDF.jsx';
import { useToast } from '../components/Toast.jsx';
import { APP_NAME, APP_VERSION } from '../utils/appInfo.js';

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

function DepositoForm({ initial, clientes, onSaved, onCancel }) {
  const [nombre, setNombre] = useState(initial?.nombre || '');
  const [clienteId, setClienteId] = useState(initial?.cliente_id || '');
  const [notas, setNotas] = useState(initial?.notas || '');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function guardar() {
    if (!clienteId) { toast.error('Elige un cliente'); return; }
    if (!nombre.trim()) { toast.error('Pon un nombre'); return; }
    setSaving(true);
    try {
      const payload = { cliente_id: Number(clienteId), nombre: nombre.trim(), notas: notas.trim() || null };
      const res = initial?.id
        ? await window.api.depositos.update(initial.id, payload)
        : await window.api.depositos.create(payload);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(initial?.id ? 'Depósito actualizado' : 'Depósito creado');
      onSaved(res);
    } catch (e) { toast.error(e.message ?? String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">
        {initial?.id ? 'Editar depósito' : 'Nuevo depósito'}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Cliente (tienda) *</label>
          <select
            className={inputCls + ' bg-white'}
            value={clienteId || ''}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">— Elige un cliente —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Nombre *</label>
          <input
            className={inputCls}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="p.ej. Tienda Holanda"
          />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Notas (opcional)</label>
          <textarea
            rows={2}
            className={inputCls}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} disabled={saving}
          className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100">
          Cancelar
        </button>
        <button onClick={guardar} disabled={saving}
          className="px-4 py-2 text-sm rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

function EntradaRapidaForm({ depositoId, productos, onSaved, onCancel }) {
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [precio, setPrecio] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function guardar() {
    const c = Number(cantidad);
    if (!Number.isFinite(c) || c <= 0) { toast.error('Cantidad debe ser > 0'); return; }
    setSaving(true);
    try {
      const p = productos.find((x) => x.id === Number(productoId));
      const res = await window.api.depositos.movimientosCreate({
        deposito_id: depositoId,
        tipo: 'entrada',
        fecha,
        producto_id: productoId ? Number(productoId) : null,
        codigo: p?.codigo || null,
        concepto: p?.nombre || null,
        cantidad_signed: c,
        precio_unitario: Number(precio) || 0,
        notas: notas.trim() || null,
      });
      if (res?.error) { toast.error(res.error); return; }
      toast.success('Entrada registrada');
      onSaved();
    } catch (e) { toast.error(e.message ?? String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
      <h4 className="text-sm font-semibold text-slate-800 mb-3">Añadir entrada al depósito</h4>
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Producto *</label>
          <select className={inputCls + ' bg-white'} value={productoId}
            onChange={(e) => {
              setProductoId(e.target.value);
              const p = productos.find((x) => x.id === Number(e.target.value));
              if (p) setPrecio(String(p.precio_compra || p.precio_venta || 0));
            }}
          >
            <option value="">— Elige producto —</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo ? `[${p.codigo}] ` : ''}{p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Cantidad *</label>
          <input type="number" step="0.01" className={inputCls} value={cantidad}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setCantidad(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Precio unit. (€)</label>
          <input type="number" step="0.01" className={inputCls} value={precio}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setPrecio(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Fecha</label>
          <input type="date" className={inputCls} value={fecha}
            onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="col-span-3">
          <label className={labelCls}>Notas (opcional)</label>
          <input className={inputCls} value={notas}
            onChange={(e) => setNotas(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancel} disabled={saving}
          className="px-3 py-1.5 text-sm rounded-lg text-slate-600 hover:bg-slate-100">Cancelar</button>
        <button onClick={guardar} disabled={saving}
          className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
          {saving ? 'Guardando…' : 'Añadir entrada'}
        </button>
      </div>
    </div>
  );
}

function DepositoDetalle({ deposito, onBack }) {
  const [stock, setStock] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [showEntrada, setShowEntrada] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const toast = useToast();

  async function recargar() {
    const [s, m, p] = await Promise.all([
      window.api.depositos.stockActual(deposito.id),
      window.api.depositos.movimientosList(deposito.id),
      window.api.productos.list(),
    ]);
    setStock(Array.isArray(s) ? s : []);
    setMovimientos(Array.isArray(m) ? m : []);
    setProductos(Array.isArray(p) ? p : []);
  }

  useEffect(() => { recargar(); /* eslint-disable-next-line */ }, [deposito.id]);

  async function eliminarMovimiento(id) {
    if (!confirm('¿Eliminar este movimiento? El stock se recalculara.')) return;
    await window.api.depositos.movimientosDelete(id);
    toast.success('Movimiento eliminado');
    recargar();
  }

  async function descargarHojaStock() {
    if (descargando) return;
    setDescargando(true);
    try {
      const blob = await pdf(
        <HojaStockPDF
          deposito={deposito}
          stock={stock}
          appName={APP_NAME}
          appVersion={APP_VERSION}
        />,
      ).toBlob();
      const sug = `Hoja de stock ${deposito.nombre} ${new Date().toISOString().slice(0, 10)}.pdf`;
      // Demo web: descarga vía blob URL + <a download> (sin filesystem).
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sug;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('PDF descargado');
    } catch (e) { toast.error('Error: ' + (e.message || e)); }
    finally { setDescargando(false); }
  }

  const totalStock = useMemo(
    () => stock.reduce((sum, s) => sum + (Number(s.cantidad_actual) || 0) * (Number(s.precio_unitario_medio) || 0), 0),
    [stock],
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" title="Volver">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{deposito.nombre}</h1>
            <p className="text-sm text-slate-500">{deposito.cliente_nombre}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={descargarHojaStock} disabled={descargando}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50">
            <Download size={16} />
            {descargando ? 'Generando…' : 'Descargar hoja de stock'}
          </button>
          <button onClick={() => setShowEntrada((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm hover:bg-brand-dark">
            <Plus size={16} />
            Añadir entrada
          </button>
        </div>
      </div>

      {showEntrada && (
        <EntradaRapidaForm
          depositoId={deposito.id}
          productos={productos}
          onSaved={() => { setShowEntrada(false); recargar(); }}
          onCancel={() => setShowEntrada(false)}
        />
      )}

      {/* Stock actual */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
            Stock actual
          </h2>
          <div className="text-xs text-slate-500">
            Valor estimado: <strong>{formatEUR(totalStock)}</strong>
          </div>
        </div>
        {stock.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            No hay stock. Añade una entrada para empezar.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                <th className="text-left py-2 pr-4">Código</th>
                <th className="text-left py-2 pr-4">Producto</th>
                <th className="text-right py-2 pr-4">Cantidad</th>
                <th className="text-right py-2 pr-4">Precio medio</th>
                <th className="text-right py-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-mono text-xs text-slate-600">{s.codigo || '—'}</td>
                  <td className="py-2 pr-4">{s.concepto || '—'}</td>
                  <td className="py-2 pr-4 text-right font-medium">{Number(s.cantidad_actual).toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right text-slate-500">{formatEUR(s.precio_unitario_medio)}</td>
                  <td className="py-2 text-right font-medium">
                    {formatEUR((Number(s.cantidad_actual) || 0) * (Number(s.precio_unitario_medio) || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Movimientos */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">
          Movimientos ({movimientos.length})
        </h2>
        {movimientos.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            Sin movimientos todavía.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                <th className="text-left py-2 pr-4">Fecha</th>
                <th className="text-left py-2 pr-4">Tipo</th>
                <th className="text-left py-2 pr-4">Producto</th>
                <th className="text-right py-2 pr-4">Cantidad</th>
                <th className="text-left py-2 pr-4">Ref.</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-600">{formatFechaES(m.fecha)}</td>
                  <td className="py-2 pr-4">
                    {m.tipo === 'entrada' && <span className="text-emerald-700 text-xs font-medium">Entrada</span>}
                    {m.tipo === 'salida_factura' && <span className="text-red-700 text-xs font-medium">Salida (factura)</span>}
                    {m.tipo === 'ajuste' && <span className="text-slate-500 text-xs font-medium">Ajuste</span>}
                  </td>
                  <td className="py-2 pr-4">
                    {m.producto_codigo && <span className="font-mono text-xs text-slate-500 mr-2">[{m.producto_codigo}]</span>}
                    {m.producto_nombre || m.concepto || '—'}
                  </td>
                  <td className={'py-2 pr-4 text-right font-medium ' +
                    (Number(m.cantidad_signed) > 0 ? 'text-emerald-700' : 'text-red-700')}>
                    {Number(m.cantidad_signed) > 0 ? '+' : ''}{Number(m.cantidad_signed).toFixed(2)}
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-500">
                    {m.factura_numero ? `Fac. ${m.factura_numero}` : (m.notas || '—')}
                  </td>
                  <td className="py-2 text-right">
                    {m.tipo !== 'salida_factura' && (
                      <button onClick={() => eliminarMovimiento(m.id)}
                        className="p-1 rounded hover:bg-red-50 text-red-600" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Depositos() {
  const [depositos, setDepositos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevoModal, setNuevoModal] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const toast = useToast();

  async function recargar() {
    setLoading(true);
    const [d, c] = await Promise.all([
      window.api.depositos.list({ solo_activos: true }),
      window.api.clientes.list(),
    ]);
    setDepositos(Array.isArray(d) ? d : []);
    setClientes(Array.isArray(c) ? c : []);
    setLoading(false);
  }

  useEffect(() => { recargar(); }, []);

  async function eliminar(id) {
    if (!confirm('¿Archivar este depósito? Los movimientos quedan en histórico.')) return;
    await window.api.depositos.delete(id);
    toast.success('Depósito archivado');
    recargar();
  }

  if (seleccionado) {
    return <DepositoDetalle deposito={seleccionado} onBack={() => { setSeleccionado(null); recargar(); }} />;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
            <Warehouse size={20} className="text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Depósitos</h1>
            <p className="text-sm text-slate-500">
              Stock que tienes en tiendas/clientes. Se descuenta automáticamente al facturar.
            </p>
          </div>
        </div>
        <button onClick={() => setNuevoModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm hover:bg-brand-dark">
          <Plus size={16} />
          Nuevo depósito
        </button>
      </div>

      {nuevoModal && (
        <DepositoForm
          clientes={clientes}
          onSaved={() => { setNuevoModal(false); recargar(); }}
          onCancel={() => setNuevoModal(false)}
        />
      )}

      {loading ? (
        <p className="text-sm text-slate-500 text-center py-8">Cargando…</p>
      ) : depositos.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <Warehouse size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600 mb-4">
            No tienes ningún depósito todavía.
          </p>
          <button onClick={() => setNuevoModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm hover:bg-brand-dark">
            <Plus size={16} />
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {depositos.map((d) => (
            <div key={d.id}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-brand cursor-pointer transition-colors"
              onClick={() => setSeleccionado(d)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{d.nombre}</h3>
                  <p className="text-xs text-slate-500">{d.cliente_nombre}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); eliminar(d.id); }}
                  className="p-1 rounded hover:bg-red-50 text-red-500" title="Archivar">
                  <Trash2 size={14} />
                </button>
              </div>
              {d.notas && <p className="text-xs text-slate-500 mt-2">{d.notas}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Depositos;
