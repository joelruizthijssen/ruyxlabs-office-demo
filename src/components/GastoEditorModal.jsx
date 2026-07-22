// Modal para crear/editar un gasto deducible. Recibe `gasto` (null = nuevo)
// y dispara `onSaved` con el gasto creado/actualizado al guardar.
//
// Gasto MULTILÍNEA: una factura de proveedor puede tener varios artículos,
// cada uno con su código, concepto, base e IVA. La cabecera del gasto guarda
// los totales agregados (lo hace el backend). El IRPF es de cabecera (un
// proveedor retiene igual a toda su factura).

import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useToast } from './Toast.jsx';
import ProductoAutocomplete from './ProductoAutocomplete.jsx';
import PagosGastoSection from './PagosGastoSection.jsx';
import VencimientosGastoSection from './VencimientosGastoSection.jsx';
import ProveedorCombobox from './ProveedorCombobox.jsx';
import ProveedorFormModal from './ProveedorFormModal.jsx';
import { calcTotales, formatFechaES } from '../utils/format.js';

const CATEGORIAS_SUGERIDAS = [
  'Suministros',
  'Material',
  'Asesoría',
  'Transporte',
  'Software',
  'Telefonía',
  'Alquiler',
  'Seguros',
  'Otros',
];

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand text-sm';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nuevaLinea() {
  return {
    codigo: '',
    concepto: '',
    cantidad: 1,
    precio_unitario: 0,
    base_imponible: 0,
    iva_pct: 21,
    descuento_tipo: 'pct',
    descuento_valor: 0,
    diana_pct: 0,
    notas: '',
  };
}

// v1.2.25: aplica los datos de un producto a una linea, calculando precio
// unitario y base segun cantidad. Usado tanto desde el autocomplete como
// desde el lookup al teclear codigo manualmente.
// v1.5.5: respeta proveedor.tarifa_aplicar (T1-T4) para elegir precio.
function aplicarProducto(linea, producto, proveedor) {
  const tarifaId = Number(proveedor?.tarifa_aplicar) || 0;
  const precioTarifa = tarifaId >= 1 && tarifaId <= 4
    ? Number(producto[`precio_compra_${tarifaId}`]) || 0
    : 0;
  const precioBase = Number(producto.precio_compra) || 0;
  const precio = precioTarifa > 0
    ? precioTarifa
    : (precioBase > 0 ? precioBase : (Number(linea.precio_unitario) || 0));
  const cant = Number(linea.cantidad) > 0 ? Number(linea.cantidad) : 1;
  const baseCalc = Math.round(precio * cant * 100) / 100;
  return {
    ...linea,
    codigo: producto.codigo || linea.codigo,
    concepto: producto.nombre || linea.concepto,
    precio_unitario: precio,
    base_imponible: precio > 0 ? baseCalc : linea.base_imponible,
    iva_pct: producto.iva_pct == null ? linea.iva_pct : Number(producto.iva_pct),
  };
}

