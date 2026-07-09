import { useEffect, useState } from 'react';

const STORAGE_KEY = 'ruyx-demo-welcome-seen';

// Modal de bienvenida que aparece la primera visita del navegador.
// Se persiste en localStorage (no en IndexedDB — es un flag UX, no dato de negocio).
export default function DemoWelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch { /* ignore */ }
  }, []);

  function handleClose() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center font-bold text-lg">
            R
          </div>
          <div>
            <div className="text-lg font-semibold">Bienvenido a la demo de Ruyx Office</div>
            <div className="text-sm text-slate-500">Facturación, presupuestos y contabilidad para autónomos y pymes</div>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-700 mb-6">
          <p>Estás probando la <strong>versión web interactiva</strong> del producto. Puedes:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Ver y editar los datos de ejemplo (2 empresas, 8 clientes, 15 facturas, 10 gastos)</li>
            <li>Crear tus propias facturas, presupuestos, gastos y clientes</li>
            <li>Descargar PDFs generados en el navegador</li>
            <li>Ver dashboards con datos reales</li>
          </ul>
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900">
            <strong>Aviso:</strong> Los datos se guardan solo en <strong>tu navegador</strong> (IndexedDB). No hay servidor. Se borran automáticamente a las 24 horas o cuando pulses "Reiniciar demo".
          </div>
        </div>

        <button
          onClick={handleClose}
          className="w-full bg-brand hover:bg-brand-dark text-white font-medium py-2.5 rounded"
        >
          Empezar a explorar
        </button>
      </div>
    </div>
  );
}
