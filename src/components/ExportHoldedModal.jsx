// Modal "Exportar a Holded". Genera un XLSX en formato compatible con la
// importacion de "Facturas de venta" de Holded y dispara el dialogo de
// guardar de Electron. Incluye un tutorial corto con los pasos de
// importacion en Holded.

import { useState } from 'react';
import {
  Download,
  ExternalLink,
  X,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { buildHoldedXlsxBuffer, holdedFilename } from '../utils/exportHolded.js';

const HOLDED_IMPORT_URL = 'https://app.holded.com/invoicing/sales';

function ExportHoldedModal({ factura, lineas, cliente, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [savedPath, setSavedPath] = useState(null);
  const [error, setError] = useState(null);

  const sinCliente = !cliente;
  const sinLineas = !Array.isArray(lineas) || lineas.length === 0;

  async function descargar() {
    if (downloading) return;
    setError(null);
    setSavedPath(null);
    setDownloading(true);
    try {
      const buf = buildHoldedXlsxBuffer({ factura, lineas, cliente });
      const name = holdedFilename(factura);
      const res = await window.api.holded.saveXlsx(name, buf);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.canceled) {
        return;
      }
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
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Exportar a Holded
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Factura {factura?.numero ?? ''} — formato XLSX
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
              <strong>Cómo importar en Holded</strong>
            </p>
            <ol className="text-sm text-slate-700 list-decimal ml-5 space-y-1">
              <li>Pulsa "Descargar XLSX" abajo y guarda el archivo.</li>
              <li>
                Abre{' '}
                <a
                  href={HOLDED_IMPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline inline-flex items-center gap-0.5"
                >
                  Holded → Ventas → Facturas
                  <ExternalLink size={11} />
                </a>
                .
              </li>
              <li>
                En el menú "···" (esquina superior derecha) escoge{' '}
                <strong>Importar</strong>.
              </li>
              <li>Sube el archivo XLSX que acabas de guardar.</li>
              <li>
                En el wizard de mapeo, las columnas deberían reconocerse solas.
                Si Holded no reconoce alguna, selecciónala manualmente.
              </li>
              <li>Confirma la importación. Las facturas entran como borrador.</li>
            </ol>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
            <strong>Nota:</strong> los nombres de columna de Holded pueden
            cambiar entre versiones. Si el wizard no detecta las columnas
            automáticamente, mapéalas a mano: <em>Codigo, Fecha emision,
            Cliente, NIF, Concepto, Cantidad, Precio unitario, % IVA,
            Importe</em>.
          </div>

          {sinCliente && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-700 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900">
                Esta factura no tiene cliente. Holded probablemente la
                rechazará al importar — asígnale uno antes.
              </div>
            </div>
          )}
          {sinLineas && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-700 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900">
                Esta factura no tiene líneas. Añade al menos una antes de
                exportar.
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

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between">
          <a
            href={HOLDED_IMPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline"
          >
            <ExternalLink size={14} />
            Abrir Holded
          </a>
          <div className="flex gap-2">
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
              {downloading ? 'Generando…' : 'Descargar XLSX'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExportHoldedModal;
