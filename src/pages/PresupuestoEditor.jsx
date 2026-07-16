import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowDown, ArrowUp, ArrowRight, Download, Lock, Maximize2, Plus, Repeat, Trash2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import PresupuestoPDF from '../pdf/PresupuestoPDF.jsx';
import PDFCanvasPreview from '../components/PDFCanvasPreview.jsx';
import LineaSubitems from '../components/LineaSubitems.jsx';
import ClienteCombobox from '../components/ClienteCombobox.jsx';
import IvaPicker from '../components/IvaPicker.jsx';
import AdjuntosSection from '../components/AdjuntosSection.jsx';
import PlanPagosSection from '../components/PlanPagosSection.jsx';
import RecurrenciaModal from '../components/RecurrenciaModal.jsx';
import PDFPreviewModal from '../components/PDFPreviewModal.jsx';
import ConvertirFacturaModal from '../components/ConvertirFacturaModal.jsx';
import ProductoAutocomplete from '../components/ProductoAutocomplete.jsx';
import { calcTotales, formatEUR } from '../utils/format.js';
import { useToast } from '../components/Toast.jsx';

const ESTADOS = ['borrador', 'enviado', 'aceptado', 'rechazado', 'convertido'];

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand text-sm disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

// Hook: ejecuta `cb` con `value` despues de `delay` ms; cancela si value cambia.
function useDebouncedEffect(value, delay, cb) {
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  });
  useEffect(() => {
    const t = setTimeout(() => cbRef.current(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
}

function PresupuestoEditor() {
  const { id } = useParams();
  const presupuestoId = Number(id);
  const nav = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [cab, setCab] = useState({
    numero: '',
    fecha: '',
    ciudad_emision: '',
    cliente_id: null,
    asunto: '',
    iva_porcentaje: 21,
    iva_incluido: 1,
    estado: 'borrador',
    notas: '',
    factura_id: null,
    modo_detallado: 0,
    marca_id: null,
    descuento_tipo: 'pct',
    descuento_valor: 0,
    // v1.5.0: idioma del PDF y titulo custom (paridad con FacturaEditor).
    titulo_documento_override: '',
    idioma_documento: null,
  });
  const [cabOriginal, setCabOriginal] = useState(cab);
  const [marcas, setMarcas] = useState([]);

  useEffect(() => {
    if (!window.api?.marcas) return;
    window.api.marcas.list().then((l) => setMarcas(Array.isArray(l) ? l : []));
  }, []);

  const [lineas, setLineas] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [settings, setSettings] = useState(null);
  const [clientesDisp, setClientesDisp] = useState([]);
  const [hitos, setHitos] = useState([]);

  // Bloqueo: si el presupuesto esta 'convertido' (factura ya emitida),
  // todos los campos son read-only para no desincronizar con la factura.
  const bloqueado = cab.estado === 'convertido';

  // --- carga inicial ---
  // Ref con el id que ya hemos cargado, para evitar que el useEffect dispare
  // cargar() multiples veces para el mismo presupuesto. Si presupuestoId
  // cambia (navegando a otro presupuesto), volvemos a cargar.
  const loadedIdRef = useRef(null);

  async function cargar() {
    if (!window.api) {
      setError('Esta aplicación debe ejecutarse desde Electron.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [p, sets, cls] = await Promise.all([
        window.api.presupuestos.get(presupuestoId),
        window.api.settings.get(),
        window.api.clientes.list(),
      ]);
      if (p && p.error) {
        setError(p.error);
        return;
      }
      if (!p) {
        setError('Presupuesto no encontrado');
        return;
      }
      const newCab = {
        numero: p.numero ?? '',
        fecha: p.fecha ?? '',
        ciudad_emision: p.ciudad_emision ?? '',
        cliente_id: p.cliente_id ?? null,
        asunto: p.asunto ?? '',
        iva_porcentaje: p.iva_porcentaje ?? 21,
        iva_incluido: p.iva_incluido === 0 ? 0 : 1,
        estado: p.estado ?? 'borrador',
        notas: p.notas ?? '',
        factura_id: p.factura_id ?? null,
        modo_detallado: p.modo_detallado ? 1 : 0,
        marca_id: p.marca_id ?? null,
        descuento_tipo: p.descuento_tipo === 'eur' ? 'eur' : 'pct',
        descuento_valor: Number(p.descuento_valor) || 0,
        titulo_documento_override: p.titulo_documento_override || '',
        idioma_documento: p.idioma_documento || null,
      };
      // Descuento por defecto del cliente (modo 'total'): autoaplica a la
      // cabecera. Modo 'linea' no toca lineas existentes; solo las nuevas
      // (ver addLinea) heredan el descuento.
      const clienteDescDefault = Number(p.cliente?.descuento_pct_default) || 0;
      const clienteDescAplicar = p.cliente?.descuento_aplicar === 'linea' ? 'linea' : 'total';
      if (
        newCab.estado === 'borrador' &&
        clienteDescDefault > 0 &&
        clienteDescAplicar === 'total' &&
        Number(newCab.descuento_valor) === 0
      ) {
        newCab.descuento_tipo = 'pct';
        newCab.descuento_valor = clienteDescDefault;
        toast.info?.(`Descuento ${clienteDescDefault}% aplicado al total desde el cliente`)
          || toast.success(`Descuento ${clienteDescDefault}% aplicado al total desde el cliente`);
      }
      setCab(newCab);
      setCabOriginal(newCab);
      setLineas(p.lineas || []);
      setCliente(p.cliente || null);
      setSettings(sets && !sets.error ? sets : null);
      setClientesDisp(Array.isArray(cls) ? cls : []);
      setHitos(Array.isArray(p.hitos) ? p.hitos : []);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Guard: solo cargar si este presupuesto NO ha sido cargado ya. Evita
    // re-ejecuciones del effect con el mismo id (StrictMode dev, etc.) que
    // crearian un bucle de cargar() -> setLineas -> render -> ... -> cargar().
    if (loadedIdRef.current === presupuestoId) return;
    loadedIdRef.current = presupuestoId;
    cargar();
  }, [presupuestoId]);

  // Forzar focus en el wrapper tras cargar. Sin esto, el render del canvas
  // de la vista previa PDF (pdfjs) deja el documento sin focus efectivo y
  // los primeros keystrokes / dropdowns no responden hasta hacer click en
  // cualquier elemento (ej. el boton de cambiar de pagina del preview).
  // Hacemos varios intentos porque pdfjs puede acabar de renderizar
  // despues del primer focus y volver a robar el contexto.
  const rootRef = useRef(null);
  useEffect(() => {
    if (loading) return;
    if (document.body.style.overflow === 'hidden') {
      document.body.style.overflow = '';
    }
    function attempt() {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT')) {
        return;
      }
      rootRef.current?.focus({ preventScroll: true });
    }
    const t1 = setTimeout(attempt, 100);
    const t2 = setTimeout(attempt, 400);
    const t3 = setTimeout(attempt, 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [loading]);

  // --- autoguardado de cabecera (debounced) ---
  const cabDirty = useMemo(() => {
    return JSON.stringify(cab) !== JSON.stringify(cabOriginal);
  }, [cab, cabOriginal]);

  useDebouncedEffect(cab, 500, async (current) => {
    if (loading) return;
    if (JSON.stringify(current) === JSON.stringify(cabOriginal)) return;
    try {
      const res = await window.api.presupuestos.update(presupuestoId, current);
      if (res && res.error) {
        setError(res.error);
        return;
      }
      // Si cambia el estado (borrador → enviado → aceptado, etc.), notifica
      // al sidebar para que refresque el badge de notificaciones — la
      // categoría "presupuesto sin respuesta" depende del estado actual.
      if (current.estado !== cabOriginal.estado) {
        window.dispatchEvent(new CustomEvent('data-changed'));
      }
      setCabOriginal(current);
      // NO sincronizamos cab/cliente/lineas con la respuesta del servidor:
      //   - cab: machacaria lo que el usuario esta tecleando ahora.
      //   - cliente: ya se actualiza localmente al cambiar el dropdown.
      //   - lineas: tienen su propio flujo de auto-guardado por linea, y
      //     reescribirlas aqui clobbera ediciones en vuelo del usuario.
      // Los totales se re-calculan en cliente con calcTotales().
    } catch (e) {
      setError(e.message ?? String(e));
    }
  });

  function setCabField(k, v) {
    // Cuando esta convertido, solo permitimos modificar `estado` (por si el
    // usuario quiere desbloquear el presupuesto manualmente — el backend
    // tambien valida esto).
    if (bloqueado && k !== 'estado') return;
    setCab((c) => ({ ...c, [k]: v }));
  }

  // Toggle del modo detallado. Cuando se activa, recalculamos localmente el
  // importe de cada linea que tenga subitems para que la UI lo refleje al
  // momento (el backend hace lo mismo al guardar via debounce).
  function onToggleModoDetallado(checked) {
    if (bloqueado) return;
    setCab((c) => ({ ...c, modo_detallado: checked ? 1 : 0 }));
    if (checked) {
      setLineas((prev) =>
        prev.map((l) => {
          const subs = l.sublineas || [];
          if (subs.length === 0) return l;
          const importe =
            Math.round(
              subs.reduce((s, x) => s + (Number(x.importe) || 0), 0) * 100,
            ) / 100;
          return { ...l, importe };
        }),
      );
    }
  }

  // Actualiza la lista de sublineas de una linea concreta + recalcula su
  // importe localmente como suma. Lo llama LineaSubitems en cada cambio.
  function updateLineaSubs(lineaId, newSubs) {
    setLineas((prev) =>
      prev.map((l) => {
        if (l.id !== lineaId) return l;
        const importe =
          newSubs.length > 0
            ? Math.round(
                newSubs.reduce(
                  (s, x) => s + (Number(x.importe) || 0),
                  0,
                ) * 100,
              ) / 100
            : l.importe;
        return { ...l, sublineas: newSubs, importe };
      }),
    );
  }

  // --- conversion presupuesto -> factura ---
  // Serie a usar para la factura resultante. Default 'A'. Si el usuario tiene
  // mas de una serie de facturas en Ajustes, mostramos un selector junto al
  // boton de convertir.
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [serieFacturaTarget, setSerieFacturaTarget] = useState('A');
  const seriesFacturas = useMemo(
    () => (Array.isArray(settings?.series_facturas_list) && settings.series_facturas_list.length > 0
      ? settings.series_facturas_list
      : [{ id: 'A', label: 'General' }]),
    [settings],
  );

  const [showConvertirModal, setShowConvertirModal] = useState(false);

  function convertirAFactura() {
    if (!cab.cliente_id) {
      setError('Asigna un cliente al presupuesto antes de convertir.');
      setTimeout(() => setError(null), 4000);
      return;
    }
    setError(null);
    setShowConvertirModal(true);
  }

  async function ejecutarConversion({ serie, modo, resumen_texto }) {
    setError(null);
    setConvirtiendo(true);
    // Cerrar cualquier modal abierto antes de navegar.
    setShowConvertirModal(false);
    setShowPreviewModal(false);
    setShowRecurrencia(false);
    try {
      const res = await window.api.presupuestos.convertirAFactura(
        presupuestoId,
        { serie: serie || 'A', modo, resumen_texto },
      );
      if (res?.error) {
        if (res.error === 'Falta cliente') {
          setError('Asigna un cliente al presupuesto antes de convertir.');
        } else {
          setError(res.error);
        }
        return;
      }
      nav(`/facturas/${res.facturaId}`);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setConvirtiendo(false);
    }
  }

  // --- cambio de estado: persistencia INMEDIATA (sin debounce) ---
  async function onChangeEstadoPres(nuevoEstado) {
    // Optimistic UI primero.
    setCab((c) => ({ ...c, estado: nuevoEstado }));
    // Persistir directamente (no esperamos al debounce).
    try {
      const payload = { ...cab, estado: nuevoEstado };
      const res = await window.api.presupuestos.update(presupuestoId, payload);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setCabOriginal((o) => ({ ...o, estado: nuevoEstado }));
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }

  // --- lineas: edicion local + debounced save por linea ---
  const timersRef = useRef(new Map());
  // Ref a la version mas reciente de `lineas`, para que persistirLinea pueda
  // leer el valor actual sin depender de su closure (que captura la version
  // del render donde se programo el setTimeout, perdiendo el ultimo
  // caracter tecleado antes de los 500ms de inactividad).
  const lineasRef = useRef([]);
  // Sin deps a proposito: asignar a un ref no dispara re-render.
  useEffect(() => {
    lineasRef.current = lineas;
  });

  function patchLineaLocal(lineaId, patch) {
    if (bloqueado) return;
    setLineas((prev) => {
      // Bailout si NADA cambia: evita disparar cascada de renders cuando
      // React reescribe el value de un controlled input con el "mismo" valor
      // pero distinto tipo (number vs string).
      let mutated = false;
      const next = prev.map((l) => {
        if (l.id !== lineaId) return l;
        const merged = { ...l, ...patch };
        if (
          merged.titulo === l.titulo &&
          merged.descripcion === l.descripcion &&
          merged.cantidad === l.cantidad &&
          merged.precio_unitario === l.precio_unitario &&
          merged.importe === l.importe &&
          merged.iva_pct === l.iva_pct &&
          merged.codigo === l.codigo &&
          merged.descuento_tipo === l.descuento_tipo &&
          merged.descuento_valor === l.descuento_valor
        ) {
          return l;
        }
        mutated = true;
        return merged;
      });
      return mutated ? next : prev;
    });
    const prev = timersRef.current.get(lineaId);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => persistirLinea(lineaId), 500);
    timersRef.current.set(lineaId, t);
  }

  async function persistirLinea(lineaId) {
    const linea = lineasRef.current.find((l) => l.id === lineaId);
    if (!linea) return;
    try {
      const importeNum = Number(linea.importe) || 0;
      const res = await window.api.lineasPresupuesto.update(lineaId, {
        titulo: linea.titulo ?? null,
        descripcion: linea.descripcion ?? '',
        cantidad: 1,
        precio_unitario: importeNum,
        importe: importeNum,
        iva_pct: linea.iva_pct == null ? null : Number(linea.iva_pct),
        codigo: linea.codigo ?? null,
        descuento_tipo: linea.descuento_tipo === 'eur' ? 'eur' : 'pct',
        descuento_valor: Number(linea.descuento_valor) || 0,
      });
      if (res && res.error) setError(res.error);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }

  // Cleanup timers al desmontar.
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  async function addLinea() {
    if (bloqueado) return;
    setError(null);
    try {
      // Cliente con descuento en modo 'linea' -> la linea nueva hereda el %.
      const descClient = Number(cliente?.descuento_pct_default) || 0;
      const aplicar = cliente?.descuento_aplicar === 'linea' ? 'linea' : 'total';
      const lineaDescPatch = (descClient > 0 && aplicar === 'linea')
        ? { descuento_tipo: 'pct', descuento_valor: descClient }
        : {};
      const res = await window.api.lineasPresupuesto.create(presupuestoId, {
        titulo: '',
        descripcion: '',
        cantidad: 1,
        precio_unitario: 0,
        importe: 0,
        ...lineaDescPatch,
      });
      if (res && res.error) {
        setError(res.error);
        return;
      }
      setLineas((arr) => [...arr, res]);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }

  async function deleteLinea(lineaId) {
    if (bloqueado) return;
    setError(null);
    try {
      const res = await window.api.lineasPresupuesto.delete(lineaId);
      if (res && res.error) {
        setError(res.error);
        return;
      }
      setLineas((arr) => arr.filter((l) => l.id !== lineaId));
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }

  async function moverLinea(idx, dir) {
    if (bloqueado) return;
    const newArr = [...lineas];
    const target = idx + dir;
    if (target < 0 || target >= newArr.length) return;
    [newArr[idx], newArr[target]] = [newArr[target], newArr[idx]];
    setLineas(newArr);
    try {
      const res = await window.api.lineasPresupuesto.reorder(
        presupuestoId,
        newArr.map((l) => l.id),
      );
      if (res && res.error) setError(res.error);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }

  // --- cliente picker ---
  function onChangeCliente(value) {
    if (bloqueado) return;
    if (value == null) {
      setCabField('cliente_id', null);
      setCliente(null);
    } else {
      const cid = Number(value);
      const c = clientesDisp.find((x) => x.id === cid) || null;
      // Descuento por defecto del cliente: igual que en FacturaEditor.
      // Modo 'total' -> cabecera; modo 'linea' -> futuras lineas via addLinea.
      const descDefault = Number(c?.descuento_pct_default) || 0;
      const descAplicar = c?.descuento_aplicar === 'linea' ? 'linea' : 'total';
      setCab((prev) => {
        const next = { ...prev, cliente_id: cid || null };
        if (
          descDefault > 0 &&
          descAplicar === 'total' &&
          (!prev.descuento_valor || Number(prev.descuento_valor) === 0)
        ) {
          next.descuento_tipo = 'pct';
          next.descuento_valor = descDefault;
        }
        return next;
      });
      if (
        descDefault > 0 &&
        descAplicar === 'total' &&
        (!cab.descuento_valor || Number(cab.descuento_valor) === 0)
      ) {
        toast.info?.(`Descuento ${descDefault}% aplicado al total desde el cliente`)
          || toast.success(`Descuento ${descDefault}% aplicado al total desde el cliente`);
      }
      setCliente(c);
    }
  }

  // --- descargar PDF ---
  // Generamos el PDF en el momento de pulsar el boton. No hay vista previa
  // en vivo (un iframe con el blob del PDF capturaba el foco/teclado del
  // documento entero, dejando los inputs inutilizables).
  // --- Vista previa PDF (canvas, no iframe) ---
  // Usamos refs para los datos del PDF y dependencias primitivas en el
  // useCallback, asi `generarBlob` es estable y NO se recrea cada render.
  // Esto fue clave en el fix de bucles: si generarBlob estuviera en deps de
  // un useEffect y se recrease cada cambio, dispararia render -> recreate
  // -> effect -> setState -> render -> ... en cascada.
  const previewDataRef = useRef({ cab, lineas, cliente, settings, hitos });
  useEffect(() => {
    const marca = marcas.find((m) => m.id === cab.marca_id) || null;
    previewDataRef.current = { cab, lineas, cliente, settings, hitos, marca };
  }, [cab, lineas, cliente, settings, hitos, marcas]);

  const [pdfBlob, setPdfBlob] = useState(null);

  const generarBlob = useCallback(async () => {
    try {
      const { cab: c, lineas: ls, cliente: cl, settings: s, hitos: hs, marca: mk } =
        previewDataRef.current;
      const blob = await pdf(
        <PresupuestoPDF
          presupuesto={{ ...c, id: presupuestoId, hitos: hs, marca: mk }}
          lineas={ls}
          cliente={cl}
          settings={s}
        />,
      ).toBlob();
      setPdfBlob(blob);
    } catch (e) {
      console.error('Error generando PDF para preview:', e);
    }
  }, [presupuestoId]);

  // Auto-refresh debounced 1500ms tras cambios en datos.
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(generarBlob, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cab, lineas, cliente, settings, hitos, loading]);

  const [downloading, setDownloading] = useState(false);
  const [showRecurrencia, setShowRecurrencia] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [recurrencia, setRecurrencia] = useState(null);

  useEffect(() => {
    if (!presupuestoId || !window.api) return;
    let cancelled = false;
    window.api.recurrencias.forSource('presupuesto', presupuestoId).then((r) => {
      if (!cancelled) setRecurrencia(r && !r.error ? r : null);
    });
    return () => { cancelled = true; };
  }, [presupuestoId]);

  async function descargarPDF() {
    setError(null);
    setDownloading(true);
    try {
      const blob = await pdf(
        <PresupuestoPDF
          presupuesto={{ ...cab, id: presupuestoId, hitos, marca: marcas.find((m) => m.id === cab.marca_id) || null }}
          lineas={lineas}
          cliente={cliente}
          settings={settings}
        />,
      ).toBlob();
      const arrBuf = await blob.arrayBuffer();
      const u8 = new Uint8Array(arrBuf);
      const res = await window.api.pdf.savePresupuesto(presupuestoId, u8);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else if (res?.canceled) {
        /* no-op */
      } else if (res?.path) {
        toast.success('PDF guardado correctamente');
      }
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
      toast.error(e && e.message ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  }

  // --- totales en vivo (cliente) ---
  // calcTotales es O(nº líneas) — barato; sin memo para no pelear con el
  // compilador (igual lo memoiza solo si está activo). Espeja el PDF.
  const totales = calcTotales(lineas, cab.iva_porcentaje, 0, {
    incluyeIva: cab.iva_incluido !== 0,
    recargoEquivalencia: !!(cliente && cliente.recargo_equivalencia),
    descuentoGlobalTipo: cab.descuento_tipo,
    descuentoGlobalValor: cab.descuento_valor,
  });

  // --- render ---
  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 mb-2">Presupuesto</h1>
        <p className="text-slate-500">Cargando…</p>
      </div>
    );
  }

  if (error && !cab.numero) {
    return (
      <div>
        <button
          onClick={() => nav('/presupuestos')}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft size={18} /> Volver
        </button>
        <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} tabIndex={-1} className="-m-8 outline-none">
      <div className="px-8 pt-6 pb-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => nav('/presupuestos')}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft size={18} /> Volver
            </button>
            <div className="text-2xl font-semibold text-slate-800">
              PRESUPUESTO {cab.numero}
            </div>
            {cabDirty && (
              <span className="text-xs text-slate-400">guardando…</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={cab.estado}
              onChange={(e) => onChangeEstadoPres(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              {ESTADOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* Conversion a factura: si ya esta convertido, link; si esta
                aceptado, boton activo; en otros estados, oculto. */}
            {cab.estado === 'convertido' && cab.factura_id ? (
              <button
                onClick={() => nav(`/facturas/${cab.factura_id}`)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
              >
                Ver factura <ArrowRight size={16} />
              </button>
            ) : cab.estado === 'aceptado' ? (
              <>
                {seriesFacturas.length > 1 && (
                  <select
                    value={serieFacturaTarget}
                    onChange={(e) => setSerieFacturaTarget(e.target.value)}
                    className="px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    title="Serie de la factura resultante"
                    disabled={convirtiendo}
                  >
                    {seriesFacturas.map((s) => (
                      <option key={s.id} value={s.id}>
                        Serie {s.id} · {s.label || s.id}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={convertirAFactura}
                  disabled={convirtiendo}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-60"
                >
                  {convirtiendo ? 'Convirtiendo…' : 'Generar factura →'}
                </button>
              </>
            ) : null}

            <button
              onClick={() => setShowRecurrencia(true)}
              className={
                'inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ' +
                (recurrencia
                  ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50')
              }
              title={
                recurrencia
                  ? 'Este presupuesto se genera automaticamente cada periodo'
                  : 'Generar este presupuesto automaticamente cada mes/trimestre/etc.'
              }
            >
              <Repeat size={15} />
              {recurrencia ? 'Recurrente' : 'Hacer recurrente'}
            </button>
            <button
              onClick={descargarPDF}
              disabled={downloading}
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              <Download size={18} />
              {downloading ? 'Generando…' : 'Descargar PDF'}
            </button>
          </div>
        </div>

        {bloqueado && (
          <div className="mt-3 px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm flex items-center gap-2">
            <Lock size={16} />
            Este presupuesto está convertido a factura y queda bloqueado para edición. Si necesitas modificarlo, cámbialo manualmente al estado borrador (la factura asociada quedará desincronizada).
          </div>
        )}
        {error && (
          <div className="mt-3 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      <div
        className="flex flex-col lg:flex-row"
        style={{ height: 'calc(100vh - 92px)' }}
      >
        {/* Columna izquierda: formulario */}
        <div className="lg:flex-1 overflow-auto p-6 bg-slate-50">
        <div className="max-w-[700px] mx-auto space-y-6">
          {/* Datos */}
          <section className="bg-white rounded-lg shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
              Datos
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fecha</label>
                <input
                  type="date"
                  className={inputCls}
                  value={cab.fecha || ''}
                  disabled={bloqueado}
                  onChange={(e) => setCabField('fecha', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Ciudad de emisión</label>
                <input
                  className={inputCls}
                  value={cab.ciudad_emision || ''}
                  disabled={bloqueado}
                  onChange={(e) => setCabField('ciudad_emision', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Título del documento (opcional)</label>
                <input
                  className={inputCls}
                  value={cab.titulo_documento_override || ''}
                  disabled={bloqueado}
                  placeholder="p.ej. Oferta comercial, Cotización…"
                  onChange={(e) => setCabField('titulo_documento_override', e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Si lo dejas vacío se usa "PRESUPUESTO". Aparece en el PDF y listado.
                </p>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Idioma del PDF</label>
                <select
                  className={inputCls + ' bg-white'}
                  value={cab.idioma_documento || ''}
                  disabled={bloqueado}
                  onChange={(e) => setCabField('idioma_documento', e.target.value || null)}
                >
                  <option value="">Auto (según cliente o empresa)</option>
                  <option value="es">Español</option>
                  <option value="en">Inglés</option>
                </select>
              </div>
              {marcas.length > 0 && (
                <div className="col-span-2">
                  <label className={labelCls}>Marca</label>
                  <select
                    className={inputCls + ' bg-white'}
                    value={cab.marca_id || ''}
                    disabled={bloqueado}
                    onChange={(e) =>
                      setCabField('marca_id', e.target.value ? Number(e.target.value) : null)
                    }
                  >
                    <option value="">— Sin marca (nombre fiscal) —</option>
                    {marcas.map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre_comercial}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <label className={labelCls}>Cliente</label>
                <ClienteCombobox
                  value={cab.cliente_id}
                  onChange={onChangeCliente}
                  clientes={clientesDisp}
                  disabled={bloqueado}
                />
              </div>
              {!cab.cliente_id && (
                <div className="col-span-2">
                  <label className={labelCls}>Asunto</label>
                  <textarea
                    rows={2}
                    className={inputCls}
                    placeholder="ej: PUERTA DE ENTRADA METÁLICA"
                    value={cab.asunto || ''}
                    disabled={bloqueado}
                    onChange={(e) => setCabField('asunto', e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>IVA (%)</label>
                <input
                  type="number" onFocus={(e) => e.target.select()}
                  step="0.01"
                  className={inputCls}
                  value={Number(cab.iva_porcentaje) || 0}
                  disabled={bloqueado || cab.iva_incluido === 0}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCabField(
                      'iva_porcentaje',
                      v === '' ? 0 : Number(v) || 0,
                    );
                  }}
                />
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded text-brand focus:ring-brand"
                    checked={cab.iva_incluido === 0}
                    disabled={bloqueado}
                    onChange={(e) =>
                      setCabField('iva_incluido', e.target.checked ? 0 : 1)
                    }
                  />
                  Sin IVA (PDF mostrará "IVA no incluido")
                </label>
              </div>
            </div>
          </section>

          {/* Lineas */}
          <section className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                Trabajos / Conceptos
              </h3>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-brand focus:ring-brand"
                    checked={!!cab.modo_detallado}
                    disabled={bloqueado}
                    onChange={(e) => onToggleModoDetallado(e.target.checked)}
                  />
                  Modo detallado
                  <span
                    className="text-slate-400"
                    title="Cada línea puede tener subitems (descripción + importe). El total de la línea se calcula como la suma."
                  >
                    ⓘ
                  </span>
                </label>
                <button
                  onClick={addLinea}
                  disabled={bloqueado}
                  className="inline-flex items-center gap-1.5 text-sm text-brand hover:text-brand-dark disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <Plus size={16} /> Añadir línea
                </button>
              </div>
            </div>

            {lineas.length === 0 && (
              <div className="text-sm text-slate-500 py-6 text-center">
                Sin líneas. Añade la primera para empezar.
              </div>
            )}

            <div className="space-y-3">
              {lineas.map((l, idx) => {
                const subs = l.sublineas || [];
                // En modo detallado con subitems, el importe de la linea se
                // calcula como suma — el input queda read-only.
                const importeReadOnly = !!cab.modo_detallado && subs.length > 0;
                return (
                  <div
                    key={l.id}
                    className="border border-slate-200 rounded-lg p-3 flex gap-3 items-start"
                  >
                    <div className="flex flex-col gap-1 pt-1">
                      <button
                        onClick={() => moverLinea(idx, -1)}
                        disabled={idx === 0 || bloqueado}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        title="Subir"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => moverLinea(idx, 1)}
                        disabled={idx === lineas.length - 1 || bloqueado}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        title="Bajar"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2 items-start">
                        {/* v1.2.31: autocomplete SIEMPRE, sin gate por tipo_negocio
                            (ver justificación en FacturaEditor.jsx). */}
                        <ProductoAutocomplete
                          className={inputCls + ' font-medium flex-1'}
                          placeholder="Título o busca producto (nombre o #código)"
                          value={l.titulo}
                          disabled={bloqueado}
                          onChange={(v) => patchLineaLocal(l.id, { titulo: v })}
                          onSelectProducto={(p) => patchLineaLocal(l.id, {
                            titulo: p.nombre,
                            codigo: p.codigo || '',
                            descripcion: p.descripcion || l.descripcion,
                            iva_pct: p.iva_pct == null ? l.iva_pct : p.iva_pct,
                            importe: p.precio_unitario != null && p.precio_unitario !== 0
                              ? p.precio_unitario : l.importe,
                            producto_id: p.id || null,
                          })}
                        />
                        <div className="shrink-0">
                          <IvaPicker
                            value={l.iva_pct}
                            defaultPct={cab.iva_porcentaje}
                            disabled={bloqueado}
                            onChange={(v) =>
                              patchLineaLocal(l.id, { iva_pct: v })
                            }
                          />
                        </div>
                        <div className="w-28 shrink-0">
                          <div className="flex">
                            <input
                              type="number" onFocus={(e) => e.target.select()}
                              step="0.01"
                              min="0"
                              className={inputCls + ' text-right rounded-r-none'}
                              placeholder="Dto."
                              title="Descuento de esta línea"
                              value={Number(l.descuento_valor) || 0}
                              disabled={bloqueado}
                              onChange={(e) => {
                                const v = e.target.value;
                                patchLineaLocal(l.id, {
                                  descuento_valor: v === '' ? 0 : Number(v) || 0,
                                });
                              }}
                            />
                            <button
                              type="button"
                              disabled={bloqueado}
                              onClick={() => patchLineaLocal(l.id, {
                                descuento_tipo: l.descuento_tipo === 'eur' ? 'pct' : 'eur',
                              })}
                              className="px-2 border border-l-0 border-slate-300 rounded-r-lg bg-slate-50 text-slate-600 text-sm hover:bg-slate-100 disabled:opacity-50"
                              title="Cambiar entre % e importe fijo"
                            >
                              {l.descuento_tipo === 'eur' ? '€' : '%'}
                            </button>
                          </div>
                        </div>
                        <div className="w-32">
                          <div className="relative">
                            <input
                              type="number" onFocus={(e) => e.target.select()}
                              step="0.01"
                              className={
                                inputCls +
                                ' pr-7 text-right ' +
                                (importeReadOnly
                                  ? 'bg-slate-50 text-slate-700 font-semibold cursor-not-allowed'
                                  : '')
                              }
                              value={Number(l.importe) || 0}
                              disabled={bloqueado}
                              readOnly={importeReadOnly}
                              onChange={(e) => {
                                if (importeReadOnly) return;
                                const v = e.target.value;
                                patchLineaLocal(l.id, {
                                  importe: v === '' ? 0 : Number(v) || 0,
                                });
                              }}
                              title={
                                importeReadOnly
                                  ? 'Suma de subitems (calculada)'
                                  : 'Importe directo'
                              }
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                              €
                            </span>
                          </div>
                        </div>
                      </div>
                      <textarea
                        rows={cab.modo_detallado ? 2 : 3}
                        className={inputCls}
                        placeholder={
                          cab.modo_detallado
                            ? 'Descripción opcional (contexto general de la línea)'
                            : 'Descripción detallada (ej: rascado, encintado, masilla en grietas, lijado integral…)'
                        }
                        value={l.descripcion ?? ''}
                        disabled={bloqueado}
                        onChange={(e) =>
                          patchLineaLocal(l.id, {
                            descripcion: e.target.value,
                          })
                        }
                      />

                      {cab.modo_detallado && (
                        <LineaSubitems
                          lineaId={l.id}
                          kind="presupuesto"
                          subitems={subs}
                          disabled={bloqueado}
                          onChange={(newSubs) =>
                            updateLineaSubs(l.id, newSubs)
                          }
                        />
                      )}
                    </div>

                    <button
                      onClick={() => deleteLinea(l.id)}
                      disabled={bloqueado}
                      className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors mt-1 disabled:opacity-30"
                      title="Eliminar línea"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>

            {lineas.length > 0 && (
              <button
                onClick={addLinea}
                disabled={bloqueado}
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-sm text-brand hover:text-white hover:bg-brand border-2 border-dashed border-brand/40 hover:border-brand rounded-lg py-2.5 transition-colors disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed"
              >
                <Plus size={16} /> Añadir línea
              </button>
            )}

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-600">Descuento al total</span>
              <div className="flex w-40">
                <input
                  type="number" onFocus={(e) => e.target.select()}
                  step="0.01"
                  min="0"
                  className={inputCls + ' text-right rounded-r-none'}
                  value={Number(cab.descuento_valor) || 0}
                  disabled={bloqueado}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCab((c) => ({ ...c, descuento_valor: v === '' ? 0 : Number(v) || 0 }));
                  }}
                />
                <button
                  type="button"
                  disabled={bloqueado}
                  onClick={() => setCab((c) => ({
                    ...c, descuento_tipo: c.descuento_tipo === 'eur' ? 'pct' : 'eur',
                  }))}
                  className="px-3 border border-l-0 border-slate-300 rounded-r-lg bg-slate-50 text-slate-600 text-sm hover:bg-slate-100 disabled:opacity-50"
                  title="Cambiar entre % e importe fijo"
                >
                  {cab.descuento_tipo === 'eur' ? '€' : '%'}
                </button>
              </div>
            </div>

            <div className="mt-3 text-sm text-slate-600 space-y-1">
              {Number(totales.descuentoLineas) + Number(totales.descuentoGlobal) > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatEUR(totales.subtotalBruto)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Descuento</span>
                    <span>
                      − {formatEUR(
                        Number(totales.descuentoLineas) + Number(totales.descuentoGlobal),
                      )}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span>Base imponible</span>
                <span>{formatEUR(totales.base)}</span>
              </div>
              {totales.ivaBreakdown.map((b) => (
                <div key={b.pct} className="flex justify-between">
                  <span>
                    IVA {b.pct}%{' '}
                    <span className="text-slate-400">
                      sobre {formatEUR(b.base)}
                    </span>
                  </span>
                  <span>{formatEUR(b.importe)}</span>
                </div>
              ))}
              {Number(totales.recargoEq) > 0 && (
                <div className="flex justify-between">
                  <span>Recargo de equivalencia</span>
                  <span>+ {formatEUR(totales.recargoEq)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-slate-800 pt-1 border-t border-slate-100 mt-1">
                <span>Total</span>
                <span>{formatEUR(totales.total)}</span>
              </div>
            </div>
          </section>

          {/* Notas internas */}
          <section className="bg-white rounded-lg shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">
              Notas internas
            </h3>
            <textarea
              rows={3}
              className={inputCls}
              placeholder="Notas que no aparecen en el PDF…"
              value={cab.notas || ''}
              disabled={bloqueado}
              onChange={(e) => setCabField('notas', e.target.value)}
            />
          </section>

          {/* Plan de pagos opcional. Si tiene hitos, al convertir genera
              N facturas en lugar de 1. Lista vacia = comportamiento legacy. */}
          {!loading && presupuestoId > 0 && (
            <PlanPagosSection
              presupuestoId={presupuestoId}
              disabled={bloqueado}
              onHitosChange={setHitos}
            />
          )}

          {/* Adjuntos: archivos asociados al presupuesto. NO se incluyen en el PDF. */}
          {!loading && presupuestoId > 0 && (
            <AdjuntosSection
              parentType="presupuesto"
              parentId={presupuestoId}
              disabled={bloqueado}
            />
          )}
        </div>
        </div>

        {/* Columna derecha: vista previa PDF (canvas, no iframe) */}
        <div className="w-full lg:w-[480px] lg:shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-100 p-3 flex flex-col">
          <div className="text-xs text-slate-500 px-1 pb-2 flex items-center justify-between">
            <span>Vista previa</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreviewModal(true)}
                disabled={!pdfBlob}
                className="text-brand hover:text-brand-dark inline-flex items-center gap-1 disabled:opacity-50"
                title="Ver a pantalla completa"
              >
                <Maximize2 size={13} /> Ampliar
              </button>
              <button
                onClick={generarBlob}
                className="text-brand hover:text-brand-dark"
                title="Actualizar manualmente"
              >
                ↻ Actualizar
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <PDFCanvasPreview pdfBlob={pdfBlob} />
          </div>
        </div>
      </div>

      {showRecurrencia && (
        <RecurrenciaModal
          tipo="presupuesto"
          sourceId={presupuestoId}
          sourceLabel={`Presupuesto ${cab.numero || ''}`}
          existing={recurrencia}
          onClose={() => setShowRecurrencia(false)}
          onSaved={(r) => setRecurrencia(r)}
        />
      )}
      {showPreviewModal && (
        <PDFPreviewModal
          pdfBlob={pdfBlob}
          title={`Presupuesto ${cab.numero || ''}`}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
      {showConvertirModal && (
        <ConvertirFacturaModal
          presupuesto={{ ...cab, id: presupuestoId }}
          series={seriesFacturas}
          defaultSerie={serieFacturaTarget}
          hasHitos={Array.isArray(hitos) && hitos.length > 0}
          onConfirm={ejecutarConversion}
          onCancel={() => setShowConvertirModal(false)}
        />
      )}
    </div>
  );
}

export default PresupuestoEditor;
