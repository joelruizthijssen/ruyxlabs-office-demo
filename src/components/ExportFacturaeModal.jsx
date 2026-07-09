// Modal "Exportar Facturae XML". Genera un archivo XML 3.2.2 sin firmar y
// dispara el dialogo de guardar de Electron. Tutorial corto de importacion
// para las plataformas certificadas mas comunes (BeeL, FacturaDirecta,
// Quipu).

import { useMemo, useState } from 'react';
import {
  Download,
  ExternalLink,
  X,
  AlertTriangle,
  FileCode2,
} from 'lucide-react';
import {
  buildFacturaeXML,
  checkFacturaePrereq,
  facturaeFilename,
} from '../utils/exportFacturae.js';

const PLATAFORMAS = [
  { nombre: 'BeeL.es', url: 'https://app.beel.es/' },
  { nombre: 'FacturaDirecta', url: 'https://www.facturadirecta.com/' },
  { nombre: 'Quipu', url: 'https://app.getquipu.com/' },
];

function ExportFacturaeModal({ factura, lineas, cliente, settings, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [savedPath, setSavedPath] = useState(null);
  const [error, setError] = useState(null);

  const avisos = useMemo(
    () => checkFacturaePrereq({ factura, lineas, cliente, settings }),
    [factura, lineas, cliente, settings],
  );

  async function descargar() {
    if (downloading) return;
    setError(null);
    setSavedPath(null);
    setDownloading(true);
    try {
      const xml = buildFacturaeXML({ factura, lineas, cliente, settings });
      const name = facturaeFilename(factura);
      const res = await window.api.facturae.saveXml(name, xml);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.canceled) return;
      setSavedPath(res?.path || '');
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[55] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
              <FileCode2 size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Exportar Facturae XML
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Factura {factura?.numero ?? ''} — formato estándar AEAT 3.2.2
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm text-slate-700 mb-2">
              <strong>¿Qué es Facturae XML?</strong>
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              Es el formato oficial de factura electrónica de la AEAT (versión
              3.2.2). La mayoría de plataformas certificadas Verifactu lo
              aceptan como entrada. Aquí lo generamos{' '}
              <strong>sin firma</strong> — la firma electrónica avanzada (XAdES)
              la añade automáticamente la plataforma destino al importar.
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-700 mb-2">
              <strong>Cómo importarlo</strong>
            </p>
            <ol className="text-sm text-slate-700 list-decimal ml-5 space-y-1">
              <li>Pulsa "Descargar XML" abajo y guarda el archivo.</li>
              <li>
                Abre tu plataforma certificada e inicia sesión:
                <ul className="mt-1 ml-3 space-y-0.5">
                  {PLATAFORMAS.map((p) => (
                    <li key={p.nombre}>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 underline inline-flex items-center gap-0.5"
                      >
                        {p.nombre}
                        <ExternalLink size={11} />
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
              <li>
                Busca la opción <strong>"Importar factura"</strong> o{' '}
                <strong>"Subir XML"</strong> en el menú de facturas.
              </li>
              <li>
                Sube el XML que acabas de guardar. La plataforma firmará y
                emitirá la factura oficial.
              </li>
            </ol>
          </div>

          {avisos.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-700 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900">
                <p className="font-medium mb-1">
                  Datos incompletos para Facturae:
                </p>
                <ul className="list-disc ml-4 space-y-0.5 text-xs">
                  {avisos.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
                <p className="text-xs mt-2">
                  Puedes generar el XML igualmente, pero algunas plataformas lo
                  rechazarán al importar si faltan campos.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {savedPath && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Archivo guardado en:
              <div className="font-mono text-xs mt-1 break-all">{savedPath}</div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={descargar}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm transition-colors disabled:opacity-60"
          >
            <Download size={16} />
            {downloading ? 'Generando…' : 'Descargar XML'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportFacturaeModal;
