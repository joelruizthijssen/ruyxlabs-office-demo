// Pagina /productos (CRUD del catalogo, v1.15).
//
// Solo aparece en la sidebar si la empresa activa tiene
// tipo_negocio = 'productos' | 'mixto'. Para 'servicios' la entrada queda
// oculta en el menu (ver Sidebar.jsx) — pero la ruta sigue funcionando
// por si el usuario llega desde un enlace directo.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Pencil, Archive, ArchiveRestore, Search } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import { formatEUR } from '../utils/format.js';

const emptyForm = {
  codigo: '',
  nombre: '',
  descripcion: '',
  precio_compra: 0,
  precio_venta: 0,
  tarifa_1: 0,
  tarifa_2: 0,
  tarifa_3: 0,
  tarifa_4: 0,
  precio_compra_1: 0,
  precio_compra_2: 0,
  precio_compra_3: 0,
  precio_compra_4: 0,
  iva_pct: '',
  unidad: 'ud',
  marca_id: null,
  proveedor: '',
  // v1.5.0: traducciones EN (opcionales). Usadas en PDF cuando idioma='en'.
  nombre_en: '',
  descripcion_en: '',
};

// v1.2.24: nombres de las 4 tarifas. Pedidos por la madre. Si en el futuro
// los queremos configurables por empresa, mover a tabla aparte o a settings.
const TARIFAS = [
  { key: 'tarifa_1', label: 'T1 Nacional Tienda' },
  { key: 'tarifa_2', label: 'T2 Nacional Cliente final' },
  { key: 'tarifa_3', label: 'T3 Export Tienda' },
  { key: 'tarifa_4', label: 'T4 Export Cliente final' },
];

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand text-sm';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

