// Modal "Acerca de". Se invoca desde el footer del Sidebar. Muestra:
// - Nombre del producto (Ruyx Office) y version
// - Tagline
// - Empresa propietaria (RuyxLabs) + web
// - Disclaimer Verifactu (recordatorio del posicionamiento legal)
// - Copyright

import { X, ShieldAlert } from 'lucide-react';
import {
  APP_VERSION,
  APP_TAGLINE,
  COMPANY_NAME,
  COMPANY_WEB,
  COPYRIGHT_YEAR,
} from '../utils/appInfo.js';

function AcercaDeModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[55] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end -mt-3 -mr-3 mb-1">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="text-center pb-1">
          <div className="text-3xl font-bold text-slate-800 tracking-tight">
            Ruyx <span className="text-brand">Office</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">v{APP_VERSION}</div>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            {APP_TAGLINE}
          </p>
        </div>

        <div className="my-6 border-t border-slate-100" />

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2 mb-5">
          <ShieldAlert size={14} className="text-amber-700 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-900 leading-relaxed">
            Esta aplicación NO es un Sistema Informático de Facturación
            certificado Verifactu. Los documentos generados son borradores;
            la emisión oficial debe hacerse en una plataforma certificada
            (Aplicación AEAT, Holded, BeeL, etc.).
          </p>
        </div>

        <div className="text-center text-xs text-slate-500 leading-relaxed">
          <div>
            Producto de <strong>{COMPANY_NAME}</strong>
          </div>
          <div className="mt-0.5 text-slate-400">{COMPANY_WEB}</div>
          <div className="mt-1.5 text-slate-400">
            © {COPYRIGHT_YEAR} {COMPANY_NAME}. Todos los derechos reservados.
          </div>
        </div>
      </div>
    </div>
  );
}

export default AcercaDeModal;
