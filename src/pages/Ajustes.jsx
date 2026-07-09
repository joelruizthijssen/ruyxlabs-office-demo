import { useEffect, useState } from 'react';
import { TEMPLATES } from '../pdf/templates/index.js';
import TemplateThumb from '../components/TemplateThumb.jsx';
import SeriesEditor from '../components/SeriesEditor.jsx';
import MarcasManager from '../components/MarcasManager.jsx';
import LicenseSection from '../components/LicenseSection.jsx';
import EmpresaModal from '../components/EmpresaModal.jsx';
import { useToast } from '../components/Toast.jsx';
import {
  APP_VERSION,
  APP_TAGLINE,
  COMPANY_NAME,
  COMPANY_WEB,
  COPYRIGHT_YEAR,
} from '../utils/appInfo.js';
import { IS_PRIVATE_BUILD } from '../utils/variant.js';

const inputCls =
  'w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

const FIELDS = [
  'emisor_nombre',
  'emisor_nif',
  'emisor_direccion',
  'emisor_telefono',
  'emisor_email',
  'emisor_iban',
  'iva_default',
  'texto_legal',
  'ciudad_emision',
  'numeracion_factura_anio',
  'numeracion_factura_siguiente',
  'numeracion_presupuesto_anio',
  'numeracion_presupuesto_siguiente',
  'brand_color',
  'plantilla',
  'marcar_borrador',
  'emisor_cp',
  'emisor_ciudad',
  'emisor_provincia',
  'emisor_pais',
  'emisor_swift',
  // Multi-empresa: preferencias globales (vista_combinada, empresa_activa_id)
  // + datos de la empresa activa (tipo_empresa, tipo_negocio).
  'vista_combinada',
  'empresa_activa_id',
  'tipo_empresa',
  'tipo_negocio',
  'ocultar_emisor',
  // Notificaciones (umbrales + kinds desactivados como CSV).
  'notif_dias_factura_sin_cobrar',
  'notif_dias_presupuesto_sin_respuesta',
  'notif_dias_borrador_estancado',
  'notif_dias_cierre_trimestral_aviso',
  'notif_disabled_kinds',
  // v1.2.48: nombres personalizables de las 4 tarifas de compra a proveedores.
  'tarifa_compra_1_label',
  'tarifa_compra_2_label',
  'tarifa_compra_3_label',
  'tarifa_compra_4_label',
];

// Campos array (series). Se manejan aparte: en pickEditable se leen de
// `<col>_list` (que ya viene parseado del backend) y en isDirty/guardar se
// comparan/serializan como JSON.
const ARRAY_FIELDS = [
  { form: 'series_facturas',     readFrom: 'series_facturas_list' },
  { form: 'series_presupuestos', readFrom: 'series_presupuestos_list' },
];

// Layout del membrete: objeto JSON con margenes + toggles. Se persiste como
// JSON string en settings.membrete_layout; el backend devuelve `membrete_layout_parsed`
// con los defaults aplicados.
const MEMBRETE_FIELDS = [
  { form: 'membrete_layout', readFrom: 'membrete_layout_parsed' },
];

function pickEditable(row) {
  if (!row) return {};
  const out = {};
  for (const k of FIELDS) out[k] = row[k] ?? '';
  for (const a of ARRAY_FIELDS) {
    out[a.form] = Array.isArray(row[a.readFrom]) ? row[a.readFrom] : [];
  }
  for (const m of MEMBRETE_FIELDS) {
    out[m.form] = row[m.readFrom] || {};
  }
  return out;
}

function isDirty(a, b) {
  for (const k of FIELDS) {
    if ((a[k] ?? '') !== (b[k] ?? '')) return true;
  }
  for (const a2 of ARRAY_FIELDS) {
    if (JSON.stringify(a[a2.form] || []) !== JSON.stringify(b[a2.form] || [])) {
      return true;
    }
  }
  for (const m of MEMBRETE_FIELDS) {
    if (JSON.stringify(a[m.form] || {}) !== JSON.stringify(b[m.form] || {})) {
      return true;
    }
  }
  return false;
}