function Productos() {
  const toast = useToast();
  const nav = useNavigate();
  const [productos, setProductos] = useState([]);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(null); // { id?, ...form }
  const [marcas, setMarcas] = useState([]);
  const [loading, setLoading] = useState(true);
  // v1.2.48: nombres de las 4 tarifas de compra (viven en settings de empresa).
  const [tarifaCompraLabels, setTarifaCompraLabels] = useState([null, null, null, null]);
  useEffect(() => {
    if (!window.api?.settings) return;
    const load = () => window.api.settings.get().then((s) => {
      if (!s || s.error) return;
      setTarifaCompraLabels([
        s.tarifa_compra_1_label,
        s.tarifa_compra_2_label,
        s.tarifa_compra_3_label,
        s.tarifa_compra_4_label,
      ]);
    }).catch(() => {});
    load();
    window.addEventListener('empresa-changed', load);
    return () => window.removeEventListener('empresa-changed', load);
  }, []);

  useEffect(() => {
    if (!window.api?.marcas) return;
    const load = () =>
      window.api.marcas.list().then((l) => setMarcas(Array.isArray(l) ? l : []));
    load();
    window.addEventListener('empresa-changed', load);
    window.addEventListener('marcas-changed', load);
    return () => {
      window.removeEventListener('empresa-changed', load);
      window.removeEventListener('marcas-changed', load);
    };
  }, []);

  async function recargar() {
    if (!window.api) return;
    setLoading(true);
    try {
      const list = await window.api.productos.list({ includeArchived: showArchived });
      setProductos(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { recargar(); }, [showArchived]);

  useEffect(() => {
    const onChanged = () => recargar();
    window.addEventListener('empresa-changed', onChanged);
    return () => window.removeEventListener('empresa-changed', onChanged);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => {
      const hay = [p.codigo, p.nombre, p.descripcion].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [productos, query]);

  function abrirNuevo() {
    setEditing({ ...emptyForm });
  }
  function abrirEditar(p) {
    setEditing({
      id: p.id,
      codigo: p.codigo || '',
      nombre: p.nombre || '',
      descripcion: p.descripcion || '',
      precio_compra: p.precio_compra || 0,
      precio_venta: (p.precio_venta ?? p.precio_unitario) || 0,
      tarifa_1: p.tarifa_1 || 0,
      tarifa_2: p.tarifa_2 || 0,
      tarifa_3: p.tarifa_3 || 0,
      tarifa_4: p.tarifa_4 || 0,
      precio_compra_1: p.precio_compra_1 || 0,
      precio_compra_2: p.precio_compra_2 || 0,
      precio_compra_3: p.precio_compra_3 || 0,
      precio_compra_4: p.precio_compra_4 || 0,
      iva_pct: p.iva_pct == null ? '' : p.iva_pct,
      unidad: p.unidad || 'ud',
      marca_id: p.marca_id || null,
      proveedor: p.proveedor || '',
      nombre_en: p.nombre_en || '',
      descripcion_en: p.descripcion_en || '',
    });
  }
  function cerrar() { setEditing(null); }

  async function guardar() {
    if (!editing) return;
    if (!editing.nombre.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }
    try {
      const payload = {
        codigo: editing.codigo,
        nombre: editing.nombre,
        descripcion: editing.descripcion,
        precio_compra: Number(editing.precio_compra) || 0,
        precio_venta: Number(editing.precio_venta) || 0,
        tarifa_1: Number(editing.tarifa_1) || 0,
        tarifa_2: Number(editing.tarifa_2) || 0,
        tarifa_3: Number(editing.tarifa_3) || 0,
        tarifa_4: Number(editing.tarifa_4) || 0,
        precio_compra_1: Number(editing.precio_compra_1) || 0,
        precio_compra_2: Number(editing.precio_compra_2) || 0,
        precio_compra_3: Number(editing.precio_compra_3) || 0,
        precio_compra_4: Number(editing.precio_compra_4) || 0,
        iva_pct: editing.iva_pct === '' ? null : Number(editing.iva_pct),
        unidad: editing.unidad || 'ud',
        marca_id: editing.marca_id || null,
        proveedor: editing.proveedor || '',
        nombre_en: (editing.nombre_en || '').trim() || null,
        descripcion_en: (editing.descripcion_en || '').trim() || null,
      };
      const res = editing.id
        ? await window.api.productos.update(editing.id, payload)
        : await window.api.productos.create(payload);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editing.id ? 'Producto actualizado' : 'Producto creado');
      cerrar();
      recargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function archivar(p) {
    try {
      await window.api.productos.archive(p.id, !p.archivado);
      toast.success(p.archivado ? 'Producto recuperado' : 'Producto archivado');
      recargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800 flex items-center gap-2">
            <Package size={26} className="text-brand" />
            Productos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Catálogo de productos y servicios. Al añadir una línea en un
            presupuesto o factura podrás buscarlos por nombre o código.
          </p>
        </div>
        <button
          onClick={abrirNuevo}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm shrink-0"
        >
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={inputCls + ' pl-9'}
            placeholder="Buscar por nombre o código…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="w-4 h-4 rounded text-brand focus:ring-brand"
          />
          Mostrar archivados
        </label>
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-10 text-center">
          <Package size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-700 font-medium mb-1">
            {productos.length === 0
              ? 'Aún no tienes productos en el catálogo'
              : 'Sin resultados para tu búsqueda'}
          </p>
          {productos.length === 0 && (
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Añade los productos o servicios que vendes habitualmente.
              Después podrás insertarlos en facturas con un clic.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left text-xs">
              <tr>
                <th className="px-4 py-3 font-medium w-24">Código</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium w-24">Unidad</th>
                <th className="px-4 py-3 font-medium text-right w-36">Venta / compra</th>
                <th className="px-4 py-3 font-medium w-20">IVA</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => nav(`/productos/${p.id}`)}
                  className={'border-t border-slate-100 cursor-pointer hover:bg-slate-50 ' + (p.archivado ? 'opacity-50' : '')}
                  title="Ver ficha y movimientos"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {p.codigo || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-800 font-medium">{p.nombre}</div>
                    {p.descripcion && (
                      <div className="text-xs text-slate-500 truncate max-w-md">
                        {p.descripcion}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.unidad}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                    <div>{formatEUR((p.precio_venta ?? p.precio_unitario) || 0)}</div>
                    {(p.precio_compra || 0) > 0 && (
                      <div className="text-xs text-slate-400">
                        compra {formatEUR(p.precio_compra)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.iva_pct == null ? '—' : `${p.iva_pct}%`}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => abrirEditar(p)}
                        className="px-2 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs inline-flex items-center gap-1.5"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                      <button
                        onClick={() => archivar(p)}
                        className="px-2 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs inline-flex items-center gap-1.5"
                        title={p.archivado ? 'Recuperar producto' : 'Archivar producto (no aparecerá en autocompletes)'}
                      >
                        {p.archivado ? <ArchiveRestore size={12} /> : <Archive size={12} />}
                        {p.archivado ? 'Recuperar' : 'Archivar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 shrink-0">
              <h2 className="text-lg font-semibold text-slate-800">
                {editing.id ? 'Editar producto' : 'Nuevo producto'}
              </h2>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Código</label>
                  <input
                    className={inputCls + ' font-mono'}
                    placeholder="#455"
                    value={editing.codigo}
                    onChange={(e) => setEditing({ ...editing, codigo: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Nombre *</label>
                  <input
                    className={inputCls}
                    autoFocus
                    placeholder="Pantalón vaquero clásico"
                    value={editing.nombre}
                    onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Descripción</label>
                <textarea
                  className={inputCls}
                  rows={2}
                  placeholder="Detalle opcional (talla, color, características…)"
                  value={editing.descripcion}
                  onChange={(e) => setEditing({ ...editing, descripcion: e.target.value })}
                />
              </div>
              {/* v1.5.0: traducciones al ingles. Se usan en el PDF cuando el
                  documento (o el cliente) tiene idioma_documento='en'. */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nombre (Inglés)</label>
                  <input
                    className={inputCls}
                    placeholder="English name (opcional)"
                    value={editing.nombre_en || ''}
                    onChange={(e) => setEditing({ ...editing, nombre_en: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Descripción (Inglés)</label>
                  <input
                    className={inputCls}
                    placeholder="English description (opcional)"
                    value={editing.descripcion_en || ''}
                    onChange={(e) => setEditing({ ...editing, descripcion_en: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Marca</label>
                  <select
                    className={inputCls + ' bg-white'}
                    value={editing.marca_id || ''}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null;
                      const mc = marcas.find((m) => m.id === id);
                      setEditing((ed) => ({
                        ...ed,
                        marca_id: id,
                        // Si el codigo esta vacio y la marca tiene prefijo,
                        // lo prerellenamos (el metodo de "letras delante").
                        codigo:
                          ed.codigo && ed.codigo.trim()
                            ? ed.codigo
                            : (mc?.prefijo || ''),
                      }));
                    }}
                  >
                    <option value="">— Sin marca —</option>
                    {marcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre_comercial}
                        {m.prefijo ? ` (${m.prefijo})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Proveedor</label>
                  <input
                    className={inputCls}
                    placeholder="Quién te lo suministra"
                    value={editing.proveedor}
                    onChange={(e) => setEditing({ ...editing, proveedor: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Precio de compra (sin IVA)</label>
                  <input
                    type="number" onFocus={(e) => e.target.select()}
                    step="0.01"
                    className={inputCls + ' tabular-nums'}
                    placeholder="Lo que te cuesta"
                    value={editing.precio_compra}
                    onChange={(e) => setEditing({ ...editing, precio_compra: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Precio de venta (sin IVA)</label>
                  <input
                    type="number" onFocus={(e) => e.target.select()}
                    step="0.01"
                    className={inputCls + ' tabular-nums'}
                    placeholder="Tarifa por defecto"
                    value={editing.precio_venta}
                    onChange={(e) => setEditing({ ...editing, precio_venta: e.target.value })}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Se usa cuando el cliente no tiene tarifa asignada.
                  </p>
                </div>
              </div>
              {/* v1.2.24: 4 tarifas opcionales para productos. */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                <label className={labelCls}>Tarifas por tipo de cliente (sin IVA, opcionales)</label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Se asignan en la ficha del cliente. Si el cliente tiene una tarifa
                  marcada, al facturar se aplica el precio de esa tarifa en vez del
                  precio de venta por defecto.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {TARIFAS.map((t) => (
                    <div key={t.key}>
                      <label className="block text-[11px] text-slate-600 mb-0.5">{t.label}</label>
                      <input
                        type="number"
                        onFocus={(e) => e.target.select()}
                        step="0.01"
                        min="0"
                        className={inputCls + ' tabular-nums py-1.5'}
                        placeholder="0,00"
                        value={editing[t.key]}
                        onChange={(e) => setEditing({ ...editing, [t.key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-span-2 rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                <label className={labelCls}>Precios de compra por tarifa de proveedor (sin IVA, opcionales)</label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Se asignan en la ficha del proveedor. Al hacer un pedido a un
                  proveedor con tarifa marcada (ej. Nacional vs EU), se usa el
                  precio de compra de esa tarifa. Si vacío, usa el "Precio de compra" de arriba.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={`pc${n}`}>
                      <label className="block text-[11px] text-slate-600 mb-0.5">
                        Precio compra T{n}
                        {tarifaCompraLabels[n - 1] ? ` — ${tarifaCompraLabels[n - 1]}` : ''}
                      </label>
                      <input
                        type="number"
                        onFocus={(e) => e.target.select()}
                        step="0.01"
                        min="0"
                        className={inputCls + ' tabular-nums py-1.5'}
                        placeholder="0,00"
                        value={editing[`precio_compra_${n}`]}
                        onChange={(e) => setEditing({ ...editing, [`precio_compra_${n}`]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>IVA % (opcional)</label>
                  <input
                    type="number" onFocus={(e) => e.target.select()}
                    step="0.01"
                    className={inputCls + ' tabular-nums'}
                    placeholder="por defecto"
                    value={editing.iva_pct}
                    onChange={(e) => setEditing({ ...editing, iva_pct: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Unidad</label>
                  <input
                    className={inputCls}
                    placeholder="ud, hora, kg, m²…"
                    value={editing.unidad}
                    onChange={(e) => setEditing({ ...editing, unidad: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 -mt-1">
                Ambos precios van <strong>sin IVA</strong>. El IVA se decide en
                cada operación (línea de factura o gasto): las importaciones y
                exportaciones van sin IVA y solo el comercio nacional lo lleva.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={cerrar}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm"
              >
                {editing.id ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Productos;
