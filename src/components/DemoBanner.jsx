import { useState } from 'react';
import { clearSnapshot } from '../browserApi/persistence.js';

// Banner permanente que informa de que esta es una demo.
// Ocupa la parte superior de la pantalla.
export default function DemoBanner() {
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    if (!confirm('¿Seguro que quieres reiniciar la demo? Se perderán todos los datos que hayas creado.')) return;
    setResetting(true);
    await clearSnapshot();
    window.location.reload();
  }

  return (
    <div className="w-full bg-amber-100 border-b border-amber-300 text-amber-950 text-sm px-4 py-2 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <span className="inline-block bg-amber-500 text-white text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded">
          Demo
        </span>
        <span>
          Estás probando Ruyx Office. Los datos se guardan en tu navegador y se borran a las 24h. Nada persiste en un servidor.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleReset}
          disabled={resetting}
          className="text-xs text-amber-900 underline hover:text-amber-950 disabled:opacity-50"
        >
          {resetting ? 'Reiniciando…' : 'Reiniciar demo'}
        </button>
        <a
          href="https://ruyxlabs.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs bg-brand text-white font-medium px-3 py-1 rounded hover:bg-brand-dark"
        >
          Descargar la app
        </a>
      </div>
    </div>
  );
}
