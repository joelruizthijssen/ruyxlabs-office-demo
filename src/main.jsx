import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { initBrowserApi } from './browserApi/index.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

// Arranca la descarga del .wasm en paralelo mientras React + el bundle
// se procesan. Recorta ~500ms del arranque inicial en visitas frescas.
(() => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'fetch';
  link.type = 'application/wasm';
  link.crossOrigin = 'anonymous';
  link.href = sqlWasmUrl;
  document.head.appendChild(link);
})();

async function boot() {
  const rootEl = document.getElementById('root');
  // Placeholder mientras sql.js + BD arrancan (~500ms primera visita, luego cache)
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                font-family:system-ui,sans-serif;color:#334155;background:#f8fafc">
      <div style="text-align:center">
        <div style="width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#1abc9c;
                    border-radius:50%;animation:sp 0.8s linear infinite;margin:0 auto 16px"></div>
        <div style="font-size:14px">Cargando demo…</div>
      </div>
    </div>
    <style>@keyframes sp{to{transform:rotate(360deg)}}</style>
  `;

  await initBrowserApi();

  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

boot().catch((e) => {
  console.error('[boot] fallo al inicializar:', e);
  document.getElementById('root').innerHTML = `
    <div style="padding:24px;font-family:system-ui,sans-serif;color:#b91c1c">
      <h2>Error al cargar la demo</h2>
      <pre style="white-space:pre-wrap;font-size:12px">${String(e && e.stack || e)}</pre>
    </div>
  `;
});
