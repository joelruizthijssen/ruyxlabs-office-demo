// v1.5.0: modulo stock en deposito.
//
// Un "deposito" es una tienda (cliente) donde tenemos material fisico
// nuestro. Al facturar, el stock se descuenta automaticamente. Aqui:
//   - listar depositos + ver saldo total.
//   - ficha por deposito: stock actual por producto + movimientos + entrada
//     rapida + PDF hoja de stock.

import { useEffect, useMemo, useState } from 'react';
import { Warehouse, Plus, Trash2, Download, ArrowLeft, Pencil, ChevronDown, ChevronRight, Check, X } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { formatFechaES, formatEUR } from '../utils/format.js';
import { confirmDialog } from '../utils/confirmDialog.js';
import { HojaStockPDF } from '../pdf/HojaStockPDF.jsx';
import { useToast } from '../components/Toast.jsx';
import ProductoAutocomplete from '../components/ProductoAutocomplete.jsx';
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
  const [productoTexto, setProductoTexto] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [precio, setPrecio] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function guardar() {
    if (!productoId) { toast.error('Elige un producto del catálogo'); return; }
    const c = Number(cantidad);
    if (!Number.isFinite(c) || c <= 0) { toast.error('Cantidad debe ser > 0'); return; }
    setSaving(true);
    try {
      const p = productos.find((x) => x.id === Number(productoId));
      const res = await window.api.depositos.movimientosCreate({
        deposito_id: depositoId,
        tipo: 'entrada',
        fecha,
        producto_id: Number(productoId),
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
          <label className={labelCls}>Producto * <span className="text-slate-400 font-normal">(código o nombre)</span></label>
          <ProductoAutocomplete
            value={productoTexto}
            onChange={(v) => { setProductoTexto(v); setProductoId(''); }}
            onSelectProducto={(p) => {
              setProductoId(String(p.id));
              setProductoTexto(p.codigo ? `[${p.codigo}] ${p.nombre}` : p.nombre);
              setPrecio(String(p.precio_compra || p.precio_venta || 0));
            }}
            className={inputCls + ' bg-white'}
            placeholder="Empieza a escribir código o nombre…"
          />
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

function DepositoDetalle({ deposito: depositoInit, clientes, onBack }) {
  const [deposito, setDeposito] = useState(depositoInit);
  const [stock, setStock] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [showEntrada, setShowEntrada] = useState(false);
  const [editandoDeposito, setEditandoDeposito] = useState(false);
  const [descargando, setDescargando] = useState(false);
  // v1.5.1: agrupacion de movimientos por fecha con expand/collapse.
  const [fechasExpandidas, setFechasExpandidas] = useState(new Set());
  // v1.5.1: edicion inline de movimiento (por id).
  const [editandoMov, setEditandoMov] = useState(null);
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
    if (!(await confirmDialog({ message: '¿Eliminar este movimiento? El stock se recalculará.', danger: true, okLabel: 'Eliminar' }))) return;
    await window.api.depositos.movimientosDelete(id);
    toast.success('Movimiento eliminado');
    recargar();
  }

  // Agrupa los movimientos por fecha. Devuelve array [{fecha, items:[m,...]}]
  // ordenado por fecha descendente.
  const movimientosPorFecha = useMemo(() => {
    const g = new Map();
    for (const m of movimientos) {
      const k = m.fecha;
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(m);
    }
    return [...g.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([fecha, items]) => ({ fecha, items }));
  }, [movimientos]);

  // Al cargar los movimientos por primera vez, expandimos la fecha mas
  // reciente para que el usuario vea algun contenido sin tener que abrirlo.
  useEffect(() => {
    if (movimientosPorFecha.length > 0 && fechasExpandidas.size === 0) {
      setFechasExpandidas(new Set([movimientosPorFecha[0].fecha]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimientosPorFecha.length]);

  function toggleFecha(fecha) {
    setFechasExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(fecha)) next.delete(fecha);
      else next.add(fecha);
      return next;
    });
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
      // Demo web: descarga via blob URL + <a download> (sin filesystem).
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
          <button onClick={() => setEditandoDeposito(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
            title="Editar nombre / tienda / notas">
            <Pencil size={14} />
            Editar depósito
          </button>
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

      {editandoDeposito && (
        <DepositoForm
          initial={deposito}
          clientes={clientes}
          onSaved={(r) => {
            setEditandoDeposito(false);
            if (r && !r.error) setDeposito({ ...deposito, ...r });
          }}
          onCancel={() => setEditandoDeposito(false)}
        />
      )}

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

      {/* Movimientos — agrupados por fecha, expandibles */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">
          Movimientos ({movimientos.length})
        </h2>
        {movimientosPorFecha.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            Sin movimientos todavía.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {movimientosPorFecha.map(({ fecha, items }) => {
              const abierta = fechasExpandidas.has(fecha);
              const totalEntradas = items.filter((m) => Number(m.cantidad_signed) > 0).length;
              const totalSalidas  = items.filter((m) => Number(m.cantidad_signed) < 0).length;
              return (
                <div key={fecha}>
                  <button
                    onClick={() => toggleFecha(fecha)}
                    className="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-50 px-2 rounded"
                  >
                    {abierta
                      ? <ChevronDown size={16} className="text-slate-500 shrink-0" />
                      : <ChevronRight size={16} className="text-slate-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">
                        {formatFechaES(fecha)}
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs">
                      {totalEntradas > 0 && (
                        <span className="text-emerald-700">
                          {totalEntradas} entrada{totalEntradas !== 1 ? 's' : ''}
                        </span>
                      )}
                      {totalSalidas > 0 && (
                        <span className="text-red-700">
                          {totalSalidas} salida{totalSalidas !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </button>
                  {abierta && (
                    <div className="pb-3 pl-8 pr-2 space-y-1">
                      {items.map((m) => (
                        <MovimientoRow
                          key={m.id}
                          m={m}
                          editando={editandoMov === m.id}
                          onEdit={() => setEditandoMov(m.id)}
                          onSaved={() => { setEditandoMov(null); recargar(); }}
                          onCancel={() => setEditandoMov(null)}
                          onDelete={() => eliminarMovimiento(m.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MovimientoRow({ m, editando, onEdit, onSaved, onCancel, onDelete }) {
  const [cantidad, setCantidad] = useState(String(Math.abs(Number(m.cantidad_signed) || 0)));
  const [notas, setNotas] = useState(m.notas || '');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const esFactura = m.tipo === 'salida_factura';
  const editable = !esFactura;

  useEffect(() => {
    if (editando) {
      setCantidad(String(Math.abs(Number(m.cantidad_signed) || 0)));
      setNotas(m.notas || '');
    }
  }, [editando, m]);

  async function guardar() {
    const c = Number(cantidad);
    if (!Number.isFinite(c) || c <= 0) { toast.error('Cantidad debe ser > 0'); return; }
    setSaving(true);
    try {
      const res = await window.api.depositos.movimientosUpdate(m.id, {
        cantidad_signed: c,
        notas: notas.trim() || null,
      });
      if (res?.error) { toast.error(res.error); return; }
      toast.success('Movimiento actualizado');
      onSaved();
    } catch (e) { toast.error(e.message ?? String(e)); }
    finally { setSaving(false); }
  }

  if (editando) {
    return (
      <div className="flex items-center gap-2 py-1.5 bg-amber-50 border border-amber-200 rounded px-2">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xs font-medium text-slate-700 truncate">
            {m.producto_codigo && <span className="font-mono text-slate-500 mr-1">[{m.producto_codigo}]</span>}
            {m.producto_nombre || m.concepto || '—'}
          </span>
        </div>
        <input
          type="number"
          step="0.01"
          className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-right"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
        <input
          type="text"
          className="w-40 px-2 py-1 border border-slate-300 rounded text-sm"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas"
        />
        <button onClick={guardar} disabled={saving}
          className="p-1 rounded hover:bg-emerald-100 text-emerald-700" title="Guardar">
          <Check size={14} />
        </button>
        <button onClick={onCancel} disabled={saving}
          className="p-1 rounded hover:bg-slate-100 text-slate-600" title="Cancelar">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1.5 text-sm hover:bg-slate-50 rounded px-2">
      <div className="flex-1 min-w-0">
        <span className="truncate">
          {m.producto_codigo && <span className="font-mono text-xs text-slate-500 mr-2">[{m.producto_codigo}]</span>}
          {m.producto_nombre || m.concepto || '—'}
        </span>
      </div>
      <div className="text-xs">
        {m.tipo === 'entrada' && <span className="text-emerald-700 font-medium">Entrada</span>}
        {m.tipo === 'salida_factura' && <span className="text-red-700 font-medium">Salida (factura)</span>}
        {m.tipo === 'ajuste' && <span className="text-slate-500 font-medium">Ajuste</span>}
      </div>
      <div className={'w-16 text-right font-medium tabular-nums ' +
        (Number(m.cantidad_signed) > 0 ? 'text-emerald-700' : 'text-red-700')}>
        {Number(m.cantidad_signed) > 0 ? '+' : ''}{Number(m.cantidad_signed).toFixed(2)}
      </div>
      <div className="w-32 text-xs text-slate-500 truncate">
        {m.factura_numero ? `Fac. ${m.factura_numero}` : (m.notas || '—')}
      </div>
      {editable && (
        <>
          <button onClick={onEdit}
            className="p-1 rounded hover:bg-slate-200 text-slate-600" title="Editar">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete}
            className="p-1 rounded hover:bg-red-50 text-red-600" title="Eliminar">
            <Trash2 size={13} />
          </button>
        </>
      )}
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
    if (!(await confirmDialog({ message: '¿Archivar este depósito? Los movimientos quedan en histórico.', danger: true, okLabel: 'Archivar' }))) return;
    await window.api.depositos.delete(id);
    toast.success('Depósito archivado');
    recargar();
  }

  if (seleccionado) {
    return <DepositoDetalle
      deposito={seleccionado}
      clientes={clientes}
      onBack={() => { setSeleccionado(null); recargar(); }}
    />;
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
