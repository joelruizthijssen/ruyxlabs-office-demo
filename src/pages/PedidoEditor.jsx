// Editor de pedido a proveedor — version simplificada del editor de factura.
// Cabecera con numero/fecha/proveedor/estado + lista de lineas editables +
// totales + botones para guardar y descargar PDF.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Download, Check, Package, Receipt } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import PedidoPDF from '../pdf/PedidoPDF.jsx';
import RecibirPedidoModal from '../components/RecibirPedidoModal.jsx';
import ProveedorComboboxLibre from '../components/ProveedorComboboxLibre.jsx';
import ProductoAutocomplete from '../components/ProductoAutocomplete.jsx';
import { formatEUR } from '../utils/format.js';
import { useToast } from '../components/Toast.jsx';

const ESTADOS = ['borrador', 'enviado', 'recibido'];
const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand text-sm';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

function useDebouncedEffect(value, delay, cb) {
  const cbRef = useRef(cb);
  useEffect(() => { cbRef.current = cb; });
  useEffect(() => {
    const t = setTimeout(() => cbRef.current(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
}

function PedidoEditor() {
  const { id } = useParams();
  const pedidoId = Number(id);
  const nav = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cab, setCab] = useState({
    numero: '', fecha: '', ciudad_emision: '',
    proveedor: '', proveedor_id: null,
    notas: '', iva_porcentaje: 21, estado: 'borrador',
  });
  const [cabOriginal, setCabOriginal] = useState(cab);
  const [lineas, setLineas] = useState([]);
  const [totales, setTotales] = useState({ base: 0, iva: 0, total: 0 });
  const [settings, setSettings] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  // v1.2.41: gasto generado al recibir el pedido y pedido origen si este es
  // un back-order. Se cargan al traer el pedido y se usan para mostrar
  // chips/botones de trazabilidad.
  const [gastoGenerado, setGastoGenerado] = useState(null);
  const [backOrderDe, setBackOrderDe] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [showRecibir, setShowRecibir] = useState(false);

  async function recibirPedido({ recepciones, fecha_gasto, diana_pct_default }) {
    const res = await window.api.pedidos.recibir(pedidoId, {
      recepciones,
      fecha_gasto,
      diana_pct_default,
    });
    if (res && res.error) throw new Error(res.error);
    setShowRecibir(false);
    if (res?.backorderPedidoId) {
      toast.success(`Gasto creado + back-order ${res.backorderPedidoNumero} generado`);
    } else {
      toast.success('Gasto creado desde el pedido');
    }
    window.dispatchEvent(new CustomEvent('data-changed'));
    nav('/gastos', { state: { abrirGastoId: res.gastoId } });
  }

  const cargar = useCallback(async () => {
    if (!window.api?.pedidos) {
      setError('Esta aplicación debe ejecutarse desde Electron.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [p, s, provs, prods] = await Promise.all([
        window.api.pedidos.get(pedidoId),
        window.api.settings.get(),
        window.api.proveedores ? window.api.proveedores.list() : Promise.resolve([]),
        window.api.productos ? window.api.productos.list() : Promise.resolve([]),
      ]);
      if (p?.error) { setError(p.error); return; }
      if (!p) { setError('Pedido no encontrado'); return; }
      const newCab = {
        numero: p.numero ?? '',
        fecha: p.fecha ?? '',
        ciudad_emision: p.ciudad_emision ?? '',
        proveedor: p.proveedor ?? '',
        proveedor_id: p.proveedor_id ?? null,
        notas: p.notas ?? '',
        iva_porcentaje: Number(p.iva_porcentaje) || 0,
        estado: p.estado ?? 'borrador',
      };
      setCab(newCab);
      setCabOriginal(newCab);
      setLineas(p.lineas || []);
      setTotales({
        base: Number(p.base_imponible) || 0,
        iva: Number(p.iva_importe) || 0,
        total: Number(p.total) || 0,
      });
      setSettings(s && !s.error ? s : null);
      setProveedores(Array.isArray(provs) ? provs : []);
      setProductos(Array.isArray(prods) ? prods : []);
      setGastoGenerado(p.gasto_generado || null);
      setBackOrderDe(p.back_order_de || null);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [pedidoId]);

  useEffect(() => { cargar(); }, [cargar]);

  const cabDirty = JSON.stringify(cab) !== JSON.stringify(cabOriginal);

  useDebouncedEffect(cab, 500, async (current) => {
    if (loading) return;
    if (JSON.stringify(current) === JSON.stringify(cabOriginal)) return;
    try {
      const res = await window.api.pedidos.update(pedidoId, current);
      if (res?.error) { setError(res.error); return; }
      setCabOriginal(current);
      if (res) {
        setTotales({
          base: Number(res.base_imponible) || 0,
          iva: Number(res.iva_importe) || 0,
          total: Number(res.total) || 0,
        });
      }
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 1500);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  });

  async function addLinea() {
    try {
      const ln = await window.api.lineasPedido.create(pedidoId, {
        titulo: '', descripcion: '', cantidad: 1, precio_unitario: 0,
        codigo: '',
        iva_pct: cab.iva_porcentaje,
        descuento_tipo: 'pct', descuento_valor: 0,
      });
      if (ln?.error) { toast.error(ln.error); return; }
      const lns = await window.api.lineasPedido.list(pedidoId);
      setLineas(lns || []);
      await refrescarTotalesDesdeBackend();
    } catch (e) { toast.error(e.message ?? String(e)); }
  }

  async function actualizarLinea(linea_id, data) {
    // v1.2.45: si cambia cantidad o precio_unitario y NO se manda importe
    // explicito, recalcularlo local (cant * precio) antes de mandar al
    // backend. El backend respeta 'importe' si viene en el objeto, asi que
    // mandar el estado completo con importe viejo (0) hacia que se quedara
    // en 0. Se puede seguir editando 'importe' a mano en su celda; ese
    // flujo lo lleva otro path (no llama aqui con solo importe cambiado).
    let patch = { ...data };
    const linea = lineas.find((l) => l.id === linea_id);
    if (linea && data?.importe == null && (
      Object.prototype.hasOwnProperty.call(data, 'cantidad') ||
      Object.prototype.hasOwnProperty.call(data, 'precio_unitario')
    )) {
      const cant = Number(patch.cantidad ?? linea.cantidad ?? 1) || 1;
      const precio = Number(patch.precio_unitario ?? linea.precio_unitario ?? 0) || 0;
      patch.importe = Math.round(cant * precio * 100) / 100;
    }
    const next = lineas.map((l) => l.id === linea_id ? { ...l, ...patch } : l);
    setLineas(next);
    const tgt = next.find((l) => l.id === linea_id);
    try {
      const res = await window.api.lineasPedido.update(linea_id, tgt);
      if (res?.error) toast.error(res.error);
      await refrescarTotalesDesdeBackend();
    } catch (e) { toast.error(e.message ?? String(e)); }
  }

  // v1.2.44: aplica un producto a una linea (autofill titulo + descripcion +
  // precio + iva). Usado tanto por el autocomplete del concepto como por
  // el lookup del codigo al perder el foco.
  // v1.2.45: para pedidos usamos precio_COMPRA (coste del proveedor), NO
  // precio_venta — un pedido va al proveedor, no a un cliente. Fallback a 0.
  // v1.2.47: si el proveedor tiene tarifa_aplicar (1..4) y el producto
  // tiene precio_compra_N relleno, usa ese; si no, cae a precio_compra base.
  function aplicarProducto(linea_id, p) {
    if (!p) return;
    const l = lineas.find((x) => x.id === linea_id);
    const cant = Number(l?.cantidad) || 1;
    // Resuelve el precio segun la tarifa de compra del proveedor activo.
    const prov = cab.proveedor_id
      ? proveedores.find((x) => x.id === cab.proveedor_id)
      : null;
    const tarifaId = Number(prov?.tarifa_aplicar) || 0;
    const precioTarifa = tarifaId >= 1 && tarifaId <= 4
      ? Number(p[`precio_compra_${tarifaId}`]) || 0
      : 0;
    const precioBase = Number(p.precio_compra) || 0;
    const precio = precioTarifa > 0 ? precioTarifa : precioBase;
    const importe = Math.round(cant * precio * 100) / 100;
    actualizarLinea(linea_id, {
      titulo: p.nombre || '',
      codigo: p.codigo || '',
      descripcion: p.descripcion || '',
      precio_unitario: precio,
      cantidad: cant,
      importe,
      iva_pct: p.iva_pct == null ? cab.iva_porcentaje : p.iva_pct,
    });
  }
  function buscarProductoPorCodigo(codigo) {
    const c = String(codigo || '').trim().toLowerCase();
    if (!c) return null;
    return productos.find((p) => String(p.codigo || '').trim().toLowerCase() === c) || null;
  }

  async function eliminarLinea(linea_id) {
    try {
      const res = await window.api.lineasPedido.delete(linea_id);
      if (res?.error) { toast.error(res.error); return; }
      setLineas(lineas.filter((l) => l.id !== linea_id));
      await refrescarTotalesDesdeBackend();
    } catch (e) { toast.error(e.message ?? String(e)); }
  }

  async function refrescarTotalesDesdeBackend() {
    try {
      const p = await window.api.pedidos.get(pedidoId);
      if (p && !p.error) {
        setTotales({
          base: Number(p.base_imponible) || 0,
          iva: Number(p.iva_importe) || 0,
          total: Number(p.total) || 0,
        });
      }
    } catch { /* noop */ }
  }

  async function descargarPDF() {
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await pdf(
        <PedidoPDF
          pedido={{
            ...cab,
            base_imponible: totales.base,
            iva_importe: totales.iva,
            total: totales.total,
          }}
          lineas={lineas}
          settings={settings}
        />,
      ).toBlob();
      const arrBuf = await blob.arrayBuffer();
      const u8 = new Uint8Array(arrBuf);
      const filename = `Pedido_${(cab.numero || pedidoId).replace(/[\\/]/g, '-')}.pdf`;
      const res = await window.api.pdf.saveInforme(filename, u8);
      if (res?.error) toast.error(res.error);
      else toast.success(`PDF guardado: ${res?.path || filename}`);
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <div className="text-slate-500">Cargando…</div>;
  if (error) {
    return (
      <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="-m-8">
      <div className="px-8 pt-6 pb-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => nav('/pedidos')}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft size={18} /> Volver
            </button>
            <div className="text-2xl font-semibold text-slate-800">
              PEDIDO {cab.numero}
            </div>
            {guardadoOk ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                <Check size={13} /> Guardado
              </span>
            ) : cabDirty ? (
              <span className="text-xs text-amber-600">Sin guardar</span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={cab.estado}
              onChange={(e) => setCab({ ...cab, estado: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {cab.estado !== 'recibido' && lineas.length > 0 ? (
              <button
                onClick={() => setShowRecibir(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors text-sm font-medium"
                title="Marcar el pedido como recibido y generar el gasto"
              >
                <Package size={15} />
                Recibir
              </button>
            ) : null}
            <button
              onClick={descargarPDF}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm transition-colors disabled:opacity-60"
            >
              <Download size={15} />
              {downloading ? 'Generando…' : 'Descargar PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-5 max-w-6xl">
        {(gastoGenerado || backOrderDe) && (
          <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-3 flex-wrap text-sm">
            {gastoGenerado ? (
              <button
                onClick={() => nav('/gastos', { state: { abrirGastoId: gastoGenerado.id } })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
                title="Ver el gasto creado al recibir este pedido"
              >
                <Receipt size={15} />
                Ver gasto generado
                <span className="text-xs text-emerald-700">({formatEUR(gastoGenerado.total || 0)})</span>
              </button>
            ) : null}
            {backOrderDe ? (
              <button
                onClick={() => nav(`/pedidos/${backOrderDe.pedido_id}`)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors"
                title="Este pedido es back-order del original"
              >
                ↩ Back-order de {backOrderDe.pedido_numero}
              </button>
            ) : null}
          </div>
        )}

        <section className="bg-white rounded-lg shadow-sm p-5">
          <div className="grid grid-cols-[1fr_140px_120px] gap-3 mb-3">
            <div>
              <label className={labelCls}>Proveedor</label>
              <ProveedorComboboxLibre
                value={{ id: cab.proveedor_id, text: cab.proveedor }}
                onChange={(v) => setCab({
                  ...cab,
                  proveedor: v.text,
                  proveedor_id: v.id,
                })}
                proveedores={proveedores}
              />
            </div>
            <div>
              <label className={labelCls}>Fecha</label>
              <input
                type="date"
                className={inputCls}
                value={cab.fecha}
                onChange={(e) => setCab({ ...cab, fecha: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>IVA (%) por defecto</label>
              <input
                type="number" step="0.01"
                className={inputCls + ' text-right'}
                value={cab.iva_porcentaje}
                onChange={(e) => setCab({ ...cab, iva_porcentaje: Number(e.target.value) || 0 })}
                onFocus={(e) => e.target.select()}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <textarea
              className={inputCls}
              rows={2}
              value={cab.notas}
              placeholder="Opcional — instrucciones de entrega, condiciones, etc."
              onChange={(e) => setCab({ ...cab, notas: e.target.value })}
            />
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-sm p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
              Líneas del pedido
            </h3>
          </div>

          {lineas.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-6">
              Añade líneas con lo que vas a pedirle al proveedor.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Cabecera columnas */}
              <div className="grid grid-cols-[80px_1fr_60px_80px_90px_65px_80px_55px_30px] gap-2 text-[10px] text-slate-500 uppercase tracking-wide font-medium px-1">
                <div>Código</div>
                <div>Concepto</div>
                <div className="text-right">Cant.</div>
                <div className="text-right">Precio U.</div>
                <div className="text-right">Importe</div>
                <div className="text-right">IVA %</div>
                <div className="text-right">Dto. valor</div>
                <div className="text-center">Dto. tipo</div>
                <div />
              </div>
              {lineas.map((l) => (
                <div key={l.id} className="border border-slate-100 rounded-lg p-2 space-y-2">
                <div className="grid grid-cols-[80px_1fr_60px_80px_90px_65px_80px_55px_30px] gap-2 items-center">
                  <input
                    className={inputCls + ' font-mono'}
                    placeholder="Código"
                    value={l.codigo || ''}
                    onChange={(e) => actualizarLinea(l.id, { codigo: e.target.value })}
                    onBlur={(e) => {
                      const p = buscarProductoPorCodigo(e.target.value);
                      if (p) aplicarProducto(l.id, p);
                    }}
                    title="Al salir del campo, si el codigo coincide con un producto del catalogo se autocompleta"
                  />
                  <ProductoAutocomplete
                    className={inputCls}
                    value={l.titulo || ''}
                    placeholder="Concepto o busca producto (nombre o #codigo)"
                    onChange={(v) => actualizarLinea(l.id, { titulo: v })}
                    onSelectProducto={(p) => aplicarProducto(l.id, p)}
                  />
                  <input
                    type="number" step="0.01" min="0"
                    className={inputCls + ' text-right'}
                    value={l.cantidad ?? 1}
                    onChange={(e) => actualizarLinea(l.id, { cantidad: Number(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                  />
                  <input
                    type="number" step="0.01" min="0"
                    className={inputCls + ' text-right'}
                    value={l.precio_unitario ?? 0}
                    onChange={(e) => actualizarLinea(l.id, { precio_unitario: Number(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                  />
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right text-sm tabular-nums">
                    {formatEUR(l.importe)}
                  </div>
                  <input
                    type="number" step="0.01" min="0"
                    className={inputCls + ' text-right'}
                    placeholder={String(cab.iva_porcentaje)}
                    value={l.iva_pct ?? ''}
                    title="Si lo dejas vacío, hereda el IVA por defecto del pedido"
                    onChange={(e) => actualizarLinea(l.id, {
                      iva_pct: e.target.value === '' ? null : Number(e.target.value),
                    })}
                    onFocus={(e) => e.target.select()}
                  />
                  <input
                    type="number" step="0.01" min="0"
                    className={inputCls + ' text-right'}
                    placeholder="0"
                    value={l.descuento_valor ?? 0}
                    onChange={(e) => actualizarLinea(l.id, {
                      descuento_valor: Number(e.target.value) || 0,
                    })}
                    onFocus={(e) => e.target.select()}
                    title="Valor del descuento (numero). El tipo (% o €) se elige en la casilla de al lado."
                  />
                  <select
                    className="w-full px-1 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    value={l.descuento_tipo === 'eur' ? 'eur' : 'pct'}
                    title="% = porcentaje sobre importe. € = importe fijo en euros."
                    onChange={(e) => actualizarLinea(l.id, { descuento_tipo: e.target.value })}
                  >
                    <option value="pct">%</option>
                    <option value="eur">€</option>
                  </select>
                  <button
                    onClick={() => eliminarLinea(l.id)}
                    className="p-2 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Eliminar línea"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <input
                  className={inputCls + ' text-xs'}
                  value={l.descripcion || ''}
                  placeholder="Descripción opcional (aparecerá bajo el concepto en el PDF)"
                  onChange={(e) => actualizarLinea(l.id, { descripcion: e.target.value })}
                />
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex justify-center">
            <button
              onClick={addLinea}
              className="inline-flex items-center gap-1 px-4 py-2 rounded bg-brand hover:bg-brand-dark text-white text-sm"
            >
              <Plus size={14} /> Añadir línea
            </button>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-sm p-5">
          <div className="max-w-sm ml-auto space-y-2">
            <div className="flex justify-between text-sm text-slate-700">
              <span>Base imponible</span>
              <span className="tabular-nums">{formatEUR(totales.base)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-700">
              <span>IVA {cab.iva_porcentaje}%</span>
              <span className="tabular-nums">{formatEUR(totales.iva)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-slate-900 pt-2 border-t border-slate-200">
              <span>TOTAL</span>
              <span className="tabular-nums">{formatEUR(totales.total)}</span>
            </div>
          </div>
        </section>
      </div>

      {showRecibir ? (
        <RecibirPedidoModal
          pedido={{ numero: cab.numero, iva_porcentaje: cab.iva_porcentaje }}
          lineas={lineas}
          onConfirm={recibirPedido}
          onCancel={() => setShowRecibir(false)}
        />
      ) : null}
    </div>
  );
}

export default PedidoEditor;
