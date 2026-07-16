import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowDown, ArrowUp, Check, Download, FileCheck, FileCode2, FileOutput, FileSpreadsheet, Lock, Maximize2, Plus, Repeat, Save, Trash2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import FacturaPDF from '../pdf/FacturaPDF.jsx';
import PDFCanvasPreview from '../components/PDFCanvasPreview.jsx';
import LineaSubitems from '../components/LineaSubitems.jsx';
import ExportAEATModal from '../components/ExportAEATModal.jsx';
import ExportHoldedModal from '../components/ExportHoldedModal.jsx';
import ExportFacturaeModal from '../components/ExportFacturaeModal.jsx';
import RecurrenciaModal from '../components/RecurrenciaModal.jsx';
import PDFPreviewModal from '../components/PDFPreviewModal.jsx';
import ImportarPresupuestoModal from '../components/ImportarPresupuestoModal.jsx';
import ConvertirProformaModal from '../components/ConvertirProformaModal.jsx';
import ProductoAutocomplete from '../components/ProductoAutocomplete.jsx';
import ClienteCombobox from '../components/ClienteCombobox.jsx';
import IvaPicker from '../components/IvaPicker.jsx';
import AdjuntosSection from '../components/AdjuntosSection.jsx';
import CobrosSection from '../components/CobrosSection.jsx';
import { calcTotales, formatEUR } from '../utils/format.js';
import { generateSepaQrDataUrl } from '../utils/sepaQr.js';
import { useToast } from '../components/Toast.jsx';

const ESTADOS = ['borrador', 'emitida', 'cobrada'];

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand text-sm disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

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

