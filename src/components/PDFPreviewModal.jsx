// Modal a pantalla casi-completa para ver el PDF al maximo tamanyo
// posible sin tener que descargarlo. Reusa PDFCanvasPreview — solo le da
// mas anchura y centra el contenido. Esc cierra. Click fuera del card cierra.
//
// Patron de modal: mismo que SendEmailModal/RecurrenciaModal (fixed inset-0
// con backdrop oscuro). Se diferencia en que ocupa casi toda la viewport
// (max-w-6xl) en vez de un dialog estrecho.

import { useEffect } from 'react';
import { X, Maximize2 } from 'lucide-react';
import PDFCanvasPreview from './PDFCanvasPreview.jsx';

function PDFPreviewModal({ pdfBlob, title, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    // Bloquear scroll del body mientras el modal está abierto. Al cerrar,
    // restaurar al valor previo (no asumir vacío — puede haber otro modal).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4 sm:p-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Maximize2 size={16} className="text-brand" />
            {title || 'Vista previa ampliada'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors"
            title="Cerrar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-3 bg-slate-100">
          <PDFCanvasPreview pdfBlob={pdfBlob} />
        </div>
      </div>
    </div>
  );
}

export default PDFPreviewModal;