function Ajustes() {
  const toast = useToast();
  const [form, setForm] = useState({});
  const [original, setOriginal] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedOk, setSavedOk] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [firmaUrl, setFirmaUrl] = useState(null);
  const [uploadingFirma, setUploadingFirma] = useState(false);
  const [membreteUrl, setMembreteUrl] = useState(null);
  const [uploadingMembrete, setUploadingMembrete] = useState(false);
  // Objeto crudo de settings — para pasar a LicenseSection que necesita
  // license_key/email/plan/validated_at sin tener que duplicar campos en
  // FIELDS (no son editables desde el form general).
  const [rawSettings, setRawSettings] = useState(null);
  // --- Multi-empresa ---
  const [empresasList, setEmpresasList] = useState([]);
  const [showNuevaEmpresa, setShowNuevaEmpresa] = useState(false);

  async function refrescarEmpresas() {
    if (!window.api) return;
    try {
      const list = await window.api.empresas.list();
      setEmpresasList(Array.isArray(list) ? list : []);
    } catch { /* noop */ }
  }

  async function cargar() {
    if (!window.api) {
      setError('window.api no disponible. ¿Estás ejecutando la app dentro de Electron?');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await window.api.settings.get();
      if (res && res.error) {
        setError(res.error);
      } else {
        const data = pickEditable(res);
        setForm(data);
        setOriginal(data);
        setLogoUrl(res?.logo_data_url || null);
        setFirmaUrl(res?.firma_data_url || null);
        setMembreteUrl(res?.membrete_data_url || null);
        setRawSettings(res || null);
      }
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    refrescarEmpresas();
    const onEmpresa = () => { cargar(); refrescarEmpresas(); };
    window.addEventListener('empresa-changed', onEmpresa);
    return () => window.removeEventListener('empresa-changed', onEmpresa);
  }, []);

  async function cambiarEmpresaActiva(id) {
    if (!window.api) return;
    try {
      await window.api.empresas.setActive(id);
      window.dispatchEvent(new CustomEvent('settings-changed'));
      window.dispatchEvent(new CustomEvent('empresa-changed'));
      window.dispatchEvent(new CustomEvent('data-changed'));
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function duplicarEmpresaActiva() {
    if (!window.api) return;
    const id = rawSettings?.empresa_activa_id;
    if (!id) return;
    try {
      const nueva = await window.api.empresas.duplicate(id);
      await window.api.empresas.setActive(nueva.id);
      toast.success(`Duplicada como "${nueva.nombre}". Edita los datos antes de usarla.`);
      window.dispatchEvent(new CustomEvent('settings-changed'));
      window.dispatchEvent(new CustomEvent('empresa-changed'));
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function eliminarEmpresaActiva() {
    if (!window.api) return;
    const id = rawSettings?.empresa_activa_id;
    if (!id) return;
    const activa = empresasList.find((e) => e.id === id);
    // v1.2.26: pedir conteo antes de borrar para que el usuario sepa qué
    // datos quedan ocultos. Doble confirmación si hay datos dentro.
    let info = null;
    try {
      info = await window.api.empresas.info(id);
    } catch { /* si falla, seguimos con confirm clasico */ }
    const lineas = [];
    lineas.push(`¿Eliminar la empresa "${activa?.nombre || '(sin nombre)'}"?`);
    lineas.push('');
    if (info && (info.facturas || info.gastos || info.clientes || info.presupuestos)) {
      lineas.push('CONTIENE:');
      if (info.facturas) lineas.push(`  • ${info.facturas} factura(s)`);
      if (info.presupuestos) lineas.push(`  • ${info.presupuestos} presupuesto(s)`);
      if (info.gastos) lineas.push(`  • ${info.gastos} gasto(s)`);
      if (info.clientes) lineas.push(`  • ${info.clientes} cliente(s)`);
      lineas.push('');
      lineas.push('Los datos NO se borran — quedan ocultos (puedes recuperarla).');
    } else {
      lineas.push('Está vacía, se puede eliminar sin riesgo.');
    }
    if (!confirm(lineas.join('\n'))) return;
    // Doble confirmación SOLO si tiene datos.
    if (info && (info.facturas || info.gastos)) {
      if (!confirm(`Última confirmación: vas a ocultar ${info.facturas + info.gastos} documento(s) fiscales. ¿Seguro?`)) return;
    }
    try {
      await window.api.empresas.delete(id);
      toast.success('Empresa eliminada');
      window.dispatchEvent(new CustomEvent('settings-changed'));
      window.dispatchEvent(new CustomEvent('empresa-changed'));
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  // v1.2.26: escape hatch manual. Si la migración del UNIQUE compuesto falló
  // en su BD, esto al menos hace que el siguiente número de factura intente
  // arrancar en 2026/01 (luego el resolver bumpea si choca globalmente).
  async function reiniciarCorrelativoActiva(tipo) {
    if (!window.api) return;
    const id = rawSettings?.empresa_activa_id;
    if (!id) return;
    const activa = empresasList.find((e) => e.id === id);
    const t = tipo === 'presupuesto' ? 'presupuesto' : 'factura';
    if (!confirm(
      `¿Reiniciar el correlativo de ${t}s de "${activa?.nombre}"?\n\n`
      + `El próximo ${t} intentará empezar en ${new Date().getFullYear()}/01.\n`
      + `(Si la numeración choca globalmente con otra empresa, saltará al primer libre.)`,
    )) return;
    try {
      await window.api.empresas.resetCorrelativo(id, t);
      toast.success(`Correlativo de ${t}s reiniciado`);
      window.dispatchEvent(new CustomEvent('settings-changed'));
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  // v1.2.27: renumerar todos los BORRADORES de serie A desde 01. Util si la
  // empresa nueva quedo con facturas en 06/07/... porque el resolver bumpeo
  // globalmente cuando la migracion fallo. Solo toca borradores (las emitidas
  // son inmutables fiscalmente).
  async function renumerarBorradoresActiva(tipo) {
    if (!window.api) return;
    const id = rawSettings?.empresa_activa_id;
    if (!id) return;
    const activa = empresasList.find((e) => e.id === id);
    const t = tipo === 'presupuesto' ? 'presupuesto' : 'factura';
    if (!confirm(
      `Renumerar TODOS los ${t}s en BORRADOR de "${activa?.nombre}" desde el 01?\n\n`
      + `Solo afecta a documentos en estado 'borrador'. Las emitidas/cobradas\n`
      + `NO se tocan (son inmutables fiscalmente).\n\n`
      + `Si tienes un ${t} 2026/06 en borrador, pasará a 2026/01 (o al primer\n`
      + `numero libre saltando los ya emitidos).`,
    )) return;
    try {
      const r = await window.api.empresas.renumerarBorradores(id, t);
      if (r?.error) { toast.error(r.error); return; }
      toast.success(`Renumeradas ${r.renumeradas} ${t}(s) desde 01`);
      window.dispatchEvent(new CustomEvent('settings-changed'));
      window.dispatchEvent(new CustomEvent('empresa-changed'));
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function verLogMigracion() {
    if (!window.api?.mig) return;
    try {
      const r = await window.api.mig.numeroLog();
      if (!r?.exists) {
        toast.info('No hay log de migración (la migración no se ha ejecutado).');
        return;
      }
      // Mostramos en una ventana propia (popup nativo del SO).
      const w = window.open('', '_blank');
      if (w) {
        w.document.title = 'Log de migración (numeración)';
        w.document.body.style.fontFamily = 'monospace';
        w.document.body.style.whiteSpace = 'pre-wrap';
        w.document.body.style.padding = '20px';
        w.document.body.textContent = `Archivo: ${r.path}\n\n${r.text}`;
      } else {
        alert(`Log en:\n${r.path}\n\n${r.text.slice(-3000)}`);
      }
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function guardar() {
    setError(null);
    setSavedOk(false);
    setSaving(true);
    try {
      // Convertir numericos antes de mandar.
      const payload = { ...form };
      payload.iva_default =
        payload.iva_default === '' ? null : Number(payload.iva_default);
      for (const k of [
        'numeracion_factura_anio',
        'numeracion_factura_siguiente',
        'numeracion_presupuesto_anio',
        'numeracion_presupuesto_siguiente',
      ]) {
        payload[k] = payload[k] === '' ? null : Number(payload[k]);
      }
      const res = await window.api.settings.update(payload);
      if (res && res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      const data = pickEditable(res);
      setForm(data);
      setOriginal(data);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
      toast.success('Ajustes guardados');
      // Notifica al Sidebar (y a quien escuche) por si cambio el logo o color.
      window.dispatchEvent(new CustomEvent('settings-changed'));
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  // --- Logo: upload / remove ---
  async function onPickLogo(file) {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      setError('Formato no soportado. Usa PNG o JPG.');
      setTimeout(() => setError(null), 4000);
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('El archivo es muy grande. Máximo 4 MB.');
      setTimeout(() => setError(null), 4000);
      return;
    }
    setUploadingLogo(true);
    setError(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const ext = file.name.split('.').pop().toLowerCase();
      const res = await window.api.settings.setLogo(buf, ext);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setLogoUrl(res?.logo_data_url || null);
      toast.success('Logo actualizado');
      window.dispatchEvent(new CustomEvent('settings-changed'));
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(e.message ?? String(e));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function quitarLogo() {
    if (!confirm('¿Quitar el logo actual?')) return;
    setError(null);
    try {
      const res = await window.api.settings.removeLogo();
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setLogoUrl(null);
      toast.success('Logo eliminado');
      window.dispatchEvent(new CustomEvent('settings-changed'));
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(e.message ?? String(e));
    }
  }

  // --- Firma escaneada: upload / remove (mismo patron que el logo) ---
  async function onPickFirma(file) {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      toast.error('Formato no soportado. Usa PNG o JPG.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error('El archivo es muy grande. Máximo 4 MB.');
      return;
    }
    setUploadingFirma(true);
    setError(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const ext = file.name.split('.').pop().toLowerCase();
      const res = await window.api.settings.setFirma(buf, ext);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setFirmaUrl(res?.firma_data_url || null);
      toast.success('Firma actualizada');
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setUploadingFirma(false);
    }
  }

  async function quitarFirma() {
    if (!confirm('¿Quitar la firma actual?')) return;
    try {
      const res = await window.api.settings.removeFirma();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setFirmaUrl(null);
      toast.success('Firma eliminada');
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  // --- Membrete personalizado: upload / remove (mismo patron) ---
  async function onPickMembrete(file) {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      toast.error('Formato no soportado. Usa PNG o JPG.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Demasiado grande. Máx 8 MB.');
      return;
    }
    setUploadingMembrete(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const ext = file.name.split('.').pop().toLowerCase();
      const res = await window.api.settings.setMembrete(buf, ext);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setMembreteUrl(res?.membrete_data_url || null);
      toast.success('Membrete actualizado');
      window.dispatchEvent(new CustomEvent('settings-changed'));
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setUploadingMembrete(false);
    }
  }

  async function quitarMembrete() {
    if (!confirm('¿Quitar el membrete actual? La plantilla "Personalizada" dejará de estar disponible.')) return;
    try {
      const res = await window.api.settings.removeMembrete();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setMembreteUrl(null);
      toast.success('Membrete eliminado');
      window.dispatchEvent(new CustomEvent('settings-changed'));
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  function setLayout(patch) {
    setForm((f) => ({
      ...f,
      membrete_layout: { ...(f.membrete_layout || {}), ...patch },
    }));
  }

  // --- Copia de seguridad ---
  const [backupMsg, setBackupMsg] = useState(null);

  async function exportarBackup() {
    setBackupMsg(null);
    setError(null);
    try {
      const res = await window.api.backup.export();
      if (res?.canceled) return;
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setBackupMsg(`Copia guardada en: ${res.path}`);
      setTimeout(() => setBackupMsg(null), 6000);
      toast.success('Copia de seguridad exportada');
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(e.message ?? String(e));
    }
  }

  async function importarBackup() {
    const ok = confirm(
      'Importar una copia reemplazará TODOS los datos actuales (clientes, presupuestos, facturas, ajustes, ' +
      'logo, firma, membrete y adjuntos). Los datos actuales se guardarán como respaldo automático con la fecha. ' +
      'La app se reiniciará para aplicar la copia. ¿Continuar?',
    );
    if (!ok) return;
    setBackupMsg(null);
    setError(null);
    try {
      const res = await window.api.backup.import();
      if (res?.canceled) return;
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Copia preparada. Reiniciando la app…');
      // Pequenya espera para que el toast sea visible antes del relaunch.
      setTimeout(() => {
        window.api.app?.relaunch();
      }, 800);
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(e.message ?? String(e));
    }
  }

  const [resetting, setResetting] = useState(false);

  async function resetDatosPrueba() {
    const paso1 = confirm(
      'Esto BORRARÁ de forma permanente todas las facturas, presupuestos, ' +
      'gastos y recurrencias de la empresa activa, y reiniciará la ' +
      'numeración a 1.\n\n' +
      'Los clientes, productos y marcas se conservan.\n\n' +
      'Está pensado para usarlo UNA vez, antes de empezar a trabajar de ' +
      'verdad (para eliminar lo que hayas creado probando). ¿Continuar?',
    );
    if (!paso1) return;
    const paso2 = confirm(
      'Última confirmación: esta acción NO se puede deshacer.\n\n' +
      'Si tienes datos reales, exporta antes una copia de seguridad.\n\n' +
      '¿Borrar los datos de prueba y reiniciar la numeración ahora?',
    );
    if (!paso2) return;
    setResetting(true);
    setError(null);
    try {
      const res = await window.api.settings.resetPrueba();
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Datos de prueba borrados. Numeración reiniciada a 1.');
      window.dispatchEvent(new CustomEvent('data-changed'));
      await cargar();
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(e.message ?? String(e));
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-slate-800 mb-2">Ajustes</h1>
        <p className="text-slate-500">Cargando…</p>
      </div>
    );
  }

  const dirty = isDirty(form, original);

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold text-slate-800 mb-6">Ajustes</h1>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {savedOk && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
          Cambios guardados
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg p-8 space-y-10">
        {/* 0-pre) Empresa activa (multi-empresa v1.15) */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">
            Empresa actual
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Si trabajas con varios negocios o empresas (ej: tu actividad como
            autónomo + una S.L. propia + las marcas de un familiar), cambia
            aquí cuál estás editando. Cada empresa tiene sus propios datos,
            logo, plantilla, numeración y facturas/presupuestos.
          </p>

          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <label className={labelCls}>Empresa</label>
              <select
                className={inputCls + ' bg-white'}
                value={rawSettings?.empresa_activa_id || ''}
                onChange={(e) => cambiarEmpresaActiva(Number(e.target.value))}
              >
                {empresasList.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre || '(sin nombre)'} — {e.tipo === 'empresa' ? 'Empresa' : 'Autónomo'}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setShowNuevaEmpresa(true)}
              className="px-3 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm"
            >
              + Nueva
            </button>
            <button
              type="button"
              onClick={duplicarEmpresaActiva}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm"
              title="Crear una copia de la empresa activa"
            >
              Duplicar
            </button>
            <button
              type="button"
              onClick={eliminarEmpresaActiva}
              className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-sm"
              disabled={empresasList.length <= 1}
              title={empresasList.length <= 1 ? 'No puedes eliminar la única empresa' : 'Eliminar esta empresa'}
            >
              Eliminar
            </button>
          </div>

          <label className="mt-4 flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 rounded text-brand focus:ring-brand"
              checked={!!form.vista_combinada}
              onChange={(e) => setField('vista_combinada', e.target.checked ? 1 : 0)}
            />
            <div>
              <div className="text-sm font-medium text-slate-800">
                Vista combinada
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Cuando está activa, las listas de clientes, presupuestos,
                facturas, gastos y recurrencias muestran TODAS las empresas a
                la vez. Útil si quieres ver el negocio entero junto. La
                numeración sigue siendo independiente por empresa.
              </p>
            </div>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Identidad fiscal</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setField('tipo_empresa', 'autonomo')}
                  className={
                    'px-3 py-2 rounded-lg border text-sm transition-colors ' +
                    ((form.tipo_empresa || 'autonomo') === 'autonomo'
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')
                  }
                >
                  Autónomo
                </button>
                <button
                  type="button"
                  onClick={() => setField('tipo_empresa', 'empresa')}
                  className={
                    'px-3 py-2 rounded-lg border text-sm transition-colors ' +
                    (form.tipo_empresa === 'empresa'
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')
                  }
                >
                  Empresa (S.L., S.A.…)
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Tipo de negocio</label>
              <select
                className={inputCls + ' bg-white'}
                value={form.tipo_negocio || 'servicios'}
                onChange={(e) => setField('tipo_negocio', e.target.value)}
              >
                <option value="servicios">Servicios</option>
                <option value="productos">Venta de productos</option>
                <option value="mixto">Mixto (ambos)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                "Servicios" oculta la pestaña Productos del menú.
              </p>
            </div>
          </div>
        </section>

        {/* 0) Diseño: logo + color principal */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Diseño
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            Personaliza la apariencia de tus presupuestos y facturas. Escoge
            una plantilla, un color principal y sube tu logo. El color se
            aplica automáticamente a la decoración de cada plantilla.
          </p>

          <div className="grid grid-cols-2 gap-6">
            {/* Color principal */}
            <div>
              <label className={labelCls}>Color principal</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="h-10 w-16 rounded cursor-pointer border border-slate-300"
                  value={form.brand_color || '#1abc9c'}
                  onChange={(e) => setField('brand_color', e.target.value)}
                />
                <input
                  type="text"
                  className={inputCls + ' font-mono'}
                  placeholder="#1abc9c"
                  value={form.brand_color || ''}
                  onChange={(e) => setField('brand_color', e.target.value)}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Recuerda pulsar "Guardar cambios" abajo para aplicar el color al PDF.
              </p>
            </div>

            {/* Plantilla */}
            <div className="col-span-2">
              <label className={labelCls}>Plantilla del PDF</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
                {TEMPLATES.map((t) => {
                  const active = (form.plantilla || 'bandas') === t.id;
                  const blocked = t.requiereMembrete && !membreteUrl;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => !blocked && setField('plantilla', t.id)}
                      disabled={blocked}
                      title={blocked ? 'Sube primero un membrete en la sección Membrete personalizado' : undefined}
                      className={
                        'text-left p-2 rounded-lg border-2 transition-all ' +
                        (blocked
                          ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                          : active
                            ? 'border-brand ring-2 ring-brand/20 bg-brand/5'
                            : 'border-slate-200 hover:border-slate-300 bg-white')
                      }
                    >
                      <TemplateThumb
                        id={t.id}
                        color={form.brand_color || '#1abc9c'}
                        membreteUrl={membreteUrl}
                      />
                      <div className="mt-2 text-sm font-medium text-slate-800">
                        {t.label}
                      </div>
                      <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                        {t.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Aplica a presupuestos y facturas. Pulsa "Guardar cambios" para confirmar.
              </p>
            </div>

            {/* Logo */}
            <div>
              <label className={labelCls}>Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 border border-slate-300 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400 text-center px-2">
                      Sin logo
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label
                    className={
                      'inline-block px-3 py-2 rounded-lg border border-slate-300 text-sm cursor-pointer hover:bg-slate-50 ' +
                      (uploadingLogo ? 'opacity-50 pointer-events-none' : '')
                    }
                  >
                    {uploadingLogo ? 'Subiendo…' : (logoUrl ? 'Cambiar logo' : 'Subir logo')}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = ''; // permite re-elegir el mismo archivo
                        onPickLogo(f);
                      }}
                    />
                  </label>
                  {logoUrl && (
                    <button
                      onClick={quitarLogo}
                      className="block text-sm text-red-600 hover:text-red-700"
                    >
                      Quitar logo
                    </button>
                  )}
                  <p className="text-xs text-slate-500">PNG o JPG. Máx 4 MB.</p>
                </div>
              </div>
            </div>

            {/* Firma escaneada */}
            <div>
              <label className={labelCls}>Firma escaneada</label>
              <div className="flex items-center gap-4">
                <div className="w-40 h-20 border border-slate-300 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">
                  {firmaUrl ? (
                    <img
                      src={firmaUrl}
                      alt="Firma"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400 text-center px-2">
                      Sin firma
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label
                    className={
                      'inline-block px-3 py-2 rounded-lg border border-slate-300 text-sm cursor-pointer hover:bg-slate-50 ' +
                      (uploadingFirma ? 'opacity-50 pointer-events-none' : '')
                    }
                  >
                    {uploadingFirma ? 'Subiendo…' : (firmaUrl ? 'Cambiar firma' : 'Subir firma')}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        onPickFirma(f);
                      }}
                    />
                  </label>
                  {firmaUrl && (
                    <button
                      onClick={quitarFirma}
                      className="block text-sm text-red-600 hover:text-red-700"
                    >
                      Quitar firma
                    </button>
                  )}
                  <p className="text-xs text-slate-500">
                    PNG con fondo transparente recomendado. Aparecerá debajo del bloque emisor en el PDF.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Membrete personalizado */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">
            Membrete personalizado
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Sube una imagen A4 con tu diseño propio. La plantilla{' '}
            <strong>Personalizada</strong> la usará como fondo y dibujará los
            datos del documento encima.
          </p>

          {/* Guia rapida: pautas para que el membrete funcione bien. La gente
              suele subir capturas o imagenes muy decoradas que tapan el centro
              — este bloque previene esos errores antes de subir. */}
          <div className="mb-5 flex items-start gap-3 p-4 rounded-lg border border-brand/20 bg-brand/[0.04]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-brand shrink-0 mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div className="text-sm text-slate-700 space-y-1.5">
              <div className="font-semibold text-slate-800">
                Pautas para que tu membrete quede bien
              </div>
              <ul className="space-y-1 text-slate-600 list-disc list-inside marker:text-brand/60">
                <li>
                  Formato <strong>A4 vertical</strong> (proporción 1:1.41),
                  PNG o JPG.
                </li>
                <li>
                  Resolución recomendada:{' '}
                  <strong>1240×1754 px</strong> (150dpi) o{' '}
                  <strong>2480×3508 px</strong> (300dpi). Máx 8&nbsp;MB.
                </li>
                <li>
                  <strong>Deja la zona central vacía.</strong> Ahí se dibujarán
                  el título, emisor, cliente, las líneas y los totales.
                </li>
                <li>
                  Pon tu decoración (logo, bandas, líneas) en{' '}
                  <strong>cabecera, pie o esquinas</strong>, no en el medio.
                </li>
                <li>
                  Si tu membrete ya incluye tu logo o tus datos, desactiva las
                  casillas “Dibujar logo” o “Dibujar emisor” en{' '}
                  <strong>Qué dibujar encima</strong> para no duplicarlos.
                </li>
                <li>
                  Ajusta los <strong>márgenes seguros</strong> abajo si la
                  decoración choca con el contenido del documento.
                </li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-4 mb-5">
            <div
              className="w-32 border border-slate-300 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden"
              style={{ aspectRatio: '1 / 1.41' }}
            >
              {membreteUrl ? (
                <img
                  src={membreteUrl}
                  alt="Membrete"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-400 text-center px-2">
                  Sin membrete
                </span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <label
                className={
                  'inline-block px-3 py-2 rounded-lg border border-slate-300 text-sm cursor-pointer hover:bg-slate-50 ' +
                  (uploadingMembrete ? 'opacity-50 pointer-events-none' : '')
                }
              >
                {uploadingMembrete ? 'Subiendo…' : (membreteUrl ? 'Cambiar membrete' : 'Subir membrete')}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    onPickMembrete(f);
                  }}
                />
              </label>
              {membreteUrl && (
                <button
                  onClick={quitarMembrete}
                  className="block text-sm text-red-600 hover:text-red-700"
                >
                  Quitar membrete
                </button>
              )}
              <p className="text-xs text-slate-500">PNG/JPG. Máx 8 MB.</p>
            </div>
          </div>

          {membreteUrl && (
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">
                  Áreas seguras (márgenes en pt)
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Espacio reservado a los bordes para que tu diseño y los datos
                  no se solapen. A4 mide 595 × 842pt.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['margen_top', 'Arriba'],
                    ['margen_bottom', 'Abajo'],
                    ['margen_left', 'Izquierda'],
                    ['margen_right', 'Derecha'],
                  ].map(([k, label]) => (
                    <div key={k}>
                      <label className="block text-xs text-slate-600 mb-1">{label}</label>
                      <input
                        type="number" onFocus={(e) => e.target.select()}
                        min={0}
                        max={400}
                        className={inputCls}
                        value={form.membrete_layout?.[k] ?? 0}
                        onChange={(e) =>
                          setLayout({ [k]: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">
                  Qué dibujar encima
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Si tu membrete ya incluye tu logo y datos, desactívalos
                  para no duplicarlos.
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-brand focus:ring-brand"
                      checked={!!form.membrete_layout?.incluye_emisor}
                      onChange={(e) =>
                        setLayout({ incluye_emisor: e.target.checked })
                      }
                    />
                    <span className="text-sm text-slate-700">
                      Dibujar bloque de emisor (nombre + NIF + dirección)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-brand focus:ring-brand"
                      checked={form.membrete_layout?.incluye_logo !== false}
                      onChange={(e) =>
                        setLayout({ incluye_logo: e.target.checked })
                      }
                    />
                    <span className="text-sm text-slate-700">
                      Dibujar logo (el general de Ajustes)
                    </span>
                  </label>
                  <div className="pt-2">
                    <label className="block text-xs text-slate-600 mb-1">
                      Color de texto principal
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        className="h-9 w-14 rounded cursor-pointer border border-slate-300"
                        value={form.membrete_layout?.color_texto || '#1a1a1a'}
                        onChange={(e) => setLayout({ color_texto: e.target.value })}
                      />
                      <input
                        type="text"
                        className={inputCls + ' font-mono flex-1'}
                        value={form.membrete_layout?.color_texto || ''}
                        onChange={(e) => setLayout({ color_texto: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 1) Datos del autonomo */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Datos del autónomo
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Nombre</label>
              <input
                className={inputCls}
                value={form.emisor_nombre || ''}
                onChange={(e) => setField('emisor_nombre', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>NIF</label>
              <input
                className={inputCls}
                value={form.emisor_nif || ''}
                onChange={(e) => setField('emisor_nif', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input
                className={inputCls}
                value={form.emisor_telefono || ''}
                onChange={(e) => setField('emisor_telefono', e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Dirección</label>
              <input
                className={inputCls}
                value={form.emisor_direccion || ''}
                onChange={(e) => setField('emisor_direccion', e.target.value)}
                placeholder="C/ Mayor 12, 17251 Calonge"
              />
              <p className="text-xs text-slate-500 mt-1">
                Texto libre que aparece en el PDF.
              </p>
            </div>
            <div>
              <label className={labelCls}>CP</label>
              <input
                className={inputCls}
                value={form.emisor_cp || ''}
                onChange={(e) => setField('emisor_cp', e.target.value)}
                placeholder="17251"
                maxLength={10}
                title="Hasta 10 caracteres (códigos postales internacionales como 5705 BA)"
              />
            </div>
            <div>
              <label className={labelCls}>Ciudad</label>
              <input
                className={inputCls}
                value={form.emisor_ciudad || ''}
                onChange={(e) => setField('emisor_ciudad', e.target.value)}
                placeholder="Calonge"
              />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Provincia</label>
              <input
                className={inputCls}
                value={form.emisor_provincia || ''}
                onChange={(e) => setField('emisor_provincia', e.target.value)}
                placeholder="Girona"
              />
              <p className="text-xs text-slate-500 mt-1">
                CP, ciudad y provincia se usan al exportar a Facturae XML
                (formato oficial AEAT).
              </p>
            </div>
            <div>
              <label className={labelCls}>País</label>
              <input
                className={inputCls}
                value={form.emisor_pais || ''}
                onChange={(e) => setField('emisor_pais', e.target.value)}
                placeholder="España"
              />
              <p className="text-xs text-slate-500 mt-1">
                Se imprime en el PDF debajo del código postal y la ciudad.
                Déjalo en blanco para no mostrar país.
              </p>
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                className={inputCls}
                value={form.emisor_email || ''}
                onChange={(e) => setField('emisor_email', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>IBAN</label>
              <input
                className={inputCls}
                placeholder="ES00 0000 0000 0000 0000 0000"
                value={form.emisor_iban || ''}
                onChange={(e) => setField('emisor_iban', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>SWIFT / BIC</label>
              <input
                className={inputCls}
                placeholder="CAIXESBBXXX"
                value={form.emisor_swift || ''}
                onChange={(e) => setField('emisor_swift', e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">
                Si lo rellenas, aparece en el PDF justo debajo del IBAN
                (útil para facturas a clientes internacionales).
              </p>
            </div>
            {/* Opción de "uso interno": solo en builds privadas (family +
                primo). En la build pública este toggle no se muestra (la
                columna de BD sigue existiendo, simplemente no es accesible
                desde la UI). */}
            {IS_PRIVATE_BUILD && (
              <div className="col-span-2 mt-2 pt-3 border-t border-slate-100">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="mt-1 w-4 h-4 rounded text-brand focus:ring-brand"
                    checked={!!form.ocultar_emisor}
                    onChange={(e) =>
                      setField('ocultar_emisor', e.target.checked ? 1 : 0)
                    }
                  />
                  <span className="text-sm text-slate-700 leading-relaxed">
                    <span className="font-medium text-slate-800">
                      No mostrar mi nombre en los PDFs (uso interno)
                    </span>
                    <br />
                    <span className="text-slate-500 text-xs">
                      El nombre del emisor no aparecerá en la cabecera del PDF.
                      El resto de datos (NIF, dirección, firma) sí se mantienen.
                      Pensado para documentos de uso interno o para clientes
                      que ya conocen al emisor.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        </section>

        {/* 2) Configuracion fiscal */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Configuración fiscal
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>IVA por defecto (%)</label>
              <input
                type="number" onFocus={(e) => e.target.select()}
                step="0.01"
                className={inputCls}
                value={form.iva_default ?? ''}
                onChange={(e) => setField('iva_default', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Ciudad de emisión</label>
              <input
                className={inputCls}
                value={form.ciudad_emision || ''}
                onChange={(e) => setField('ciudad_emision', e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* 2.5) Tarifas de compra */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">
            Tarifas de compra (proveedores)
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Nombres personalizados para las 4 tarifas de compra (ej. "Nacional", "Import").
            Aparecerán en la ficha de cada proveedor y de cada producto.
            Si dejas un campo vacío se muestra "Tarifa N".
          </p>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={`tcl-${n}`}>
                <label className={labelCls}>Nombre tarifa {n}</label>
                <input
                  className={inputCls}
                  value={form[`tarifa_compra_${n}_label`] || ''}
                  placeholder={`Tarifa ${n}`}
                  onChange={(e) => setField(`tarifa_compra_${n}_label`, e.target.value)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* 3) Numeracion */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Numeración
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Año facturas</label>
              <input
                type="number" onFocus={(e) => e.target.select()}
                className={inputCls}
                value={form.numeracion_factura_anio ?? ''}
                onChange={(e) =>
                  setField('numeracion_factura_anio', e.target.value)
                }
              />
            </div>
            <div>
              <label className={labelCls}>Siguiente nº factura</label>
              <input
                type="number" onFocus={(e) => e.target.select()}
                className={inputCls}
                value={form.numeracion_factura_siguiente ?? ''}
                onChange={(e) =>
                  setField('numeracion_factura_siguiente', e.target.value)
                }
              />
            </div>
            <div>
              <label className={labelCls}>Año presupuestos</label>
              <input
                type="number" onFocus={(e) => e.target.select()}
                className={inputCls}
                value={form.numeracion_presupuesto_anio ?? ''}
                onChange={(e) =>
                  setField('numeracion_presupuesto_anio', e.target.value)
                }
              />
            </div>
            <div>
              <label className={labelCls}>Siguiente nº presupuesto</label>
              <input
                type="number" onFocus={(e) => e.target.select()}
                className={inputCls}
                value={form.numeracion_presupuesto_siguiente ?? ''}
                onChange={(e) =>
                  setField('numeracion_presupuesto_siguiente', e.target.value)
                }
              />
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-3">
            Cada documento usará el formato AÑO/Nº (ej: 2026/01) y el contador
            aumentará automáticamente al crearlo.
          </p>

          {/* v1.2.26: escape hatch para el bug "no me deja arrancar en 01"
              en empresas secundarias. Reinicia el contador a 1 y abre log de
              migración para diagnosticar si la conversión interna falló. */}
          <div className="mt-5 pt-4 border-t border-slate-200 flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={() => reiniciarCorrelativoActiva('factura')}
              className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-sm"
              title="Pone el siguiente nº factura a 1 (para esta empresa)"
            >
              Reiniciar correlativo facturas
            </button>
            <button
              type="button"
              onClick={() => reiniciarCorrelativoActiva('presupuesto')}
              className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-sm"
              title="Pone el siguiente nº presupuesto a 1 (para esta empresa)"
            >
              Reiniciar correlativo presupuestos
            </button>
            <button
              type="button"
              onClick={() => renumerarBorradoresActiva('factura')}
              className="px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-800 hover:bg-red-100 text-sm"
              title="Renombra todas las facturas EN BORRADOR de esta empresa desde 01 (no toca emitidas)"
            >
              Renumerar borradores facturas desde 01
            </button>
            <button
              type="button"
              onClick={verLogMigracion}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm"
              title="Diagnóstico: ver el log de la migración interna de numeración por empresa"
            >
              Ver log migración numeración
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Si una empresa nueva no te deja arrancar en 2026/01, pulsa
            primero <strong>Reiniciar correlativo</strong>. Si ya creaste
            facturas con números 05/06/... por error, usa <strong>Renumerar
            borradores</strong> (solo afecta a borradores). El log de
            migración tiene los detalles si algo persiste.
          </p>
        </section>

        {/* 3b) Series de facturacion */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Series
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            Las series permiten mantener numeraciones independientes.
            La serie <strong>General</strong> (A) es la que usas habitualmente.
            Añade <strong>R</strong> para rectificativas, <strong>S</strong> para
            simplificadas, etc. Cada serie distinta lleva prefijo en el número
            (ej: <span className="font-mono">R-2026/01</span>).
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Series de facturas</label>
              <SeriesEditor
                value={form.series_facturas || []}
                onChange={(arr) => setField('series_facturas', arr)}
                kind="facturas"
              />
            </div>
            <div>
              <label className={labelCls}>Series de presupuestos</label>
              <SeriesEditor
                value={form.series_presupuestos || []}
                onChange={(arr) => setField('series_presupuestos', arr)}
                kind="presupuestos"
              />
            </div>
          </div>
        </section>

        {/* 3c) Marcas (nombre comercial + logo + color por NIF) */}
        <MarcasManager />

        {/* 5) Copia de seguridad */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Copia de seguridad
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Tus datos se guardan en este ordenador. Si se rompe, los pierdes.
            Exporta una copia de vez en cuando (a un USB o a Dropbox/Drive)
            para tenerla a salvo. La copia incluye <strong>todo</strong>:
            clientes, presupuestos, facturas, ajustes, logo, firma, membrete
            y adjuntos.
          </p>

          {backupMsg && (
            <div className="mb-3 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">
              {backupMsg}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={exportarBackup}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm"
            >
              Exportar copia (.zip)
            </button>
            <button
              type="button"
              onClick={importarBackup}
              className="px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-sm"
            >
              Importar copia
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Importar reemplaza todos los datos actuales y reinicia la app. La
            copia anterior se guarda como respaldo automático en la carpeta de
            datos (con sufijo <code>.bak-…</code>). Acepta copias <code>.zip</code>{' '}
            (nuevas) y <code>.db</code> (de versiones anteriores).
          </p>
        </section>

        {/* 5b) Zona de peligro — empezar de cero (uso pre-lanzamiento) */}
        <section>
          <h2 className="text-lg font-semibold text-red-700 mb-2">
            Empezar de cero
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Si has estado <strong>probando</strong> y quieres empezar limpio:
            borra todas las facturas, presupuestos, gastos y recurrencias de la
            empresa actual y reinicia la numeración al número 1. Tus{' '}
            <strong>clientes, productos y marcas se conservan</strong>. Pensado
            para usarlo una sola vez, antes de empezar a facturar de verdad.
          </p>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800 mb-3">
              Esta acción es <strong>permanente</strong> y no se puede deshacer.
              Si ya tienes datos reales, exporta antes una copia de seguridad.
            </p>
            <button
              type="button"
              onClick={resetDatosPrueba}
              disabled={resetting}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {resetting
                ? 'Borrando…'
                : 'Borrar datos de prueba y reiniciar numeración'}
            </button>
          </div>
        </section>

        {/* 6) Activacion / license */}
        <LicenseSection
          settings={rawSettings}
          onLicenseChange={cargar}
        />

        {/* 7) Cumplimiento legal — Verifactu */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Cumplimiento legal
          </h2>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 rounded text-brand focus:ring-brand"
              checked={!!form.marcar_borrador}
              onChange={(e) =>
                setField('marcar_borrador', e.target.checked ? 1 : 0)
              }
            />
            <span className="text-sm text-slate-700 leading-relaxed">
              <span className="font-medium text-slate-800">
                Marcar PDFs de factura como borrador no fiscal
              </span>
              <br />
              <span className="text-slate-500 text-xs">
                Cuando esté activado, los PDFs llevarán marca de agua
                diagonal "BORRADOR — DOCUMENTO NO FISCAL", el título dirá
                "BORRADOR DE FACTURA" y un pie informativo dirigirá al
                sistema certificado. A partir del{' '}
                <strong>1 de julio de 2027</strong> los autónomos están
                obligados a emitir sus facturas mediante un sistema
                certificado Verifactu — actívalo cuando empieces a usar uno
                (Aplicación AEAT, Holded, BeeL, etc.).
              </span>
            </span>
          </label>
          <p className="text-xs text-slate-500 mt-3">
            Recuerda pulsar "Guardar cambios" abajo.
          </p>
        </section>

        {/* Notificaciones */}
        <NotificacionesSection form={form} setField={setField} />

        {/* 4) Texto legal */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Texto legal del pie de página
          </h2>
          <textarea
            rows={6}
            className={inputCls + ' font-mono text-sm'}
            value={form.texto_legal || ''}
            onChange={(e) => setField('texto_legal', e.target.value)}
          />
          <p className="text-sm text-slate-500 mt-3">
            Este texto aparecerá al final de cada factura y presupuesto. Edítalo
            libremente (en castellano, catalán, etc.).
          </p>
        </section>

        {/* 7) Acerca de — informativo, no editable */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Acerca de
          </h2>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
            <div className="font-semibold text-slate-800">
              Ruyx Office <span className="font-normal text-slate-500">v{APP_VERSION}</span>
            </div>
            <div className="text-slate-500 mt-0.5">{APP_TAGLINE}</div>
            <div className="mt-3 text-slate-600">
              Producto de <strong>{COMPANY_NAME}</strong>
            </div>
            <div className="text-slate-500">{COMPANY_WEB}</div>
            <div className="mt-3 text-xs text-slate-400">
              © {COPYRIGHT_YEAR} {COMPANY_NAME}. Todos los derechos reservados.
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={guardar}
          disabled={!dirty || saving}
          className={
            'px-5 py-2.5 rounded-lg text-white transition-colors ' +
            (!dirty || saving
              ? 'bg-slate-300 cursor-not-allowed'
              : 'bg-brand hover:bg-brand-dark')
          }
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      {showNuevaEmpresa && (
        <EmpresaModal
          onClose={() => setShowNuevaEmpresa(false)}
          onSaved={() => { setShowNuevaEmpresa(false); refrescarEmpresas(); }}
        />
      )}
    </div>
  );
}

// Sección de configuración de notificaciones: umbrales (días) por categoría
// y toggles para desactivar categorías que no interesen. Los valores se
// guardan en settings y se aplican en `notificaciones_listar` del backend.
function NotificacionesSection({ form, setField }) {
  const disabledCsv = String(form.notif_disabled_kinds || '');
  const disabled = new Set(disabledCsv.split(',').map((s) => s.trim()).filter(Boolean));

  function toggleKind(kind) {
    const next = new Set(disabled);
    if (next.has(kind)) next.delete(kind); else next.add(kind);
    setField('notif_disabled_kinds', Array.from(next).join(','));
  }

  const categorias = [
    { kind: 'recurrencia_pendiente',     label: 'Recurrencias pendientes',
      desc: 'Avisa cuando la próxima fecha de una recurrencia ya ha llegado.' },
    { kind: 'factura_sin_cobrar',        label: 'Facturas sin cobrar',
      desc: 'Avisa cuando una factura emitida lleva varios días sin marcarse como cobrada.',
      field: 'notif_dias_factura_sin_cobrar', defaultDias: 30 },
    { kind: 'presupuesto_sin_respuesta', label: 'Presupuestos sin respuesta',
      desc: 'Avisa cuando un presupuesto enviado lleva días sin aceptarse o rechazarse.',
      field: 'notif_dias_presupuesto_sin_respuesta', defaultDias: 14 },
    { kind: 'borrador_estancado',        label: 'Borradores estancados',
      desc: 'Avisa cuando un borrador (factura o presupuesto) lleva tiempo sin actividad.',
      field: 'notif_dias_borrador_estancado', defaultDias: 7 },
    { kind: 'cierre_trimestral',         label: 'Cierre trimestral',
      desc: 'Avisa cuando se acerca el cierre del trimestre (modelos 130 / 303).',
      field: 'notif_dias_cierre_trimestral_aviso', defaultDias: 30 },
  ];

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">
        Notificaciones
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Configura qué categorías de avisos quieres recibir y cuántos días esperar antes de avisar.
      </p>
      <div className="space-y-3">
        {categorias.map((cat) => {
          const off = disabled.has(cat.kind);
          return (
            <div
              key={cat.kind}
              className={
                'flex items-start gap-4 p-4 rounded-lg border ' +
                (off ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-slate-200')
              }
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800">{cat.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{cat.desc}</div>
                {cat.field && !off && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-slate-600">Avisar tras</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={form[cat.field] ?? cat.defaultDias}
                      onChange={(e) => setField(cat.field, Number(e.target.value) || cat.defaultDias)}
                      onFocus={(e) => e.target.select()}
                      className="w-20 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                    <span className="text-slate-600">días</span>
                  </div>
                )}
              </div>
              <label className="inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!off}
                  onChange={() => toggleKind(cat.kind)}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand" />
              </label>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500 mt-3">
        Recuerda pulsar "Guardar cambios" abajo.
      </p>
    </section>
  );
}

export default Ajustes;
