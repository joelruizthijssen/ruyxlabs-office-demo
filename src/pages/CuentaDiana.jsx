// Pagina "Cuenta interna de Diana" (socio). NO es un documento fiscal —
// es una cuenta corriente para liquidar la comision mensual de un socio
// sobre las facturas y gastos marcados con `diana_pct` por linea.
//
// Modelo:
//   - Cada linea de factura/gasto puede llevar diana_pct (0/50/100) en su
//     base imponible. La pagina suma esos importes y calcula el saldo.
//   - Los pagos a Diana se registran aqui (tabla pagos_diana) para cuadrar
//     el saldo cuando ella factura un importe parcial cada mes.
//   - El saldo del mes anterior se arrastra al actual automaticamente.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calculator, Plus, Trash2, ChevronLeft, ChevronRight, Calendar, Save, Pencil,
  FileDown, ArrowLeftRight, Lock,
} from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { formatEUR, formatFechaES } from '../utils/format.js';
import { useToast } from '../components/Toast.jsx';
import CuentaDianaPDF from '../pdf/CuentaDianaPDF.jsx';
import CuentaDianaListadoPDF from '../pdf/CuentaDianaListadoPDF.jsx';
import { IS_FAMILY_BUILD } from '../utils/variant.js';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function CuentaDiana() {
  const toast = useToast();
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth()); // 0-11
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modo: 'mes' (default) o 'custom' (rango libre con date pickers).
  const [modo, setModo] = useState('mes');
  const [customDesde, setCustomDesde] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [customHasta, setCustomHasta] = useState(ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)));

  // Form para registrar nuevo pago a Diana.
  const [pagoForm, setPagoForm] = useState({
    fecha: ymd(now),
    importe: '',
    notas: '',
  });
  const [pagoSaving, setPagoSaving] = useState(false);

  // Saldo inicial manual de la empresa activa (heredado de Excel viejo).
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [editandoSaldo, setEditandoSaldo] = useState(false);
  const [saldoInicialDraft, setSaldoInicialDraft] = useState('');

  // Export PDF
  const [exportando, setExportando] = useState(false);

  // Modal listado de facturas pendientes de cobro (click en card "Ventas pendientes").
  const [pendientesOpen, setPendientesOpen] = useState(false);

  // Modal listado generico para ventas cobradas / gastos compartidos / pagos Diana.
  // tipo: null | 'ventas_cobradas' | 'gastos' | 'pagos'.
  const [listadoTipo, setListadoTipo] = useState(null);
  // Modal breakdown del saldo del periodo (click en card SALDO DEL PERIODO).
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Cierres de periodo (v1.2.23). Solo guardamos ultimo cierre como marker
  // visual + un mini modal para crear nuevos.
  const [ultimoCierre, setUltimoCierre] = useState(null);
  const [cerrarOpen, setCerrarOpen] = useState(false);
  const [cerrarForm, setCerrarForm] = useState({ fecha: ymd(now), notas: '' });
  const [cerrarSaving, setCerrarSaving] = useState(false);

  // Modal de movimiento interno (solo build family).
  const [movModalOpen, setMovModalOpen] = useState(false);
  const [movForm, setMovForm] = useState({
    fecha: ymd(now),
    concepto: '',
    importe: '',
    quien: 'D',
  });
  const [movSaving, setMovSaving] = useState(false);

  const desde = useMemo(() => {
    if (modo === 'custom') return customDesde;
    return `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
  }, [modo, customDesde, anio, mes]);
  const hasta = useMemo(() => {
    if (modo === 'custom') return customHasta;
    const lastDay = new Date(anio, mes + 1, 0).getDate();
    return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }, [modo, customHasta, anio, mes]);

  const cargar = useCallback(async () => {
    if (!window.api?.informes?.diana) return;
    setLoading(true);
    setError(null);
    try {
      const r = await window.api.informes.diana({ desde, hasta });
      if (r?.error) setError(r.error);
      else setData(r);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Cargar saldo inicial al montar y al cambiar empresa.
  const cargarSaldoInicial = useCallback(async () => {
    if (!window.api?.diana?.saldoInicialGet) return;
    try {
      const res = await window.api.diana.saldoInicialGet();
      if (res?.error) return;
      setSaldoInicial(Number(res?.valor) || 0);
    } catch { /* noop */ }
  }, []);
  const cargarUltimoCierre = useCallback(async () => {
    if (!window.api?.diana?.cierresUltimo) return;
    try {
      const c = await window.api.diana.cierresUltimo();
      setUltimoCierre(c && !c.error ? c : null);
    } catch { /* noop */ }
  }, []);
  useEffect(() => {
    cargarSaldoInicial();
    cargarUltimoCierre();
    const onEmpresaChange = () => { cargarSaldoInicial(); cargarUltimoCierre(); cargar(); };
    window.addEventListener('empresa-changed', onEmpresaChange);
    return () => window.removeEventListener('empresa-changed', onEmpresaChange);
  }, [cargarSaldoInicial, cargarUltimoCierre, cargar]);

  async function guardarSaldoInicial() {
    const v = Number(saldoInicialDraft);
    if (!Number.isFinite(v)) {
      toast.error('Importe inválido');
      return;
    }
    try {
      const res = await window.api.diana.saldoInicialSet(v);
      if (res?.error) { toast.error(res.error); return; }
      setSaldoInicial(Number(res?.valor) || 0);
      setEditandoSaldo(false);
      toast.success('Saldo inicial actualizado');
      cargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  function prevMes() {
    if (mes === 0) { setMes(11); setAnio((y) => y - 1); }
    else setMes((m) => m - 1);
  }
  function nextMes() {
    if (mes === 11) { setMes(0); setAnio((y) => y + 1); }
    else setMes((m) => m + 1);
  }

  async function registrarPago() {
    const importe = Number(pagoForm.importe);
    if (!pagoForm.fecha) { toast.error('Fecha obligatoria'); return; }
    if (!importe || importe <= 0) { toast.error('Importe debe ser mayor que 0'); return; }
    setPagoSaving(true);
    try {
      const res = await window.api.pagosDiana.create({
        fecha: pagoForm.fecha,
        importe,
        notas: pagoForm.notas || null,
      });
      if (res?.error) { toast.error(res.error); return; }
      toast.success('Pago a Diana registrado');
      setPagoForm({ fecha: ymd(new Date()), importe: '', notas: '' });
      cargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setPagoSaving(false);
    }
  }

  async function exportarPdf() {
    if (!data) { toast.error('Esperando carga de datos…'); return; }
    setExportando(true);
    try {
      // Necesitamos el nombre/NIF de la empresa activa para la cabecera.
      let empresa = {};
      try {
        const s = await window.api.settings.get();
        if (s && !s.error) {
          empresa = { nombre: s.emisor_nombre, nif: s.emisor_nif };
        }
      } catch { /* noop */ }
      const blob = await pdf(
        <CuentaDianaPDF informe={data} meta={{ empresa, saldoInicial }} />,
      ).toBlob();
      const buf = new Uint8Array(await blob.arrayBuffer());
      const label = modo === 'custom'
        ? `${desde}_a_${hasta}`
        : `${MESES[mes]}_${anio}`;
      const sugName = `Cuenta_Diana_${label}.pdf`;
      const res = await window.api.pdf.saveInforme(sugName, buf);
      if (res?.canceled) return;
      if (res?.error) { toast.error(res.error); return; }
      toast.success('PDF guardado');
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setExportando(false);
    }
  }

  async function eliminarPago(pagoId) {
    if (!confirm('¿Eliminar este pago a Diana?')) return;
    try {
      const res = await window.api.pagosDiana.delete(pagoId);
      if (res?.error) toast.error(res.error);
      else cargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  function abrirNuevoMovimiento() {
    setMovForm({
      fecha: ymd(new Date()),
      concepto: '',
      importe: '',
      quien: 'D',
    });
    setMovModalOpen(true);
  }

  async function guardarMovimiento() {
    const importe = Number(movForm.importe);
    if (!movForm.fecha) { toast.error('Fecha obligatoria'); return; }
    if (!importe || importe <= 0) { toast.error('Importe debe ser mayor que 0'); return; }
    if (!movForm.concepto.trim()) { toast.error('Indica un concepto'); return; }
    setMovSaving(true);
    try {
      const res = await window.api.diana.ajustesCreate({
        fecha: movForm.fecha,
        concepto: movForm.concepto.trim(),
        importe,
        quien: movForm.quien,
      });
      if (res?.error) { toast.error(res.error); return; }
      toast.success('Movimiento registrado');
      setMovModalOpen(false);
      cargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setMovSaving(false);
    }
  }

  async function eliminarMovimiento(movId) {
    if (!confirm('¿Eliminar este movimiento interno?')) return;
    try {
      const res = await window.api.diana.ajustesDelete(movId);
      if (res?.error) toast.error(res.error);
      else cargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  function abrirCerrarPeriodo() {
    setCerrarForm({ fecha: hasta, notas: '' });
    setCerrarOpen(true);
  }

  async function guardarCierre() {
    if (!cerrarForm.fecha) { toast.error('Fecha obligatoria'); return; }
    setCerrarSaving(true);
    try {
      const res = await window.api.diana.cierresCreate({
        fecha: cerrarForm.fecha,
        notas: cerrarForm.notas || null,
      });
      if (res?.error) { toast.error(res.error); return; }
      toast.success(`Periodo cerrado a fecha ${formatFechaES(cerrarForm.fecha)}`);
      setCerrarOpen(false);
      cargarUltimoCierre();
      cargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setCerrarSaving(false);
    }
  }

  // Genera el PDF de una sublista de Cuenta Diana (ventas cobradas, gastos
  // compartidos o pagos Diana). `cfg` define titulo + columnas + filas + total.
  async function exportarSublistaPdf(cfg) {
    try {
      let empresa = {};
      try {
        const s = await window.api.settings.get();
        if (s && !s.error) empresa = { nombre: s.emisor_nombre, nif: s.emisor_nif };
      } catch { /* noop */ }
      const periodoLabel = modo === 'custom'
        ? `${formatFechaES(desde)} – ${formatFechaES(hasta)}`
        : `${MESES[mes]} ${anio}`;
      const blob = await pdf(
        <CuentaDianaListadoPDF
          titulo={cfg.titulo}
          periodo={periodoLabel}
          empresa={empresa}
          filas={cfg.filas}
          columnas={cfg.columnas}
          total={cfg.total}
          totalLabel={cfg.totalLabel}
        />,
      ).toBlob();
      const buf = new Uint8Array(await blob.arrayBuffer());
      const label = modo === 'custom' ? `${desde}_a_${hasta}` : `${MESES[mes]}_${anio}`;
      const sugName = `${cfg.slug}_${label}.pdf`;
      const res = await window.api.pdf.saveInforme(sugName, buf);
      if (res?.canceled) return;
      if (res?.error) { toast.error(res.error); return; }
      toast.success('PDF guardado');
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function deshacerUltimoCierre() {
    if (!ultimoCierre) return;
    if (!confirm(`¿Eliminar el cierre del ${formatFechaES(ultimoCierre.fecha)}?`)) return;
    try {
      const res = await window.api.diana.cierresDelete(ultimoCierre.id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Cierre eliminado');
        cargarUltimoCierre();
        cargar();
      }
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  const filas = data?.filas || [];
  const totales = data?.totales || {};

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-fuchsia-100 text-fuchsia-700">
          <Calculator size={22} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Cuenta interna de Diana</h1>
          <p className="text-sm text-slate-500">
            Liquidación de la comisión. Cuentan aquí las líneas marcadas con
            "D 50% / 100%" (Ellen paga, Diana le debe → resta saldo) o "E 50% / 100%"
            (Diana paga, Ellen le debe → suma saldo). Vista interna, NO fiscal.
          </p>
        </div>
      </div>

      {/* Selector de periodo: mes natural (default) o rango personalizado */}
      <div className="flex flex-wrap items-center gap-3 mb-5 mt-5">
        {modo === 'mes' ? (
          <>
            <button
              onClick={prevMes}
              className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-sm font-semibold text-slate-800 min-w-[160px] text-center">
              {MESES[mes]} {anio}
            </div>
            <button
              onClick={nextMes}
              className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setModo('custom')}
              className="ml-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50"
              title="Elegir un rango de fechas arbitrario"
            >
              <Calendar size={14} /> Rango personalizado
            </button>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-2">
              <label className="text-xs text-slate-500">Desde</label>
              <input
                type="date"
                className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                value={customDesde}
                onChange={(e) => setCustomDesde(e.target.value)}
              />
            </div>
            <div className="inline-flex items-center gap-2">
              <label className="text-xs text-slate-500">Hasta</label>
              <input
                type="date"
                className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                value={customHasta}
                onChange={(e) => setCustomHasta(e.target.value)}
              />
            </div>
            <button
              onClick={() => setModo('mes')}
              className="ml-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50"
            >
              ← Volver a mes natural
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={abrirCerrarPeriodo}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm"
            title="Marca este periodo como cerrado (guarda fecha y saldo). El proximo periodo arranca al dia siguiente."
          >
            <Lock size={14} /> Cerrar periodo
          </button>
          {IS_FAMILY_BUILD && (
            <button
              type="button"
              onClick={abrirNuevoMovimiento}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm"
              title="Apuntar consumo de stock compartido por Diana o Ellen"
            >
              <ArrowLeftRight size={14} /> Nuevo movimiento
            </button>
          )}
          <button
            type="button"
            onClick={exportarPdf}
            disabled={exportando || !data}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm disabled:opacity-50"
            title="Generar PDF con los totales y movimientos del periodo seleccionado"
          >
            <FileDown size={14} />
            {exportando ? 'Generando…' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {ultimoCierre && (
        <div className="mb-4 px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm flex items-center gap-3">
          <Lock size={14} className="text-slate-500 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">Ultimo cierre:</span>{' '}
            {formatFechaES(ultimoCierre.fecha)} ·{' '}
            <span className="text-slate-600">Saldo al cierre: <strong>{formatEUR(ultimoCierre.saldo_al_cierre)}</strong></span>
            {ultimoCierre.notas && <span className="text-slate-500 italic ml-2">"{ultimoCierre.notas}"</span>}
          </div>
          <button
            type="button"
            onClick={deshacerUltimoCierre}
            className="text-xs text-slate-500 hover:text-red-600"
            title="Eliminar este cierre"
          >
            Deshacer
          </button>
        </div>
      )}

      {/* Banner: ventas pendientes (no entran en el saldo hasta cobrarlas).
          Click → modal con listado de facturas pendientes. */}
      {(data?.totales?.ventas_pendiente || 0) > 0 && (
        <button
          type="button"
          onClick={() => setPendientesOpen(true)}
          className="mb-4 w-full text-left px-4 py-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm flex items-start gap-2 hover:bg-amber-100"
          title="Ver listado de facturas pendientes de cobro"
        >
          <div className="font-bold text-base shrink-0">⚠</div>
          <div className="flex-1">
            <div className="font-semibold">
              Pendiente por cobrar (no entra aún en el saldo):
              {' '}{formatEUR(data.totales.ventas_pendiente)}
            </div>
            <div className="text-xs mt-0.5">
              Click para ver el listado · Estos importes se sumarán al saldo
              de Diana cuando marques las facturas como <strong>cobradas</strong>.
            </div>
          </div>
        </button>
      )}

      {/* Resumen — totales del mes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Card
          label="Ventas (cobradas)"
          value={totales.ventas_realizado}
          subtitle="Ya cobrado este mes (click para listado)"
          tone="emerald"
          onClick={() => setListadoTipo('ventas_cobradas')}
        />
        <Card
          label="Ventas pendientes"
          value={totales.ventas_pendiente}
          subtitle="Facturas aún no cobradas (click para listado)"
          tone="amber"
          onClick={() => setPendientesOpen(true)}
        />
        <Card
          label="Gastos compartidos"
          value={totales.compras_realizado}
          subtitle="D resta · E suma (click para listado)"
          tone="red"
          onClick={() => setListadoTipo('gastos')}
        />
        <Card
          label="Pagos a Diana"
          value={-(totales.pagos_realizados || 0)}
          subtitle="Lo que ya le has pagado (click para listado)"
          tone="violet"
          onClick={() => setListadoTipo('pagos')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <Card
          label="Saldo arrastrado"
          value={totales.saldo_arrastrado}
          subtitle="Saldo al final del periodo anterior"
          tone="slate"
        />
        <Card
          label="Saldo del periodo"
          value={totales.saldo_periodo}
          subtitle="Movimientos de este periodo (click para desglose)"
          tone="slate"
          onClick={() => setBreakdownOpen(true)}
        />
        <Card
          label="SALDO ACTUAL"
          value={totales.saldo_final}
          subtitle="Positivo = le debes a Diana"
          tone="brand"
          big
        />
      </div>

      {/* Saldo inicial manual — editable. Heredado del Excel viejo. */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">
            Saldo inicial heredado (ajuste manual)
          </div>
          <p className="text-[12px] text-slate-500 mt-0.5 max-w-xl">
            Importe que Ellen le debía a Diana antes de empezar a usar la app
            (por ejemplo, deuda heredada del Excel viejo). Se suma al saldo
            arrastrado en todos los periodos. Positivo = Ellen debe a Diana.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editandoSaldo ? (
            <>
              <div className="text-xl font-bold tabular-nums text-slate-800 min-w-[100px] text-right">
                {formatEUR(saldoInicial)}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSaldoInicialDraft(String(saldoInicial));
                  setEditandoSaldo(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm"
              >
                <Pencil size={14} /> Editar
              </button>
            </>
          ) : (
            <>
              <input
                type="number"
                step="0.01"
                autoFocus
                onFocus={(e) => e.target.select()}
                className="w-32 px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand"
                value={saldoInicialDraft}
                onChange={(e) => setSaldoInicialDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') guardarSaldoInicial();
                  if (e.key === 'Escape') setEditandoSaldo(false);
                }}
              />
              <button
                type="button"
                onClick={guardarSaldoInicial}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-brand hover:bg-brand-dark text-white text-sm"
              >
                <Save size={14} /> Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditandoSaldo(false)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Detalle de movimientos */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Movimientos del mes
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-left text-xs uppercase tracking-wide">
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Concepto</th>
              <th className="px-4 py-2 font-medium text-right">Base</th>
              <th className="px-4 py-2 font-medium text-right">Diana</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Cargando…</td></tr>
            ) : filas.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No hay movimientos de Diana este mes.</td></tr>
            ) : (
              filas.map((f, idx) => (
                <tr key={`${f.tipo}-${f.ref_id}-${idx}`} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-700">{formatFechaES(f.fecha)}</td>
                  <td className="px-4 py-2">
                    <TipoBadge tipo={f.tipo} />
                  </td>
                  <td className="px-4 py-2 text-slate-800">
                    <div>
                      {f.ref_numero && <span className="text-slate-500 mr-2">{f.ref_numero}</span>}
                      {f.concepto || '—'}
                    </div>
                    {f.notas && (
                      <div className="text-[11px] text-slate-500 italic mt-0.5">
                        {f.notas}
                      </div>
                    )}
                    {f.tipo === 'venta' && f.realizado && f.fecha_emision && f.fecha_emision !== f.fecha && (
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Emitida {formatFechaES(f.fecha_emision)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                    {f.tipo === 'pago_diana' ? '' : formatEUR(f.base_imponible || 0)}
                  </td>
                  <td className={
                    'px-4 py-2 text-right tabular-nums font-semibold ' +
                    ((f.diana_importe || 0) >= 0 ? 'text-emerald-700' : 'text-red-600')
                  }>
                    {formatEUR(f.diana_importe || 0)}
                  </td>
                  <td className="px-4 py-2">
                    {f.tipo === 'venta' && (
                      f.realizado
                        ? <span className="text-[10px] uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Cobrada</span>
                        : <span className="text-[10px] uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Pendiente</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {f.tipo === 'pago_diana' && (
                      <button
                        onClick={() => eliminarPago(f.pago_id)}
                        className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar pago"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {f.tipo === 'movimiento' && IS_FAMILY_BUILD && (
                      <button
                        onClick={() => eliminarMovimiento(f.ref_id)}
                        className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar movimiento"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Form: registrar pago a Diana */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">
          Registrar pago a Diana
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Cuando le pagas a Diana (en efectivo, transferencia, etc.) regístralo aquí
          para que se descuente del saldo. Si Diana te emite una factura, recuérdate de
          crearla aparte en Gastos (con proveedor = Diana) — eso es fiscal y vive aparte.
        </p>
        <div className="grid grid-cols-[140px_140px_1fr_auto] gap-2 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">Fecha</label>
            <input
              type="date"
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              value={pagoForm.fecha}
              onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">Importe (€)</label>
            <input
              type="number"
              onFocus={(e) => e.target.select()}
              step="0.01"
              min="0"
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand"
              value={pagoForm.importe}
              placeholder="0.00"
              onChange={(e) => setPagoForm({ ...pagoForm, importe: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">Notas (opcional)</label>
            <input
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              value={pagoForm.notas}
              placeholder="Ej: Comisión mayo 2026"
              onChange={(e) => setPagoForm({ ...pagoForm, notas: e.target.value })}
            />
          </div>
          <button
            type="button"
            onClick={registrarPago}
            disabled={pagoSaving}
            className="px-3 py-1.5 rounded bg-brand hover:bg-brand-dark text-white text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus size={14} /> Añadir pago
          </button>
        </div>
      </div>

      {IS_FAMILY_BUILD && movModalOpen && (
        <MovimientoModal
          form={movForm}
          setForm={setMovForm}
          saving={movSaving}
          onSave={guardarMovimiento}
          onClose={() => setMovModalOpen(false)}
        />
      )}

      {pendientesOpen && (
        <PendientesModal
          pendientes={data?.pendientes || []}
          onClose={() => setPendientesOpen(false)}
          onOpenFactura={(id) => {
            setPendientesOpen(false);
            window.location.hash = `#/facturas/${id}`;
          }}
        />
      )}

      {cerrarOpen && (
        <CerrarPeriodoModal
          form={cerrarForm}
          setForm={setCerrarForm}
          saving={cerrarSaving}
          onSave={guardarCierre}
          onClose={() => setCerrarOpen(false)}
        />
      )}

      {listadoTipo && (
        <SublistaModal
          tipo={listadoTipo}
          filas={data?.filas || []}
          onClose={() => setListadoTipo(null)}
          onExportPdf={exportarSublistaPdf}
        />
      )}

      {breakdownOpen && (
        <SaldoBreakdownModal
          totales={data?.totales || {}}
          onClose={() => setBreakdownOpen(false)}
        />
      )}
    </div>
  );
}

