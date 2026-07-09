// Gestion de marcas (Ajustes). Una marca = nombre comercial + logo + color
// + prefijo de codigo, bajo el MISMO NIF/contabilidad de la empresa activa.
// Se elige por documento; el informe agrupa ingresos/gastos por marca.
//
// Al guardar/crear/eliminar se emite el evento 'marcas-changed' para que los
// selectores (Productos, editores, Gastos) se refresquen.

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { useToast } from './Toast.jsx';

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand text-sm';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

function emitChanged() {
  window.dispatchEvent(new CustomEvent('marcas-changed'));
}

function MarcaRow({ marca, onChanged }) {
  const toast = useToast();
  const [nombre, setNombre] = useState(marca.nombre_comercial || '');
  const [prefijo, setPrefijo] = useState(marca.prefijo || '');
  const [color, setColor] = useState(marca.brand_color || '#1abc9c');
  const [incluir, setIncluir] = useState(
    marca.incluir_en_informe === 0 || marca.incluir_en_informe === false ? false : true,
  );
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function guardar() {
    setBusy(true);
    try {
      const res = await window.api.marcas.update(marca.id, {
        nombre_comercial: nombre,
        prefijo,
        brand_color: color,
        incluir_en_informe: incluir ? 1 : 0,
      });
      if (res?.error) { toast.error(res.error); return; }
      toast.success('Marca guardada');
      emitChanged();
      onChanged?.();
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar la marca "${marca.nombre_comercial}"? Las facturas y productos antiguos la conservan.`)) return;
    try {
      await window.api.marcas.delete(marca.id);
      toast.success('Marca eliminada');
      emitChanged();
      onChanged?.();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function subirLogo(file) {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      toast.error('Usa PNG o JPG.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Máximo 4 MB.');
      return;
    }
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const ext = file.name.split('.').pop().toLowerCase();
      const res = await window.api.marcas.setLogo(marca.id, buf, ext);
      if (res?.error) { toast.error(res.error); return; }
      toast.success('Logo de marca actualizado');
      emitChanged();
      onChanged?.();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function quitarLogo() {
    try {
      await window.api.marcas.removeLogo(marca.id);
      toast.success('Logo quitado');
      emitChanged();
      onChanged?.();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-4">
      <div className="flex flex-col items-center gap-2">
        <div className="w-20 h-20 border border-slate-300 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">
          {marca.logo_data_url ? (
            <img
              src={marca.logo_data_url}
              alt={marca.nombre_comercial}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <ImageIcon size={22} className="text-slate-300" />
          )}
        </div>
        <label className="text-xs text-brand hover:text-brand-dark cursor-pointer">
          {marca.logo_data_url ? 'Cambiar' : 'Subir logo'}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              subirLogo(f);
            }}
          />
        </label>
        {marca.logo_data_url && (
          <button
            onClick={quitarLogo}
            className="text-xs text-red-600 hover:text-red-700"
          >
            Quitar
          </button>
        )}
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Nombre comercial</label>
          <input
            className={inputCls}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Pinturas Mediterráneo"
          />
        </div>
        <div>
          <label className={labelCls}>Prefijo de código (1-2 letras)</label>
          <input
            className={inputCls + ' font-mono uppercase'}
            value={prefijo}
            maxLength={2}
            onChange={(e) => setPrefijo(e.target.value.toUpperCase())}
            placeholder="MO"
          />
        </div>
        <div>
          <label className={labelCls}>Color</label>
          <input
            type="color"
            className="w-full h-[38px] border border-slate-300 rounded-lg cursor-pointer"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-brand focus:ring-brand"
              checked={incluir}
              onChange={(e) => setIncluir(e.target.checked)}
            />
            <span className="text-sm text-slate-700">
              Incluir esta marca en el informe "Ingresos y gastos por marca"
            </span>
          </label>
          <p className="text-xs text-slate-500 mt-1">
            Si la desactivas, la marca sigue existiendo (puedes seguir
            asignándola a facturas y gastos) pero no aparece en el resumen.
          </p>
        </div>
        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <button
            onClick={eliminar}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm"
          >
            <Trash2 size={14} /> Eliminar
          </button>
          <button
            onClick={guardar}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarcasManager() {
  const toast = useToast();
  const [marcas, setMarcas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [creando, setCreando] = useState(false);

  async function cargar() {
    // Defensivo: pase lo que pase, el spinner se apaga y la sección se ve
    // (antes un early-return dejaba `loading` en true para siempre y un
    // throw sin catch la dejaba en un estado raro → parecía "no hay marcas").
    setLoading(true);
    setLoadError(null);
    try {
      if (!window.api?.marcas) {
        setLoadError('No se pudo acceder al gestor de marcas. Reinicia la app.');
        setMarcas([]);
        return;
      }
      const l = await window.api.marcas.list();
      setMarcas(Array.isArray(l) ? l : []);
    } catch (e) {
      setLoadError(e?.message ?? String(e));
      setMarcas([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    const onEmpresa = () => cargar();
    window.addEventListener('empresa-changed', onEmpresa);
    return () => window.removeEventListener('empresa-changed', onEmpresa);
  }, []);

  async function crear() {
    if (!nuevoNombre.trim()) {
      toast.error('Pon un nombre para la marca.');
      return;
    }
    setCreando(true);
    try {
      const res = await window.api.marcas.create({ nombre_comercial: nuevoNombre.trim() });
      if (res?.error) { toast.error(res.error); return; }
      setNuevoNombre('');
      toast.success('Marca creada');
      emitChanged();
      cargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setCreando(false);
    }
  }

  return (
    <section id="marcas">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Marcas</h2>
      {loadError && (
        <div className="mb-4 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          {loadError}
        </div>
      )}
      <p className="text-sm text-slate-500 mb-5">
        Varios nombres comerciales (cada uno con su logo y color) bajo el mismo
        NIF y contabilidad. Al crear una factura o presupuesto eliges la marca:
        el PDF muestra su nombre y logo, y el nombre fiscal sigue constando por
        ley. Los ingresos y gastos por marca se ven en{' '}
        <strong>Marcas</strong> (menú lateral).
      </p>

      <div className="flex gap-2 mb-5">
        <input
          className={inputCls + ' flex-1'}
          value={nuevoNombre}
          placeholder="Nombre de la nueva marca"
          onChange={(e) => setNuevoNombre(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') crear(); }}
        />
        <button
          onClick={crear}
          disabled={creando}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm disabled:opacity-50"
        >
          <Plus size={16} /> Añadir marca
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : marcas.length === 0 ? (
        <p className="text-sm text-slate-400">
          Aún no tienes marcas. Crea la primera arriba.
        </p>
      ) : (
        <div className="space-y-3">
          {marcas.map((m) => (
            <MarcaRow key={m.id} marca={m} onChanged={cargar} />
          ))}
        </div>
      )}
    </section>
  );
}

export default MarcasManager;