function GastoEditorModal({ gasto, onClose, onSaved }) {
  const toast = useToast();
  // `gasto` puede ser:
  //   - null/undefined → nuevo gasto normal
  //   - { __nuevo: true, subtipo } → nuevo, sembrado por el botón "Nuevo abono"
  //   - objeto real con id → edición
  const editing = !!(gasto && gasto.id);
  const [form, setForm] = useState(() => ({
    fecha: gasto?.fecha || todayISO(),
    fecha_vencimiento: gasto?.fecha_vencimiento || '',
    proveedor: gasto?.proveedor || '',
    proveedor_id: gasto?.proveedor_id || null,
    numero_factura_proveedor: gasto?.numero_factura_proveedor || '',
    categoria: gasto?.categoria || '',
    irpf_pct: gasto?.irpf_pct ?? 0,
    marca_id: gasto?.marca_id || null,
    deducible: gasto?.deducible == null ? 1 : (gasto.deducible ? 1 : 0),
    notas: gasto?.notas || '',
    subtipo: gasto?.subtipo === 'abono' ? 'abono' : 'gasto',
    descuento_tipo: gasto?.descuento_tipo === 'eur' ? 'eur' : 'pct',
    descuento_valor: Number(gasto?.descuento_valor) || 0,
  }));
  const esAbono = form.subtipo === 'abono';
  const [proveedoresDisp, setProveedoresDisp] = useState([]);
  const [showProveedorModal, setShowProveedorModal] = useState(false);
  const [nuevoProveedorSeed, setNuevoProveedorSeed] = useState('');
  // Pagos en memoria mientras NO existe gasto.id. Tras crearlo se persisten.
  // En edicion se ignora — la seccion habla con el backend directamente.
  const [pagosInline, setPagosInline] = useState([]);
  // v1.2.31: vencimientos fraccionados en modo creacion (sin gasto.id aun).
  const [vencsInline, setVencsInline] = useState([]);

  async function cargarProveedores() {
    if (!window.api?.proveedores) return;
    try {
      const l = await window.api.proveedores.list();
      setProveedoresDisp(Array.isArray(l) ? l : []);
    } catch { /* noop */ }
  }
  useEffect(() => {
    cargarProveedores();
  }, []);

  function onElegirProveedor(id) {
    if (id == null) {
      setForm((f) => ({ ...f, proveedor_id: null }));
      return;
    }
    const pv = proveedoresDisp.find((p) => p.id === id);
    if (!pv) {
      setForm((f) => ({ ...f, proveedor_id: id }));
      return;
    }
    setForm((f) => {
      const next = { ...f, proveedor_id: id, proveedor: pv.nombre };
      // Autorrellena IRPF si tenia 0 y el proveedor tiene default.
      const irpfDef = Number(pv.irpf_pct_default) || 0;
      if (irpfDef > 0 && Number(f.irpf_pct) === 0) {
        next.irpf_pct = irpfDef;
      }
      return next;
    });
    // Sugerir IVA habitual a líneas vacías (base = 0).
    const ivaDef = pv.iva_pct_default == null ? null : Number(pv.iva_pct_default);
    if (ivaDef != null && Number.isFinite(ivaDef)) {
      setLineas((arr) =>
        arr.map((l) =>
          Number(l.base_imponible) === 0 ? { ...l, iva_pct: ivaDef } : l,
        ),
      );
    }
  }

  function onCrearProveedor(seedNombre) {
    setNuevoProveedorSeed(seedNombre || '');
    setShowProveedorModal(true);
  }
  function onProveedorCreado(pv) {
    setShowProveedorModal(false);
    setProveedoresDisp((arr) => [...arr, pv]);
    onElegirProveedor(pv.id);
  }
  // Las líneas vienen de gastos_get (reales o sintetizada desde la cabecera
  // para gastos antiguos). Si no hay ninguna, empezamos con una vacía.
  const [lineas, setLineas] = useState(() => {
    const ls = Array.isArray(gasto?.lineas) ? gasto.lineas : [];
    if (ls.length === 0) return [nuevaLinea()];
    return ls.map((l) => {
      const cant = Number(l.cantidad) > 0 ? Number(l.cantidad) : 1;
      const base = Number(l.base_imponible) || 0;
      // Derivar precio_unitario si no viene explicito en BD (gastos antiguos).
      const precio = Number(l.precio_unitario) > 0
        ? Number(l.precio_unitario)
        : (cant !== 0 ? Math.round((base / cant) * 100) / 100 : 0);
      return {
        codigo: l.codigo || '',
        concepto: l.concepto || '',
        cantidad: cant,
        precio_unitario: precio,
        base_imponible: base,
        iva_pct: l.iva_pct == null ? 21 : Number(l.iva_pct),
        descuento_tipo: l.descuento_tipo === 'eur' ? 'eur' : 'pct',
        descuento_valor: Number(l.descuento_valor) || 0,
        diana_pct: Number(l.diana_pct) || 0,
        notas: l.notas || '',
      };
    });
  });
  const [saving, setSaving] = useState(false);
  const [marcas, setMarcas] = useState([]);
  // v1.2.25: cache de productos para lookup por codigo. Permite que al teclear
  // un codigo directamente (sin usar el autocomplete) se rellene concepto +
  // precio + IVA automaticamente — exactamente igual que al elegirlo del
  // desplegable.
  const [productosCache, setProductosCache] = useState([]);

  useEffect(() => {
    if (!window.api?.marcas) return;
    window.api.marcas.list().then((l) => setMarcas(Array.isArray(l) ? l : []));
  }, []);
  useEffect(() => {
    if (!window.api?.productos) return;
    window.api.productos.list().then((l) => setProductosCache(Array.isArray(l) ? l : []));
  }, []);

  function buscarProductoPorCodigo(codigo) {
    const c = (codigo || '').trim().toLowerCase();
    if (!c) return null;
    return productosCache.find((p) => (p.codigo || '').toLowerCase() === c) || null;
  }

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setLinea(i, patch) {
    setLineas((arr) => arr.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }
  function addLinea() {
    setLineas((arr) => [...arr, nuevaLinea()]);
  }
  function removeLinea(i) {
    setLineas((arr) => (arr.length <= 1 ? arr : arr.filter((_, j) => j !== i)));
  }

  // Cierre con Escape.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const totales = useMemo(() => {
    // Reusa `calcTotales` (mismo motor que facturas/presupuestos): aplica
    // descuento por linea + global proporcional. `base_imponible` se mapea
    // a `importe` porque calcTotales habla en terminos de "importes".
    const lineasParaCalc = lineas.map((l) => ({
      importe: Number(l.base_imponible) || 0,
      iva_pct: l.iva_pct,
      descuento_tipo: l.descuento_tipo,
      descuento_valor: l.descuento_valor,
    }));
    const t = calcTotales(lineasParaCalc, 0, form.irpf_pct, {
      incluyeIva: true,
      descuentoGlobalTipo: form.descuento_tipo,
      descuentoGlobalValor: form.descuento_valor,
    });
    return {
      base: t.base, iva: t.iva, irpf: t.irpf, total: t.total,
      ivaBreakdown: Array.isArray(t.ivaBreakdown) ? t.ivaBreakdown : [],
    };
  }, [lineas, form.irpf_pct, form.descuento_tipo, form.descuento_valor]);

  async function guardar() {
    if (!form.fecha) {
      toast.error('La fecha es obligatoria');
      return;
    }
    // Validación de base: depende del subtipo.
    if (esAbono) {
      if (totales.base >= 0) {
        toast.error('Un abono debe tener al menos una línea con base negativa');
        return;
      }
    } else if (totales.base <= 0) {
      toast.error('El gasto debe tener al menos una línea con importe');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        irpf_pct: Number(form.irpf_pct) || 0,
        marca_id: form.marca_id || null,
        deducible: form.deducible ? 1 : 0,
        descuento_tipo: form.descuento_tipo === 'eur' ? 'eur' : 'pct',
        descuento_valor: Number(form.descuento_valor) || 0,
        lineas: lineas
          .filter((l) => Number(l.base_imponible) !== 0 || l.concepto?.trim() || l.codigo?.trim())
          .map((l) => ({
            codigo: l.codigo?.trim() || null,
            concepto: l.concepto?.trim() || null,
            cantidad: Number(l.cantidad) > 0 ? Number(l.cantidad) : 1,
            precio_unitario: Number(l.precio_unitario) || 0,
            base_imponible: Number(l.base_imponible) || 0,
            iva_pct: Number(l.iva_pct) || 0,
            descuento_tipo: l.descuento_tipo === 'eur' ? 'eur' : 'pct',
            descuento_valor: Number(l.descuento_valor) || 0,
            diana_pct: Number(l.diana_pct) || 0,
            notas: l.notas?.trim() || null,
          })),
      };
      const res = editing
        ? await window.api.gastos.update(gasto.id, payload)
        : await window.api.gastos.create(payload);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      // Si era creacion y el usuario ha apuntado pagos inline, persistirlos
      // ahora que tenemos el gasto.id. Cualquier fallo individual se reporta
      // pero no aborta el resto (el gasto YA existe — interrumpir aqui dejaria
      // la mitad de pagos colgada).
      const nuevoId = !editing && res?.id ? res.id : null;
      if (nuevoId && pagosInline.length > 0) {
        for (const p of pagosInline) {
          try {
            const rr = await window.api.pagosGasto.create(nuevoId, {
              fecha: p.fecha,
              importe: Number(p.importe) || 0,
              metodo: p.metodo || null,
              notas: p.notas || null,
            });
            if (rr?.error) toast.error(`Pago ${formatFechaES(p.fecha)}: ${rr.error}`);
          } catch (e) {
            toast.error(`Pago ${formatFechaES(p.fecha)}: ${e.message ?? e}`);
          }
        }
      }
      // v1.2.31: persistir vencimientos fraccionados apuntados durante la
      // creacion. Mismo patron que pagos: errores individuales no abortan.
      if (nuevoId && vencsInline.length > 0) {
        for (const v of vencsInline) {
          try {
            const rr = await window.api.gastosVencimientos.create(nuevoId, {
              fecha: v.fecha,
              importe: Number(v.importe) || 0,
              notas: v.notas || null,
            });
            if (rr?.error) toast.error(`Vencimiento ${formatFechaES(v.fecha)}: ${rr.error}`);
          } catch (e) {
            toast.error(`Vencimiento ${formatFechaES(v.fecha)}: ${e.message ?? e}`);
          }
        }
      }
      toast.success(editing ? 'Gasto actualizado' : 'Gasto creado');
      onSaved?.(res);
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[92vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            {editing
              ? (esAbono ? 'Editar abono de proveedor' : 'Editar gasto')
              : (esAbono ? 'Nuevo abono de proveedor' : 'Nuevo gasto')}
            {esAbono && (
              <span className="text-[10px] uppercase tracking-wide text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                Abono
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Fecha *</label>
              <input
                type="date"
                className={inputCls}
                value={form.fecha}
                onChange={(e) => setField('fecha', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Vencimiento (opcional)</label>
              <input
                type="date"
                className={inputCls}
                value={form.fecha_vencimiento || ''}
                onChange={(e) => setField('fecha_vencimiento', e.target.value || '')}
                title="Cuando vence el pago. Solo informativo: aparece en el listado para detectar gastos vencidos."
              />
            </div>
            <div>
              <label className={labelCls}>Categoría</label>
              <input
                list="categorias-sug"
                className={inputCls}
                value={form.categoria}
                placeholder="Suministros, material, asesoría…"
                onChange={(e) => setField('categoria', e.target.value)}
              />
              <datalist id="categorias-sug">
                {CATEGORIAS_SUGERIDAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelCls}>Proveedor</label>
              {proveedoresDisp.length > 0 || form.proveedor_id ? (
                <ProveedorCombobox
                  value={form.proveedor_id}
                  onChange={onElegirProveedor}
                  proveedores={proveedoresDisp}
                  onCrearNuevo={onCrearProveedor}
                />
              ) : (
                <div className="flex gap-2">
                  <input
                    className={inputCls + ' flex-1'}
                    value={form.proveedor}
                    placeholder="Quién emitió la factura"
                    onChange={(e) => setField('proveedor', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => onCrearProveedor(form.proveedor)}
                    className="px-2 py-2 rounded-lg border border-slate-300 bg-white text-brand text-xs whitespace-nowrap hover:bg-brand/5"
                    title="Crear ficha de proveedor"
                  >
                    + Ficha
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Nº de factura del proveedor</label>
              <input
                className={inputCls}
                value={form.numero_factura_proveedor}
                placeholder="La referencia que pone el proveedor"
                onChange={(e) => setField('numero_factura_proveedor', e.target.value)}
              />
            </div>
          </div>

          {marcas.length > 0 && (
            <div>
              <label className={labelCls}>Marca (respaldo del informe)</label>
              <select
                className={inputCls + ' bg-white'}
                value={form.marca_id || ''}
                onChange={(e) =>
                  setField('marca_id', e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">— Sin marca —</option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre_comercial}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                El informe atribuye cada línea por el prefijo de su código; esta
                marca se usa solo para las líneas sin código que cuadre.
              </p>
            </div>
          )}

          {/* Líneas de artículos comprados */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600">
                Artículos comprados
              </label>
              <span className="text-xs text-slate-400">
                Busca por código o nombre del catálogo
              </span>
            </div>
            <div className="space-y-2">
              {lineas.map((l, i) => (
                <div key={i} className="space-y-1">
                <div className="flex gap-2 items-start flex-wrap">
                  <div className="w-20 shrink-0">
                    <input
                      className={inputCls + ' font-mono'}
                      placeholder="Código"
                      value={l.codigo}
                      onChange={(e) => setLinea(i, { codigo: e.target.value })}
                      onBlur={(e) => {
                        const p = buscarProductoPorCodigo(e.target.value);
                        if (p) {
                          const prov = form.proveedor_id
                            ? proveedoresDisp.find((x) => x.id === form.proveedor_id)
                            : null;
                          setLineas((arr) =>
                            arr.map((row, j) => (j === i ? aplicarProducto(row, p, prov) : row)),
                          );
                        }
                      }}
                    />
                  </div>
                  {/* v1.2.26: garantizamos min-w-[180px] para que el nombre del
                      producto se vea cuando se autorrellena al elegir codigo. */}
                  <div className="flex-1 min-w-[180px]">
                    <ProductoAutocomplete
                      className={inputCls}
                      placeholder="Concepto o busca producto (nombre o #código)"
                      value={l.concepto}
                      onChange={(v) => setLinea(i, { concepto: v })}
                      onSelectProducto={(p) => {
                        const prov = form.proveedor_id
                          ? proveedoresDisp.find((x) => x.id === form.proveedor_id)
                          : null;
                        setLineas((arr) =>
                          arr.map((row, j) => (j === i ? aplicarProducto(row, p, prov) : row)),
                        );
                      }}
                    />
                  </div>
                  <div className="w-14 shrink-0">
                    <input
                      type="number" onFocus={(e) => e.target.select()}
                      step="0.01"
                      {...(esAbono ? {} : { min: '0' })}
                      className={inputCls + ' text-right'}
                      placeholder="Cant."
                      title={esAbono ? "Cantidad (permite negativos en abonos)" : "Cantidad (uds)"}
                      value={Number(l.cantidad) || 1}
                      onChange={(e) => {
                        const v = e.target.value;
                        const nuevaCant = v === '' ? 1 : Number(v) || 1;
                        // v1.2.25: si hay precio_unitario explicito, recalculamos
                        // base = precio * cantidad. Si no, mantenemos la logica
                        // antigua (proporcional sobre la base existente).
                        const precio = Number(l.precio_unitario) || 0;
                        let baseNuevo;
                        if (precio !== 0) {
                          baseNuevo = Math.round(precio * nuevaCant * 100) / 100;
                        } else {
                          const oldCant = Number(l.cantidad) || 1;
                          baseNuevo = oldCant !== 0
                            ? Math.round(Number(l.base_imponible || 0) * (nuevaCant / oldCant) * 100) / 100
                            : Number(l.base_imponible) || 0;
                        }
                        setLinea(i, { cantidad: nuevaCant, base_imponible: baseNuevo });
                      }}
                    />
                  </div>
                  <div className="w-24 shrink-0">
                    <input
                      type="number" onFocus={(e) => e.target.select()}
                      step="0.01"
                      {...(esAbono ? {} : { min: '0' })}
                      className={inputCls + ' text-right'}
                      placeholder="Precio ud."
                      title={esAbono ? "Precio unidad (permite negativos en abonos)" : "Precio por unidad (sin IVA)"}
                      value={Number(l.precio_unitario) || 0}
                      onChange={(e) => {
                        const v = e.target.value;
                        const nuevoPrecio = v === '' ? 0 : Number(v) || 0;
                        const cant = Number(l.cantidad) || 1;
                        const baseNuevo = Math.round(nuevoPrecio * cant * 100) / 100;
                        setLinea(i, { precio_unitario: nuevoPrecio, base_imponible: baseNuevo });
                      }}
                    />
                  </div>
                  <div className="w-24 shrink-0">
                    <input
                      type="number" onFocus={(e) => e.target.select()}
                      step="0.01"
                      className={inputCls + ' text-right'}
                      placeholder="Base"
                      title="Base imponible (sin IVA) = cantidad × precio ud."
                      value={l.base_imponible}
                      onChange={(e) => {
                        const baseNueva = e.target.value === '' ? 0 : Number(e.target.value);
                        // Si el usuario edita la base directamente, recalculamos
                        // precio_unitario = base / cantidad (mantener cuadre).
                        const cant = Number(l.cantidad) || 1;
                        const precioCalc = cant !== 0
                          ? Math.round((baseNueva / cant) * 100) / 100
                          : 0;
                        setLinea(i, { base_imponible: baseNueva, precio_unitario: precioCalc });
                      }}
                    />
                  </div>
                  <div className="w-20 shrink-0">
                    <input
                      type="number" onFocus={(e) => e.target.select()}
                      step="0.01"
                      className={inputCls + ' text-right'}
                      placeholder="IVA %"
                      title="IVA de esta línea (0 si import/export)"
                      value={l.iva_pct}
                      onChange={(e) =>
                        setLinea(i, {
                          iva_pct: e.target.value === '' ? 0 : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="w-24 shrink-0">
                    <div className="flex">
                      <input
                        type="number" onFocus={(e) => e.target.select()}
                        step="0.01"
                        min="0"
                        className={inputCls + ' text-right rounded-r-none'}
                        placeholder="Dto."
                        title="Descuento de esta línea"
                        value={Number(l.descuento_valor) || 0}
                        onChange={(e) =>
                          setLinea(i, {
                            descuento_valor: e.target.value === '' ? 0 : Number(e.target.value),
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setLinea(i, {
                            descuento_tipo: l.descuento_tipo === 'eur' ? 'pct' : 'eur',
                          })
                        }
                        className="px-2 border border-l-0 border-slate-300 rounded-r-lg bg-slate-50 text-slate-600 text-sm hover:bg-slate-100"
                        title="Alterna % / €"
                      >
                        {l.descuento_tipo === 'eur' ? '€' : '%'}
                      </button>
                    </div>
                  </div>
                  <div className="w-20 shrink-0">
                    <select
                      className={
                        inputCls +
                        ' text-center px-1 ' +
                        (Number(l.diana_pct) > 0 ? 'bg-fuchsia-50 font-semibold text-fuchsia-700' : '') +
                        (Number(l.diana_pct) < 0 ? 'bg-amber-50 font-semibold text-amber-700' : '')
                      }
                      value={Number(l.diana_pct) || 0}
                      onChange={(e) => setLinea(i, { diana_pct: Number(e.target.value) || 0 })}
                      title="D = yo pago, Diana me debe (resta saldo) · E = Diana paga, yo le debo (suma saldo). Interno, no fiscal."
                    >
                      <option value={0}>—</option>
                      <option value={50}>D 50%</option>
                      <option value={100}>D 100%</option>
                      <option value={-50}>E 50%</option>
                      <option value={-100}>E 100%</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLinea(i)}
                    disabled={lineas.length <= 1}
                    className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors disabled:opacity-30"
                    title="Eliminar línea"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <input
                  type="text"
                  className={inputCls + ' text-xs py-1'}
                  placeholder="Nota interna para Cuenta Diana (opcional, no aparece en informes fiscales)"
                  value={l.notas || ''}
                  onChange={(e) => setLinea(i, { notas: e.target.value })}
                />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLinea}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-sm text-brand hover:text-white hover:bg-brand border-2 border-dashed border-brand/40 hover:border-brand rounded-lg py-2 transition-colors"
            >
              <Plus size={16} /> Añadir línea
            </button>

            {/* Descuento al total del gasto. */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-600">Descuento al total</span>
              <div className="flex w-40">
                <input
                  type="number" onFocus={(e) => e.target.select()}
                  step="0.01"
                  min="0"
                  className={inputCls + ' text-right rounded-r-none'}
                  value={Number(form.descuento_valor) || 0}
                  onChange={(e) =>
                    setField('descuento_valor', e.target.value === '' ? 0 : Number(e.target.value))
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setField('descuento_tipo', form.descuento_tipo === 'eur' ? 'pct' : 'eur')
                  }
                  className="px-3 border border-l-0 border-slate-300 rounded-r-lg bg-slate-50 text-slate-700 text-sm hover:bg-slate-100"
                  title="Alterna % / €"
                >
                  {form.descuento_tipo === 'eur' ? '€' : '%'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 items-end">
            <div>
              <label
                className={labelCls}
                title="Si el proveedor practica retención IRPF (típico de profesionales), se descuenta del total a pagar"
              >
                IRPF (%)
              </label>
              <input
                type="number" onFocus={(e) => e.target.select()}
                step="0.01"
                className={inputCls + ' text-right'}
                value={form.irpf_pct}
                onChange={(e) =>
                  setField('irpf_pct', e.target.value === '' ? 0 : Number(e.target.value))
                }
                placeholder="0"
              />
            </div>
            <div className="col-span-3 text-right text-sm text-slate-600 space-y-0.5">
              <div>
                Base {totales.base.toFixed(2)} € · IVA {totales.iva.toFixed(2)} €
                {Number(form.irpf_pct) > 0 ? ` · IRPF −${totales.irpf.toFixed(2)} €` : ''}
              </div>
              {/* Si hay varios tipos de IVA (p.ej. lineas a 21% y a 0%), mostrar
                  el desglose por tipo para que se entienda de donde sale el IVA. */}
              {totales.ivaBreakdown.length > 1 && (
                <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                  {totales.ivaBreakdown.map((b, i) => (
                    <div key={i}>
                      IVA {b.pct}% sobre {b.base.toFixed(2)} € = {b.importe.toFixed(2)} €
                    </div>
                  ))}
                </div>
              )}
              <div className="text-base font-semibold text-slate-800">
                Total a pagar: {totales.total.toFixed(2)} €
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 rounded text-brand focus:ring-brand"
              checked={!!form.deducible}
              onChange={(e) => setField('deducible', e.target.checked ? 1 : 0)}
            />
            <span className="text-sm text-slate-700">
              Deducible
              <span className="block text-xs text-slate-500">
                Si está marcado, suma al total de gastos del modelo 130 y al
                IVA soportado del modelo 303.
              </span>
            </span>
          </label>

          <div>
            <label className={labelCls}>Notas</label>
            <textarea
              rows={2}
              className={inputCls}
              value={form.notas}
              placeholder="Detalles internos (no aparecen en ningún PDF)"
              onChange={(e) => setField('notas', e.target.value)}
            />
          </div>

          {/* Pagos realizados: solo al editar (necesita gasto.id existente). */}
          {editing && gasto?.id ? (
            <PagosGastoSection gastoId={gasto.id} totalGasto={totales.total} />
          ) : (
            <PagosGastoSection
              gastoId={null}
              totalGasto={totales.total}
              localPagos={pagosInline}
              setLocalPagos={setPagosInline}
            />
          )}

          {/* v1.2.31: vencimientos fraccionados. Independientes de pagos
              (lista de fechas + importes a pagar). Modo dual: remoto vs local. */}
          {editing && gasto?.id ? (
            <VencimientosGastoSection gastoId={gasto.id} totalGasto={totales.total} />
          ) : (
            <VencimientosGastoSection
              gastoId={null}
              totalGasto={totales.total}
              localVencs={vencsInline}
              setLocalVencs={setVencsInline}
            />
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm disabled:opacity-60"
          >
            {saving
              ? 'Guardando…'
              : editing
                ? 'Guardar cambios'
                : esAbono ? 'Crear abono' : 'Crear gasto'}
          </button>
        </div>

        {showProveedorModal && (
          <ProveedorFormModal
            proveedor={nuevoProveedorSeed ? { nombre: nuevoProveedorSeed } : null}
            onSaved={onProveedorCreado}
            onCancel={() => setShowProveedorModal(false)}
          />
        )}
      </div>
    </div>
  );
}

export default GastoEditorModal;