function FacturaEditor() {
  const { id } = useParams();
  const facturaId = Number(id);
  const nav = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [cab, setCab] = useState({
    numero: '',
    fecha: '',
    fecha_vencimiento: '',
    ciudad_emision: '',
    cliente_id: null,
    asunto: '',
    iva_porcentaje: 21,
    iva_incluido: 1,
    estado: 'borrador',
    notas: '',
    notas_publicas: '',
    presupuesto_id: null,
    modo_detallado: 0,
    factura_ocultar_subitems: 0,
    documento_interno: 0,
    irpf_pct: 0,
    serie: 'A',
    marca_id: null,
    descuento_tipo: 'pct',
    descuento_valor: 0,
    // v1.2.35: subtipo del documento (factura | proforma | nota_contado |
    // rectificativa). Necesario para mostrar el boton "Convertir a factura"
    // solo en proformas. Solo lectura desde aqui — el subtipo se decide
    // al crear la factura y no se cambia en el editor.
    subtipo: 'factura',
    proforma_origen_id: null,
    convertida_a: null,
    // v1.4.0: nombre custom del documento. Cuando NO es vacio sustituye el
    // titulo por defecto ("PROFORMA", "FACTURA", etc.) en el PDF y listado.
    titulo_documento_override: '',
    // v1.5.0: idioma del PDF de este documento. NULL = usar el default
    // (idioma preferido del cliente > idioma global de la empresa > 'es').
    idioma_documento: null,
  });
  const [cabOriginal, setCabOriginal] = useState(cab);
  const [marcas, setMarcas] = useState([]);

  // v1.4.0: state local del input del numero para evitar el bug del
  // autoguardado con valor stale. Ver comentario detallado en la app
  // (electron/facturas-app version). Solo propaga a cab.numero en onBlur.
  const [numeroInput, setNumeroInput] = useState('');
  useEffect(() => {
    setNumeroInput(cab.numero || '');
  }, [cab.numero]);

  useEffect(() => {
    if (!window.api?.marcas) return;
    window.api.marcas.list().then((l) => setMarcas(Array.isArray(l) ? l : []));
  }, []);

  const [lineas, setLineas] = useState([]);
  // v1.2.36: cobros con su flag mostrar_en_pdf. Necesarios en el editor para
  // pasar al render del PDF (los cobros marcados aparecen como pago a cuenta
  // debajo del TOTAL). Se mantienen sincronizados via callback de CobrosSection.
  const [cobros, setCobros] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [settings, setSettings] = useState(null);
  const [clientesDisp, setClientesDisp] = useState([]);

  const bloqueada = cab.estado !== 'borrador';

  const loadedIdRef = useRef(null);

  async function cargar() {
    if (!window.api) {
      setError('Esta aplicación debe ejecutarse desde Electron.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [f, sets, cls] = await Promise.all([
        window.api.facturas.get(facturaId),
        window.api.settings.get(),
        window.api.clientes.list(),
      ]);
      if (f && f.error) {
        setError(f.error);
        return;
      }
      if (!f) {
        setError('Factura no encontrada');
        return;
      }
      const newCab = {
        numero: f.numero ?? '',
        fecha: f.fecha ?? '',
        fecha_vencimiento: f.fecha_vencimiento ?? '',
        ciudad_emision: f.ciudad_emision ?? '',
        cliente_id: f.cliente_id ?? null,
        asunto: f.asunto ?? '',
        iva_porcentaje: f.iva_porcentaje ?? 21,
        iva_incluido: f.iva_incluido === 0 ? 0 : 1,
        estado: f.estado ?? 'borrador',
        notas: f.notas ?? '',
        notas_publicas: f.notas_publicas ?? '',
        presupuesto_id: f.presupuesto_id ?? null,
        modo_detallado: f.modo_detallado ? 1 : 0,
        factura_ocultar_subitems: f.factura_ocultar_subitems ? 1 : 0,
        documento_interno: f.documento_interno ? 1 : 0,
        irpf_pct: Number(f.irpf_pct) || 0,
        serie: f.serie ?? 'A',
        marca_id: f.marca_id ?? null,
        descuento_tipo: f.descuento_tipo === 'eur' ? 'eur' : 'pct',
        descuento_valor: Number(f.descuento_valor) || 0,
        subtipo: f.subtipo || 'factura',
        proforma_origen_id: f.proforma_origen_id || null,
        convertida_a: f.convertida_a || null,
        titulo_documento_override: f.titulo_documento_override || '',
        idioma_documento: f.idioma_documento || null,
      };
      // Autorrelleno de IRPF al cargar: si la factura es borrador, no tiene
      // IRPF puesto todavia, y el cliente tiene un default > 0, aplicarlo.
      // Cubre el caso de "convertir presupuesto a factura" — alli no se
      // dispara onChangeCliente porque el cliente ya viene asignado.
      const clienteIrpfDefault = Number(f.cliente?.irpf_pct_default) || 0;
      if (
        newCab.estado === 'borrador' &&
        newCab.irpf_pct === 0 &&
        clienteIrpfDefault > 0
      ) {
        newCab.irpf_pct = clienteIrpfDefault;
        toast.info?.(`IRPF ${clienteIrpfDefault}% aplicado desde el cliente`)
          || toast.success(`IRPF ${clienteIrpfDefault}% aplicado desde el cliente`);
      }
      // Descuento por defecto del cliente (modo 'total'): se aplica a la
      // cabecera. Modo 'linea' no toca lineas existentes; solo las que se
      // anyadan a partir de ahora (ver addLinea) heredaran el descuento.
      const clienteDescDefault = Number(f.cliente?.descuento_pct_default) || 0;
      const clienteDescAplicar = f.cliente?.descuento_aplicar === 'linea' ? 'linea' : 'total';
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
      setLineas(f.lineas || []);
      setCobros(f.cobros || []);
      setCliente(f.cliente || null);
      setSettings(sets && !sets.error ? sets : null);
      setClientesDisp(Array.isArray(cls) ? cls : []);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadedIdRef.current === facturaId) return;
    loadedIdRef.current = facturaId;
    cargar();
  }, [facturaId]);

  // Forzar focus en el wrapper tras cargar. Sin esto, el render del canvas
  // de la vista previa PDF (pdfjs) deja el documento sin focus efectivo y
  // los primeros keystrokes / dropdowns no responden hasta hacer click en
  // cualquier elemento. Reproducible en prod tambien (no solo dev), por
  // eso no basta con detach DevTools. Reproducido tambien tras convertir
  // un presupuesto: por eso intentamos varias veces (pdfjs puede acabar
  // de renderizar despues del primer intento y volver a robar el foco).
  const rootRef = useRef(null);
  useEffect(() => {
    if (loading) return;
    // Reset defensivo de cualquier body-lock que un modal anterior haya
    // dejado mal cerrado al navegar (el cleanup del modal se ejecuta al
    // desmontar, pero si la nav fue muy rapida, asegurarse aqui no daña).
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

  const cabDirty = useMemo(
    () => JSON.stringify(cab) !== JSON.stringify(cabOriginal),
    [cab, cabOriginal],
  );

  useDebouncedEffect(cab, 500, async (current) => {
    if (loading) return;
    if (JSON.stringify(current) === JSON.stringify(cabOriginal)) return;
    try {
      const res = await window.api.facturas.update(facturaId, current);
      if (res && res.error) {
        setError(res.error);
        return;
      }
      // Si cambia el estado (emitida → cobrada, etc.), notifica al sidebar
      // y al home para que refresquen el contador de vencidas.
      if (current.estado !== cabOriginal.estado) {
        window.dispatchEvent(new CustomEvent('data-changed'));
      }
      setCabOriginal(current);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  });

  // Botón "Guardar" explícito. La factura ya se autoguarda (debounced), pero
  // la madre quería un botón visible para quedarse tranquila. Fuerza el
  // guardado YA: vacía los temporizadores de líneas pendientes y persiste la
  // cabecera sin esperar al debounce.
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  async function guardarAhora() {
    if (bloqueada) return;
    setGuardando(true);
    setError(null);
    try {
      // 1) Líneas con guardado pendiente: dispararlas ya.
      const pendientes = Array.from(timersRef.current.entries());
      for (const [lineaId, t] of pendientes) {
        clearTimeout(t);
        timersRef.current.delete(lineaId);
        await persistirLinea(lineaId);
      }
      // 2) Cabecera (siempre, aunque el debounce no haya saltado).
      const res = await window.api.facturas.update(facturaId, cab);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setCabOriginal(cab);
      window.dispatchEvent(new CustomEvent('data-changed'));
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 2500);
      toast.success('Factura guardada');
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(e.message ?? String(e));
    } finally {
      setGuardando(false);
    }
  }

  function setCabField(k, v) {
    setCab((c) => ({ ...c, [k]: v }));
  }

  function onToggleModoDetallado(checked) {
    if (bloqueada) return;
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

  // --- cambio de estado: persistencia INMEDIATA (sin debounce) ---
  // El estado es el campo critico de la factura: queremos que se guarde
  // ya, no en 500ms via autosave, para que aunque el usuario navegue
  // rapido o el preview PDF este regenerandose, no se pierda el cambio.
  async function onChangeEstado(nuevoEstado) {
    if (
      nuevoEstado === 'emitida' &&
      cab.estado === 'borrador' &&
      !cab.cliente_id
    ) {
      setError('Selecciona un cliente antes de emitir la factura.');
      setTimeout(() => setError(null), 4000);
      return;
    }
    if (cab.estado === 'borrador' && nuevoEstado === 'emitida') {
      const ok = confirm(
        'Una vez emitida, los datos quedarán bloqueados.\n¿Continuar?',
      );
      if (!ok) return;
    }
    // 1) Optimistic UI: actualiza local enseguida.
    setCab((c) => ({ ...c, estado: nuevoEstado }));
    // 2) Persistir directamente (no esperamos al debounce).
    try {
      const payload = { ...cab, estado: nuevoEstado };
      const res = await window.api.facturas.update(facturaId, payload);
      if (res?.error) {
        setError(res.error);
        return;
      }
      // 3) Actualiza cabOriginal para que el autosave debounced (que se
      //    dispararia por el cambio de cab) detecte que ya estamos en sync
      //    y haga early-return.
      setCabOriginal((o) => ({ ...o, estado: nuevoEstado }));
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }

  // --- Lineas ---
  const timersRef = useRef(new Map());
  const lineasRef = useRef([]);
  useEffect(() => {
    lineasRef.current = lineas;
  });

  function patchLineaLocal(lineaId, patch) {
    if (bloqueada) return;
    setLineas((prev) => {
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
          merged.descuento_valor === l.descuento_valor &&
          merged.diana_pct === l.diana_pct
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
      const cantidadNum = Number(linea.cantidad) || 1;
      const precioUnit = cantidadNum > 0 ? Math.round((importeNum / cantidadNum) * 100) / 100 : importeNum;
      const res = await window.api.lineasFactura.update(lineaId, {
        titulo: linea.titulo ?? null,
        descripcion: linea.descripcion ?? '',
        cantidad: cantidadNum,
        precio_unitario: precioUnit,
        importe: importeNum,
        iva_pct: linea.iva_pct == null ? null : Number(linea.iva_pct),
        codigo: linea.codigo ?? null,
        descuento_tipo: linea.descuento_tipo === 'eur' ? 'eur' : 'pct',
        descuento_valor: Number(linea.descuento_valor) || 0,
        diana_pct: Number(linea.diana_pct) || 0,
      });
      if (res && res.error) setError(res.error);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }

  // Handler dedicado para `diana_pct`. A diferencia de patchLineaLocal,
  // funciona TAMBIEN en facturas bloqueadas (emitidas/cobradas) porque
  // diana_pct es metadato interno no fiscal — no toca total/IVA/numero/PDF,
  // solo la cuenta interna de Diana. Llama al endpoint dedicado del repo,
  // que omite el check de _facturaBloqueada.
  async function cambiarDianaPctLinea(lineaId, valor) {
    const v = Number(valor) || 0;
    setLineas((prev) => prev.map((l) => (l.id === lineaId ? { ...l, diana_pct: v } : l)));
    try {
      const res = await window.api.lineasFactura.setDianaPct(lineaId, v);
      if (res && res.error) setError(res.error);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  async function addLinea() {
    if (bloqueada) return;
    setError(null);
    try {
      // Si el cliente tiene descuento por defecto en modo 'linea', la nueva
      // linea hereda ese descuento de origen. En modo 'total' la cabecera
      // ya lo tiene aplicado, asi que la linea sale sin descuento propio.
      const descClient = Number(cliente?.descuento_pct_default) || 0;
      const aplicar = cliente?.descuento_aplicar === 'linea' ? 'linea' : 'total';
      const lineaDescPatch = (descClient > 0 && aplicar === 'linea')
        ? { descuento_tipo: 'pct', descuento_valor: descClient }
        : {};
      const res = await window.api.lineasFactura.create(facturaId, {
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
    if (bloqueada) return;
    setError(null);
    try {
      const res = await window.api.lineasFactura.delete(lineaId);
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
    if (bloqueada) return;
    const newArr = [...lineas];
    const target = idx + dir;
    if (target < 0 || target >= newArr.length) return;
    [newArr[idx], newArr[target]] = [newArr[target], newArr[idx]];
    setLineas(newArr);
    try {
      const res = await window.api.lineasFactura.reorder(
        facturaId,
        newArr.map((l) => l.id),
      );
      if (res && res.error) setError(res.error);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }

  function onChangeCliente(value) {
    if (value == null) {
      setCabField('cliente_id', null);
      setCliente(null);
    } else {
      const cid = Number(value);
      const c = clientesDisp.find((x) => x.id === cid) || null;
      // Si el cliente trae un IRPF por defecto y la factura aun no tiene IRPF
      // configurado, autorrellenarlo. No sobrescribimos si el usuario ya
      // habia puesto uno manualmente.
      const irpfDefault = Number(c?.irpf_pct_default) || 0;
      const descDefault = Number(c?.descuento_pct_default) || 0;
      const descAplicar = c?.descuento_aplicar === 'linea' ? 'linea' : 'total';
      setCab((prev) => {
        const next = { ...prev, cliente_id: cid || null };
        if (irpfDefault > 0 && (!prev.irpf_pct || Number(prev.irpf_pct) === 0)) {
          next.irpf_pct = irpfDefault;
        }
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
      if (irpfDefault > 0 && (!cab.irpf_pct || Number(cab.irpf_pct) === 0)) {
        toast.info?.(`IRPF ${irpfDefault}% aplicado desde el cliente`)
          || toast.success(`IRPF ${irpfDefault}% aplicado desde el cliente`);
      }
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

  // --- Vista previa PDF (canvas, no iframe) ---
  const previewDataRef = useRef({ cab, lineas, cliente, settings, cobros });
  useEffect(() => {
    const marca = marcas.find((m) => m.id === cab.marca_id) || null;
    previewDataRef.current = { cab, lineas, cliente, settings, marca, cobros };
  }, [cab, lineas, cliente, settings, marcas, cobros]);

  const [pdfBlob, setPdfBlob] = useState(null);

  const generarBlob = useCallback(async () => {
    try {
      const { cab: c, lineas: ls, cliente: cl, settings: s, marca: mk, cobros: cb } =
        previewDataRef.current;
      const totalsForQr = calcTotales(ls, c.iva_porcentaje, c.irpf_pct, {
        incluyeIva: c.iva_incluido !== 0,
        descuentoGlobalTipo: c.descuento_tipo,
        descuentoGlobalValor: c.descuento_valor,
      });
      const qrDataUrl = await generateSepaQrDataUrl({
        beneficiario: s?.emisor_nombre,
        iban: s?.emisor_iban,
        importe: totalsForQr.total,
        concepto: `Factura ${c.numero || ''}`.trim(),
      });
      const settingsWithQr = { ...s, qr_data_url: qrDataUrl };
      const blob = await pdf(
        <FacturaPDF
          factura={{ ...c, id: facturaId, marca: mk, cobros: cb }}
          lineas={ls}
          cliente={cl}
          settings={settingsWithQr}
        />,
      ).toBlob();
      setPdfBlob(blob);
    } catch (e) {
      console.error('Error generando PDF para preview:', e);
    }
  }, [facturaId]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(generarBlob, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cab, lineas, cliente, settings, loading]);

  const [downloading, setDownloading] = useState(false);
  const [showAEAT, setShowAEAT] = useState(false);
  const [showHolded, setShowHolded] = useState(false);
  const [showFacturae, setShowFacturae] = useState(false);
  const [showRecurrencia, setShowRecurrencia] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showImportarModal, setShowImportarModal] = useState(false);
  const [showConvertirProforma, setShowConvertirProforma] = useState(false);

  async function convertirProformaActual(opts) {
    const res = await window.api.facturas.convertirProforma(facturaId, opts);
    if (res && res.error) throw new Error(res.error);
    toast.success(`Factura ${res.facturaNumero} creada desde proforma ${res.proformaNumero}`);
    setShowConvertirProforma(false);
    window.dispatchEvent(new CustomEvent('data-changed'));
    nav(`/facturas/${res.facturaId}`);
  }

  async function importarLineasPresupuesto(presupuestoId) {
    setError(null);
    try {
      const res = await window.api.facturas.importarLineasPresupuesto(
        facturaId,
        presupuestoId,
      );
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setShowImportarModal(false);
      // Recargar la factura: las nuevas líneas se han añadido en el backend
      // y necesitamos verlas en el editor.
      loadedIdRef.current = null;
      await cargar();
      toast.success(
        `${res?.addedLineas ?? 0} línea${res?.addedLineas === 1 ? '' : 's'} importada${res?.addedLineas === 1 ? '' : 's'}`,
      );
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(e.message ?? String(e));
    }
  }
  const [recurrencia, setRecurrencia] = useState(null);

  // Carga la recurrencia asociada (si existe) para mostrar el boton en modo
  // "Editar recurrencia" en lugar de "Hacer recurrente".
  useEffect(() => {
    if (!facturaId || !window.api) return;
    let cancelled = false;
    window.api.recurrencias.forSource('factura', facturaId).then((r) => {
      if (!cancelled) setRecurrencia(r && !r.error ? r : null);
    });
    return () => { cancelled = true; };
  }, [facturaId]);
  async function descargarPDF() {
    setError(null);
    setDownloading(true);
    try {
      const qrDataUrl = await generateSepaQrDataUrl({
        beneficiario: settings?.emisor_nombre,
        iban: settings?.emisor_iban,
        importe: totales.total,
        concepto: `Factura ${cab.numero || ''}`.trim(),
      });
      const settingsWithQr = { ...settings, qr_data_url: qrDataUrl };
      const blob = await pdf(
        <FacturaPDF
          factura={{
            ...cab, id: facturaId,
            marca: marcas.find((m) => m.id === cab.marca_id) || null,
            cobros,
          }}
          lineas={lineas}
          cliente={cliente}
          settings={settingsWithQr}
        />,
      ).toBlob();
      const arrBuf = await blob.arrayBuffer();
      const u8 = new Uint8Array(arrBuf);
      const res = await window.api.pdf.saveFactura(facturaId, u8);
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
    } finally {
      setDownloading(false);
    }
  }

  // Cliente intracomunitario => factura sin IVA (inversión del sujeto
  // pasivo). El panel de totales debe reflejarlo igual que el PDF.
  // calcTotales es O(nº líneas) — barato; sin memo para no pelear con el
  // compilador (igual lo memoiza solo si está activo).
  const esIntracom = !!(cliente && cliente.intracomunitario);
  const totales = calcTotales(lineas, cab.iva_porcentaje, cab.irpf_pct, {
    incluyeIva: cab.iva_incluido !== 0 && !esIntracom,
    recargoEquivalencia: !esIntracom && !!(cliente && cliente.recargo_equivalencia),
    descuentoGlobalTipo: cab.descuento_tipo,
    descuentoGlobalValor: cab.descuento_valor,
  });

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 mb-2">Factura</h1>
        <p className="text-slate-500">Cargando…</p>
      </div>
    );
  }

  if (error && !cab.numero) {
    return (
      <div>
        <button
          onClick={() => nav('/facturas')}
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
              onClick={() => nav('/facturas')}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft size={18} /> Volver
            </button>
            <div className="text-2xl font-semibold text-slate-800">
              {cab.subtipo === 'proforma' ? 'PROFORMA' :
                cab.subtipo === 'nota_contado' ? 'CONTADO' :
                cab.subtipo === 'rectificativa' ? 'RECTIFICATIVA' : 'FACTURA'}
              {' '}{cab.numero}
            </div>
            {guardadoOk ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                <Check size={13} /> Guardado
              </span>
            ) : cabDirty ? (
              <span className="text-xs text-amber-600">Sin guardar</span>
            ) : (
              <span className="text-xs text-slate-400">Guardado</span>
            )}
            {cab.presupuesto_id && (
              <button
                onClick={() => nav(`/presupuestos/${cab.presupuesto_id}`)}
                className="text-xs text-brand hover:text-brand-dark underline"
              >
                ← desde presupuesto
              </button>
            )}
            {cab.proforma_origen_id ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                title="Esta factura se generó al convertir una proforma"
              >
                ✓ Desde proforma
              </span>
            ) : null}
            {cab.subtipo === 'proforma' && cab.convertida_a ? (
              <button
                onClick={() => nav(`/facturas/${cab.convertida_a.factura_id}`)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                title="Ver la factura generada desde esta proforma"
              >
                ✓ Convertida a {cab.convertida_a.factura_numero}
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {cab.subtipo === 'proforma' && !cab.convertida_a ? (
              <button
                onClick={() => setShowConvertirProforma(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors text-sm font-medium"
                title="Genera una factura nueva con los datos de esta proforma"
              >
                <FileCheck size={15} />
                Convertir a factura
              </button>
            ) : null}
            <select
              value={cab.estado}
              onChange={(e) => onChangeEstado(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              {ESTADOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowAEAT(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors text-sm"
              title="Datos formateados para copiar en la app gratuita de la AEAT"
            >
              <FileOutput size={15} />
              AEAT
            </button>
            <button
              onClick={() => setShowHolded(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors text-sm"
              title="Genera un archivo XLSX para importar en Holded"
            >
              <FileSpreadsheet size={15} />
              Holded
            </button>
            <button
              onClick={() => setShowFacturae(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors text-sm"
              title="Genera un archivo XML estándar Facturae 3.2.2 para BeeL, FacturaDirecta, Quipu, etc."
            >
              <FileCode2 size={15} />
              Facturae
            </button>
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
                  ? 'Esta factura se genera automaticamente cada periodo'
                  : 'Generar esta factura automaticamente cada mes/trimestre/etc.'
              }
            >
              <Repeat size={15} />
              {recurrencia ? 'Recurrente' : 'Hacer recurrente'}
            </button>
            {!bloqueada && (
              <button
                onClick={guardarAhora}
                disabled={guardando}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors text-sm disabled:opacity-60"
                title="Guardar ahora (la factura también se guarda sola)"
              >
                <Save size={16} />
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            )}
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

        {bloqueada && (
          <div className="mt-3 px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm flex items-center gap-2">
            <Lock size={16} />
            Esta factura está bloqueada. Para modificarla, vuelve al estado borrador.
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
            <div>
              <label className={labelCls}>Número de factura</label>
              <input
                className={inputCls}
                value={numeroInput}
                disabled={bloqueada}
                onChange={(e) => setNumeroInput(e.target.value)}
                onBlur={() => {
                  const trimmed = numeroInput.trim();
                  if (trimmed !== (cab.numero || '')) {
                    setCabField('numero', trimmed);
                  } else if (trimmed !== numeroInput) {
                    setNumeroInput(trimmed);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
              <p className="text-xs text-slate-500 mt-1">
                Se asigna automáticamente. Puedes cambiarlo si lo necesitas;
                no puede repetirse con el de otra factura.
              </p>
            </div>
            {/* v1.4.0: nombre custom del documento. Solo para subtipos !== factura. */}
            {cab.subtipo !== 'factura' && (
              <div>
                <label className={labelCls}>Título del documento (opcional)</label>
                <input
                  className={inputCls}
                  value={cab.titulo_documento_override || ''}
                  disabled={bloqueada}
                  placeholder={
                    cab.subtipo === 'proforma'
                      ? 'p.ej. Factura Proforma, Confirmación de pedido…'
                      : cab.subtipo === 'nota_contado'
                        ? 'p.ej. Nota de contado, Recibo…'
                        : cab.subtipo === 'rectificativa'
                          ? 'p.ej. Factura Rectificativa, Nota de abono…'
                          : ''
                  }
                  onChange={(e) => setCabField('titulo_documento_override', e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Si lo dejas vacío se usa el título por defecto (
                  {cab.subtipo === 'proforma' && 'PROFORMA'}
                  {cab.subtipo === 'nota_contado' && 'NOTA CONTADO'}
                  {cab.subtipo === 'rectificativa' && 'FACTURA RECTIFICATIVA'}
                  ). Aparece en el PDF y en el listado.
                </p>
              </div>
            )}
            {/* v1.5.0: idioma del PDF. Auto = usa el idioma preferido del
                cliente si esta configurado; si no, el idioma de la empresa. */}
            <div>
              <label className={labelCls}>Idioma del PDF</label>
              <select
                className={inputCls + ' bg-white'}
                value={cab.idioma_documento || ''}
                disabled={bloqueada}
                onChange={(e) => setCabField('idioma_documento', e.target.value || null)}
              >
                <option value="">Auto (según cliente o empresa)</option>
                <option value="es">Español</option>
                <option value="en">Inglés</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Cambia el idioma de los títulos y textos del PDF (INVOICE,
                DESCRIPTION, VAT, TOTAL…). Los productos con traducción
                también salen en inglés.
              </p>
            </div>
            {marcas.length > 0 && (
              <div>
                <label className={labelCls}>Marca</label>
                <select
                  className={inputCls + ' bg-white'}
                  value={cab.marca_id || ''}
                  disabled={bloqueada}
                  onChange={(e) =>
                    setCabField('marca_id', e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">— Sin marca (nombre fiscal) —</option>
                  {marcas.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre_comercial}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  El PDF mostrará el nombre comercial y logo de la marca; el
                  nombre fiscal sigue constando por ley.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fecha</label>
                <input
                  type="date"
                  className={inputCls}
                  value={cab.fecha || ''}
                  disabled={bloqueada}
                  onChange={(e) => setCabField('fecha', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Fecha de vencimiento (opcional)</label>
                <input
                  type="date"
                  className={inputCls}
                  value={cab.fecha_vencimiento || ''}
                  onChange={(e) => setCabField('fecha_vencimiento', e.target.value || null)}
                  title="Cuando vence el cobro. Solo informativo: aparece en el listado para detectar facturas vencidas."
                />
              </div>
              <div>
                <label className={labelCls}>Ciudad de emisión</label>
                <input
                  className={inputCls}
                  value={cab.ciudad_emision || ''}
                  disabled={bloqueada}
                  onChange={(e) => setCabField('ciudad_emision', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>
                  Cliente <span className="text-red-600">*</span>
                </label>
                <ClienteCombobox
                  value={cab.cliente_id}
                  onChange={onChangeCliente}
                  clientes={clientesDisp}
                  disabled={bloqueada}
                />
                {!cab.cliente_id && (
                  <p className="text-xs text-red-600 mt-1">
                    Las facturas requieren un cliente asignado.
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>IVA (%) por defecto</label>
                <input
                  type="number" onFocus={(e) => e.target.select()}
                  step="0.01"
                  className={inputCls}
                  value={Number(cab.iva_porcentaje) || 0}
                  disabled={bloqueada || cab.iva_incluido === 0}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCabField(
                      'iva_porcentaje',
                      v === '' ? 0 : Number(v) || 0,
                    );
                  }}
                  title="Tipo IVA por defecto. Cada línea puede sobreescribirlo."
                />
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded text-brand focus:ring-brand"
                    checked={cab.iva_incluido === 0}
                    disabled={bloqueada}
                    onChange={(e) =>
                      setCabField('iva_incluido', e.target.checked ? 0 : 1)
                    }
                  />
                  Sin IVA (PDF mostrará "IVA no incluido")
                </label>
                {esIntracom && (
                  <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
                    Cliente <strong>intracomunitario</strong>: esta factura sale
                    sin IVA con la nota de inversión del sujeto pasivo.
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>IRPF (%)</label>
                <input
                  type="number" onFocus={(e) => e.target.select()}
                  step="0.01"
                  className={inputCls}
                  value={Number(cab.irpf_pct) || 0}
                  disabled={bloqueada}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCabField(
                      'irpf_pct',
                      v === '' ? 0 : Number(v) || 0,
                    );
                  }}
                  title="Retención de IRPF. Habitual: 7% (nuevos autónomos) o 15% (general). 0 = sin retención."
                />
                {!bloqueada && cliente && Number(cliente.irpf_pct_default) > 0
                  && Number(cab.irpf_pct) !== Number(cliente.irpf_pct_default) ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Este cliente tiene <strong>{cliente.irpf_pct_default}%</strong> por defecto.{' '}
                    <button
                      type="button"
                      onClick={() => setCabField('irpf_pct', Number(cliente.irpf_pct_default))}
                      className="text-brand hover:text-brand-dark underline"
                    >
                      Aplicar
                    </button>
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          {/* Lineas */}
          <section className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                Conceptos facturados
              </h3>
              <div className="flex items-center gap-4 flex-wrap">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-brand focus:ring-brand"
                    checked={!!cab.modo_detallado}
                    disabled={bloqueada}
                    onChange={(e) => onToggleModoDetallado(e.target.checked)}
                  />
                  Modo detallado
                  <span
                    className="text-slate-400"
                    title="Cada concepto puede tener subitems (descripción + importe). El total se calcula como la suma."
                  >
                    ⓘ
                  </span>
                </label>
                {cab.modo_detallado ? (
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-brand focus:ring-brand"
                      checked={!cab.factura_ocultar_subitems}
                      disabled={bloqueada}
                      onChange={(e) =>
                        setCabField('factura_ocultar_subitems', e.target.checked ? 0 : 1)
                      }
                    />
                    Mostrar subitems en el PDF
                    <span
                      className="text-slate-400"
                      title="Si lo desmarcas, el PDF de la factura solo muestra los títulos de cada concepto (sin el desglose interno)."
                    >
                      ⓘ
                    </span>
                  </label>
                ) : null}
                {/* v1.2.31: toggle "documento interno" — el PDF sale como
                    "RESUMEN DE TRABAJOS" sin numero ni datos del emisor.
                    Pensado para enviar al cliente una propuesta o resumen
                    sin que conste la identidad fiscal del emisor. */}
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-brand focus:ring-brand"
                    checked={!!cab.documento_interno}
                    disabled={bloqueada}
                    onChange={(e) =>
                      setCabField('documento_interno', e.target.checked ? 1 : 0)
                    }
                  />
                  Documento interno
                  <span
                    className="text-slate-400"
                    title="Si está marcado, el PDF sale como 'RESUMEN DE TRABAJOS' sin número y sin datos del emisor (nombre, NIF, dirección, IBAN). La factura sigue guardada normalmente en la app."
                  >
                    ⓘ
                  </span>
                </label>
                <button
                  onClick={() => setShowImportarModal(true)}
                  disabled={bloqueada}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed"
                  title="Copiar las líneas de un presupuesto a esta factura (se añaden al final)"
                >
                  <Download size={16} /> Importar de presupuesto
                </button>
                <button
                  onClick={addLinea}
                  disabled={bloqueada}
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
                const importeReadOnly = !!cab.modo_detallado && subs.length > 0;
                return (
                <div
                  key={l.id}
                  className="border border-slate-200 rounded-lg p-3 flex gap-3 items-start"
                >
                  <div className="flex flex-col gap-1 pt-1">
                    <button
                      onClick={() => moverLinea(idx, -1)}
                      disabled={idx === 0 || bloqueada}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      title="Subir"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => moverLinea(idx, 1)}
                      disabled={idx === lineas.length - 1 || bloqueada}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      title="Bajar"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>

                  <div className="flex-1 space-y-2">
                    {/* v1.2.28: layout flex-wrap como en gastos. Columna codigo
                        + concepto/autocomplete con min-w-[200px] para que el
                        nombre del producto se vea aunque la pantalla sea
                        estrecha. El codigo se autorrellena al elegir producto
                        del autocomplete; tambien se puede teclear y, al salir
                        del campo, buscar el producto. */}
                    <div className="flex gap-2 items-start flex-wrap">
                      <div className="w-24 shrink-0">
                        <input
                          className={inputCls + ' font-mono'}
                          placeholder="Código"
                          title="Código del producto (opcional). Al salir del campo busca en el catálogo y rellena concepto, IVA y precio."
                          value={l.codigo ?? ''}
                          disabled={bloqueada}
                          onChange={(e) => patchLineaLocal(l.id, { codigo: e.target.value })}
                          onBlur={async (e) => {
                            const c = (e.target.value || '').trim();
                            if (!c || !window.api?.productos) return;
                            try {
                              const p = await window.api.productos.getByCodigo(c);
                              if (!p) return;
                              const tarifaId = Number(cliente?.tarifa_aplicar) || 0;
                              const tarifaCol = tarifaId >= 1 && tarifaId <= 4
                                ? `tarifa_${tarifaId}` : null;
                              const precioTarifa = tarifaCol
                                ? (Number(p[tarifaCol]) || 0)
                                : 0;
                              const precioBase = Number(p.precio_venta ?? p.precio_unitario) || 0;
                              const precioFinal = precioTarifa > 0 ? precioTarifa : precioBase;
                              const cant = Number(l.cantidad) || 1;
                              patchLineaLocal(l.id, {
                                codigo: p.codigo || c,
                                titulo: p.nombre || l.titulo,
                                descripcion: p.descripcion || l.descripcion,
                                iva_pct: p.iva_pct == null ? l.iva_pct : p.iva_pct,
                                importe: precioFinal !== 0
                                  ? Math.round(precioFinal * cant * 100) / 100
                                  : l.importe,
                              });
                            } catch { /* noop */ }
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        {/* v1.2.31: autocomplete SIEMPRE, sin gate por tipo_negocio.
                            Antes se ocultaba en empresas de 'servicios' (la
                            madre en empresa Jose-pintor no veia sugerencias
                            aunque hubiese productos creados). Si no hay
                            productos en la empresa, el dropdown sale vacio:
                            no estorba. */}
                        <ProductoAutocomplete
                          className={inputCls + ' font-medium'}
                          placeholder="Concepto o busca producto (nombre o #código)"
                          value={l.titulo}
                          disabled={bloqueada}
                          onChange={(v) => patchLineaLocal(l.id, { titulo: v })}
                          onSelectProducto={(p) => {
                            // v1.2.24: aplicar la tarifa marcada en la ficha
                            // del cliente. Si el cliente no tiene tarifa o el
                            // producto no la tiene rellenada (=0), caemos a
                            // precio_venta / precio_unitario por compat.
                            const tarifaId = Number(cliente?.tarifa_aplicar) || 0;
                            const tarifaCol = tarifaId >= 1 && tarifaId <= 4
                              ? `tarifa_${tarifaId}` : null;
                            const precioTarifa = tarifaCol
                              ? (Number(p[tarifaCol]) || 0)
                              : 0;
                            const precioBase = Number(p.precio_venta ?? p.precio_unitario) || 0;
                            const precioFinal = precioTarifa > 0 ? precioTarifa : precioBase;
                            const cant = Number(l.cantidad) || 1;
                            patchLineaLocal(l.id, {
                              titulo: p.nombre,
                              codigo: p.codigo || '',
                              descripcion: p.descripcion || l.descripcion,
                              iva_pct: p.iva_pct == null ? l.iva_pct : p.iva_pct,
                              importe: precioFinal !== 0
                                ? Math.round(precioFinal * cant * 100) / 100
                                : l.importe,
                              // v1.5.0: guardar producto_id para auto-descuento
                              // de deposito + traducciones nombre_en/desc_en.
                              producto_id: p.id || null,
                            });
                          }}
                        />
                      </div>
                      <div className="w-14 shrink-0">
                        <input
                          type="number"
                          onFocus={(e) => e.target.select()}
                          step="0.01"
                          min="0"
                          className={inputCls + ' text-right'}
                          placeholder="Cant."
                          title="Cantidad (uds). El precio se mantiene; el importe = cantidad × precio."
                          value={Number(l.cantidad) || 1}
                          disabled={bloqueada}
                          onChange={(e) => {
                            const v = e.target.value;
                            const nuevaCant = v === '' ? 1 : Number(v) || 1;
                            const oldCant = Number(l.cantidad) || 1;
                            const importeNuevo = oldCant !== 0
                              ? Math.round(Number(l.importe || 0) * (nuevaCant / oldCant) * 100) / 100
                              : Number(l.importe) || 0;
                            patchLineaLocal(l.id, {
                              cantidad: nuevaCant,
                              importe: importeNuevo,
                            });
                          }}
                        />
                      </div>
                      {/* v1.2.24: precio unitario visible + editable. */}
                      <div className="w-24 shrink-0">
                        <div className="relative">
                          <input
                            type="number"
                            onFocus={(e) => e.target.select()}
                            step="0.01"
                            min="0"
                            className={inputCls + ' pr-7 text-right'}
                            placeholder="Precio ud"
                            title="Precio por unidad (sin IVA). Cambiarlo recalcula el importe (cant × precio)."
                            value={(() => {
                              const cant = Number(l.cantidad) || 1;
                              if (cant === 0) return 0;
                              return Math.round((Number(l.importe || 0) / cant) * 100) / 100;
                            })()}
                            disabled={bloqueada}
                            onChange={(e) => {
                              const v = e.target.value;
                              const nuevoPrecio = v === '' ? 0 : Number(v) || 0;
                              const cant = Number(l.cantidad) || 1;
                              const importeNuevo = Math.round(nuevoPrecio * cant * 100) / 100;
                              patchLineaLocal(l.id, { importe: importeNuevo });
                            }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                            €
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <IvaPicker
                          value={l.iva_pct}
                          defaultPct={cab.iva_porcentaje}
                          disabled={bloqueada}
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
                            disabled={bloqueada}
                            onChange={(e) => {
                              const v = e.target.value;
                              patchLineaLocal(l.id, {
                                descuento_valor: v === '' ? 0 : Number(v) || 0,
                              });
                            }}
                          />
                          <button
                            type="button"
                            disabled={bloqueada}
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
                      <div className="w-20 shrink-0">
                        <select
                          className={
                            inputCls +
                            ' text-center px-1 ' +
                            (Number(l.diana_pct) > 0 ? 'bg-fuchsia-50 font-semibold text-fuchsia-700' : '')
                          }
                          value={Number(l.diana_pct) || 0}
                          onChange={(e) =>
                            cambiarDianaPctLinea(l.id, Number(e.target.value) || 0)
                          }
                          title={
                            bloqueada
                              ? 'Solo afecta a la Cuenta Diana (interno). No modifica la factura ni su PDF.'
                              : 'Porcentaje de esta línea (sobre base imponible) que cuenta para la cuenta interna de Diana'
                          }
                        >
                          <option value={0}>—</option>
                          <option value={50}>D 50%</option>
                          <option value={100}>D 100%</option>
                        </select>
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
                            disabled={bloqueada}
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
                      rows={2}
                      className={inputCls}
                      placeholder="Descripción larga del trabajo o producto (SÍ aparece en el PDF, debajo del concepto)"
                      value={l.descripcion ?? ''}
                      disabled={bloqueada}
                      onChange={(e) =>
                        patchLineaLocal(l.id, { descripcion: e.target.value })
                      }
                    />

                    {cab.modo_detallado && (
                      <LineaSubitems
                        lineaId={l.id}
                        kind="factura"
                        subitems={subs}
                        disabled={bloqueada}
                        onChange={(newSubs) => updateLineaSubs(l.id, newSubs)}
                      />
                    )}
                  </div>

                  <button
                    onClick={() => deleteLinea(l.id)}
                    disabled={bloqueada}
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
                disabled={bloqueada}
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
                  disabled={bloqueada}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCabField('descuento_valor', v === '' ? 0 : Number(v) || 0);
                  }}
                />
                <button
                  type="button"
                  disabled={bloqueada}
                  onClick={() => setCabField(
                    'descuento_tipo', cab.descuento_tipo === 'eur' ? 'pct' : 'eur',
                  )}
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
              {totales.irpfPct > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>Retención IRPF {totales.irpfPct}%</span>
                  <span>− {formatEUR(totales.irpf)}</span>
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
              disabled={bloqueada}
              onChange={(e) => setCabField('notas', e.target.value)}
            />
          </section>

          {/* Notas para el cliente (publicas) — aparecen en el PDF */}
          <section className="bg-white rounded-lg shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-1">
              Notas en la factura (cliente)
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Lo que escribas aquí <strong>sí aparece en el PDF</strong>, debajo de los totales.
              Útil para condiciones de pago, agradecimientos o instrucciones.
            </p>
            <textarea
              rows={3}
              className={inputCls}
              placeholder="Ej. Gracias por su confianza. Pago a 30 días por transferencia."
              value={cab.notas_publicas || ''}
              disabled={bloqueada}
              onChange={(e) => setCabField('notas_publicas', e.target.value)}
            />
          </section>

          {/* Cobros recibidos. Solo info interna: el modelo 130/303 sigue
              calculandose sobre devengo (factura emitida = declarada). */}
          {!loading && facturaId > 0 && (
            <CobrosSection
              facturaId={facturaId}
              totalFactura={totales.total}
              onSugerirCobrada={() => onChangeEstado('cobrada')}
              onCobrosChange={setCobros}
            />
          )}

          {/* Adjuntos: archivos asociados a la factura. NO se incluyen en el PDF. */}
          {!loading && facturaId > 0 && (
            <AdjuntosSection
              parentType="factura"
              parentId={facturaId}
              disabled={bloqueada}
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

      {showAEAT && (
        <ExportAEATModal
          factura={{ ...cab, id: facturaId }}
          lineas={lineas}
          cliente={cliente}
          settings={settings}
          onClose={() => setShowAEAT(false)}
        />
      )}
      {showHolded && (
        <ExportHoldedModal
          factura={{ ...cab, id: facturaId }}
          lineas={lineas}
          cliente={cliente}
          onClose={() => setShowHolded(false)}
        />
      )}
      {showFacturae && (
        <ExportFacturaeModal
          factura={{ ...cab, id: facturaId }}
          lineas={lineas}
          cliente={cliente}
          settings={settings}
          onClose={() => setShowFacturae(false)}
        />
      )}
      {showRecurrencia && (
        <RecurrenciaModal
          tipo="factura"
          sourceId={facturaId}
          sourceLabel={`Factura ${cab.numero || ''}`}
          existing={recurrencia}
          onClose={() => setShowRecurrencia(false)}
          onSaved={(r) => setRecurrencia(r)}
        />
      )}
      {showPreviewModal && (
        <PDFPreviewModal
          pdfBlob={pdfBlob}
          title={`Factura ${cab.numero || ''}`}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
      {showImportarModal && (
        <ImportarPresupuestoModal
          clienteId={cab.cliente_id}
          onConfirm={importarLineasPresupuesto}
          onCancel={() => setShowImportarModal(false)}
        />
      )}
      {showConvertirProforma && (
        <ConvertirProformaModal
          proforma={{
            numero: cab.numero,
            cliente_nombre: cliente?.nombre || null,
            serie: cab.serie,
          }}
          series={settings?.series_facturas_list || [{ id: 'A', label: 'General' }]}
          defaultSerie={cab.serie || 'A'}
          onConfirm={convertirProformaActual}
          onCancel={() => setShowConvertirProforma(false)}
        />
      )}
    </div>
  );
}

export default FacturaEditor;