// Modal generico para los 3 listados (ventas cobradas, gastos compartidos,
// pagos a Diana). Boton 'Guardar PDF' arriba a la derecha.
function SublistaModal({ tipo, filas, onClose, onExportPdf }) {
  const cfg = (() => {
    if (tipo === 'ventas_cobradas') {
      const items = filas.filter((f) => f.tipo === 'venta' && f.realizado);
      const total = items.reduce((s, f) => s + (Number(f.diana_importe) || 0), 0);
      return {
        titulo: 'Ventas (cobradas)',
        slug: 'Ventas_cobradas_Diana',
        items,
        total,
        totalLabel: 'Cuota Diana total',
        columnas: [
          { key: 'fecha', label: 'Fecha', width: 70, format: 'fecha' },
          { key: 'ref_numero', label: 'Nº', width: 80 },
          { key: 'concepto', label: 'Cliente' },
          { key: 'base_imponible', label: 'Base', width: 70, align: 'right', format: 'eur' },
          { key: 'diana_importe', label: 'Cuota Diana', width: 80, align: 'right', format: 'eur' },
        ],
      };
    }
    if (tipo === 'gastos') {
      const items = filas.filter((f) => f.tipo === 'gasto');
      const total = items.reduce((s, f) => s + (Number(f.diana_importe) || 0), 0);
      return {
        titulo: 'Gastos compartidos',
        slug: 'Gastos_compartidos_Diana',
        items,
        total,
        totalLabel: 'Total al saldo Diana',
        columnas: [
          { key: 'fecha', label: 'Fecha', width: 70, format: 'fecha' },
          { key: 'concepto', label: 'Proveedor' },
          { key: 'base_imponible', label: 'Base', width: 70, align: 'right', format: 'eur' },
          { key: 'diana_importe', label: 'Impacto saldo', width: 90, align: 'right', format: 'eur' },
        ],
      };
    }
    // pagos
    const items = filas.filter((f) => f.tipo === 'pago_diana');
    const total = items.reduce((s, f) => s + Math.abs(Number(f.diana_importe) || 0), 0);
    return {
      titulo: 'Pagos a Diana',
      slug: 'Pagos_a_Diana',
      items,
      total,
      totalLabel: 'Total pagado',
      columnas: [
        { key: 'fecha', label: 'Fecha', width: 90, format: 'fecha' },
        { key: 'concepto', label: 'Concepto / Notas' },
        { key: 'importeAbs', label: 'Importe', width: 90, align: 'right', format: 'eur' },
      ],
    };
  })();
  // Para "pagos" el importe está en negativo internamente; lo presentamos en positivo.
  const itemsConImporteAbs = tipo === 'pagos'
    ? cfg.items.map((f) => ({ ...f, importeAbs: Math.abs(Number(f.diana_importe) || 0) }))
    : cfg.items;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">{cfg.titulo}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {cfg.items.length} movimientos · {cfg.totalLabel}: <strong>{formatEUR(cfg.total)}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onExportPdf({
                titulo: cfg.titulo,
                slug: cfg.slug,
                filas: itemsConImporteAbs,
                columnas: cfg.columnas,
                total: cfg.total,
                totalLabel: cfg.totalLabel,
              })}
              className="px-3 py-1.5 rounded bg-brand hover:bg-brand-dark text-white text-sm inline-flex items-center gap-1.5"
              title="Guardar este listado como PDF"
            >
              <FileDown size={14} /> Guardar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 rounded text-slate-400 hover:bg-slate-100"
            >✕</button>
          </div>
        </div>
        <div className="overflow-auto flex-1">
          {cfg.items.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500 text-center">
              No hay movimientos en este listado para el periodo seleccionado.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-left text-xs sticky top-0">
                <tr>
                  {cfg.columnas.map((c, i) => (
                    <th
                      key={i}
                      className={
                        'px-4 py-2 font-medium ' +
                        (c.align === 'right' ? 'text-right' : '')
                      }
                      style={c.width ? { width: c.width + 30 } : undefined}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itemsConImporteAbs.map((f, idx) => (
                  <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                    {cfg.columnas.map((c, i) => {
                      const v = f[c.key];
                      const text = v == null || v === ''
                        ? '—'
                        : c.format === 'fecha'
                          ? formatFechaES(v)
                          : c.format === 'eur'
                            ? formatEUR(v)
                            : String(v);
                      return (
                        <td
                          key={i}
                          className={
                            'px-4 py-2 ' +
                            (c.align === 'right' ? 'text-right tabular-nums' : 'text-slate-700') +
                            (c.key === 'diana_importe' ? ' font-semibold' : '')
                          }
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// Modal que explica como se llega al saldo del periodo, desglosado por bucket.
function SaldoBreakdownModal({ totales, onClose }) {
  const ventasR = Number(totales.ventas_realizado) || 0;
  const compras = Number(totales.compras_realizado) || 0; // ya negativo
  const ajustes = Number(totales.ajustes_realizados) || 0; // signed
  const pagos = Number(totales.pagos_realizados) || 0;
  const saldo = Number(totales.saldo_periodo) || 0;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Desglose del saldo del periodo</h3>
            <p className="text-xs text-slate-500 mt-1">
              Como se calcula el saldo del periodo a partir de los movimientos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded text-slate-400 hover:bg-slate-100"
          >✕</button>
        </div>
        <div className="p-5 space-y-2 text-sm">
          <DesgloseRow label="Ventas cobradas" value={ventasR} hint="Cuota Diana de facturas cobradas" />
          <DesgloseRow label="Gastos compartidos" value={compras} hint="Convención: D suma negativo, E suma positivo" />
          {ajustes !== 0 && (
            <DesgloseRow label="Movimientos internos" value={ajustes} hint="Stock compartido (D resta, E suma)" />
          )}
          <DesgloseRow label="Pagos a Diana" value={-pagos} hint="Lo que ya le has pagado este periodo" />
          <div className="border-t border-slate-300 pt-3 mt-3 flex items-center justify-between">
            <span className="font-semibold text-slate-800">SALDO DEL PERIODO</span>
            <span className={'text-xl font-bold tabular-nums ' + (saldo >= 0 ? 'text-emerald-700' : 'text-red-600')}>
              {formatEUR(saldo)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Saldo actual = saldo arrastrado + saldo del periodo.
          </p>
        </div>
      </div>
    </div>
  );
}

function DesgloseRow({ label, value, hint }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-slate-700">{label}</div>
        {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
      </div>
      <div className={'tabular-nums font-semibold ' + (value >= 0 ? 'text-emerald-700' : 'text-red-600')}>
        {value >= 0 ? '+' : ''}{formatEUR(value)}
      </div>
    </div>
  );
}

function CerrarPeriodoModal({ form, setForm, saving, onSave, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">Cerrar periodo</h3>
          <p className="text-xs text-slate-500 mt-1">
            Guardamos la fecha y el saldo a esa fecha. El proximo periodo arranca
            al dia siguiente. No bloquea nada: si editas facturas/gastos del
            periodo cerrado, el saldo se recalcula como siempre.
          </p>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Fecha de cierre</label>
            <input
              type="date"
              autoFocus
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Notas (opcional)</label>
            <input
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              value={form.notas}
              placeholder="Ej: Pagado a Diana en efectivo"
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1.5 rounded bg-brand hover:bg-brand-dark text-white text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Lock size={14} /> Cerrar periodo
          </button>
        </div>
      </div>
    </div>
  );
}

function PendientesModal({ pendientes, onClose, onOpenFactura }) {
  const total = pendientes.reduce((s, p) => s + (Number(p.diana_importe) || 0), 0);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">
              Facturas pendientes de cobro
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {pendientes.length} facturas · Total a Diana cuando se cobren: <strong>{formatEUR(total)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded text-slate-400 hover:bg-slate-100"
          >✕</button>
        </div>
        <div className="overflow-auto flex-1">
          {pendientes.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500 text-center">
              No hay facturas pendientes de cobro con cuota Diana.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-left text-xs sticky top-0">
                <tr>
                  <th className="px-4 py-2 font-medium">Nº</th>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">Cliente</th>
                  <th className="px-4 py-2 font-medium text-right">Base</th>
                  <th className="px-4 py-2 font-medium text-right">Cobrado</th>
                  <th className="px-4 py-2 font-medium text-right">Cuota Diana</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-800">{p.numero}</td>
                    <td className="px-4 py-2 text-slate-600">{formatFechaES(p.fecha)}</td>
                    <td className="px-4 py-2 text-slate-700 truncate max-w-[200px]" title={p.cliente_nombre}>
                      {p.cliente_nombre || '—'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                      {formatEUR(p.base_imponible)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                      {formatEUR(p.cobrado || 0)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-700">
                      {formatEUR(p.diana_importe)}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => onOpenFactura(p.id)}
                        className="px-2 py-1 rounded text-xs border border-slate-300 text-slate-700 hover:bg-slate-100"
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function MovimientoModal({ form, setForm, saving, onSave, onClose }) {
  const esDiana = form.quien === 'D';
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">Nuevo movimiento interno</h3>
          <p className="text-xs text-slate-500 mt-1">
            Consumo de stock compartido sin factura ni gasto. Ajusta el saldo de Diana
            directamente.
          </p>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">¿Quién se llevó el material?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, quien: 'D' })}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold ${esDiana ? 'bg-fuchsia-100 border-fuchsia-400 text-fuchsia-800' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Diana (resta saldo)
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, quien: 'E' })}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold ${!esDiana ? 'bg-amber-100 border-amber-400 text-amber-800' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Ellen (suma saldo)
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Fecha</label>
            <input
              type="date"
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Concepto</label>
            <input
              autoFocus
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              value={form.concepto}
              placeholder="Ej: 2 latas de pintura blanca"
              onChange={(e) => setForm({ ...form, concepto: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Importe (€)</label>
            <input
              type="number"
              onFocus={(e) => e.target.select()}
              step="0.01"
              min="0"
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand"
              value={form.importe}
              placeholder="0.00"
              onChange={(e) => setForm({ ...form, importe: e.target.value })}
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1.5 rounded bg-brand hover:bg-brand-dark text-white text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save size={14} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, subtitle, tone = 'slate', big = false, onClick }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    red:     'bg-red-50 text-red-700 border-red-200',
    violet:  'bg-violet-50 text-violet-700 border-violet-200',
    slate:   'bg-white text-slate-700 border-slate-200',
    brand:   'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-300',
  };
  const content = (
    <>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className={(big ? 'text-2xl' : 'text-lg') + ' font-bold tabular-nums mt-1'}>
        {formatEUR(value || 0)}
      </div>
      {subtitle && <div className="text-[11px] opacity-70 mt-0.5">{subtitle}</div>}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`border rounded-lg p-3 text-left transition-colors hover:brightness-95 ${tones[tone] || tones.slate}`}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={`border rounded-lg p-3 ${tones[tone] || tones.slate}`}>
      {content}
    </div>
  );
}

function TipoBadge({ tipo }) {
  if (tipo === 'venta') {
    return <span className="text-[10px] uppercase tracking-wide text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Venta</span>;
  }
  if (tipo === 'gasto') {
    return <span className="text-[10px] uppercase tracking-wide text-red-700 bg-red-100 px-1.5 py-0.5 rounded">Gasto</span>;
  }
  if (tipo === 'pago_diana') {
    return <span className="text-[10px] uppercase tracking-wide text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">Pago Diana</span>;
  }
  if (tipo === 'movimiento') {
    return <span className="text-[10px] uppercase tracking-wide text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">Movimiento</span>;
  }
  return null;
}

export default CuentaDiana;
