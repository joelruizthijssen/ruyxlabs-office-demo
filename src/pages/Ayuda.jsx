// Pagina /ayuda — guia de la aplicacion. Toma el contenido de
// src/data/guiaContenido.js, filtra por la variante actual del build y lo
// pinta como pagina navegable. Boton "Descargar PDF" arriba a la derecha que
// reusa el motor @react-pdf (mismo que las facturas) para generar el PDF al
// vuelo y abrir el dialogo "guardar como" via IPC pdf.saveInforme.

import { useMemo, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Download, BookOpen, Info, Lightbulb, AlertCircle } from 'lucide-react';
import { seccionesParaVariante } from '../data/guiaContenido.js';
import { GuiaPDF } from '../pdf/templates/GuiaPDF.jsx';
import { APP_VARIANT } from '../utils/variant.js';
import { APP_NAME, APP_VERSION } from '../utils/appInfo.js';
import { useToast } from '../components/Toast.jsx';
import { formatFechaES } from '../utils/format.js';

function BloqueRender({ b }) {
  if (b.tipo === 'parrafo') {
    return <p className="text-slate-700 leading-relaxed mb-3">{b.texto}</p>;
  }
  if (b.tipo === 'subtitulo') {
    return <h3 className="text-base font-semibold text-slate-800 mt-5 mb-2">{b.texto}</h3>;
  }
  if (b.tipo === 'lista') {
    return (
      <ul className="list-disc pl-6 mb-3 space-y-1 text-slate-700">
        {b.items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    );
  }
  if (b.tipo === 'aviso') {
    return (
      <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3 my-3 rounded-r text-sm text-amber-900 flex gap-2">
        <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
        <span>{b.texto}</span>
      </div>
    );
  }
  if (b.tipo === 'tip') {
    return (
      <div className="bg-emerald-50 border-l-4 border-emerald-400 px-4 py-3 my-3 rounded-r text-sm text-emerald-900 flex gap-2">
        <Lightbulb size={16} className="shrink-0 mt-0.5 text-emerald-600" />
        <span>{b.texto}</span>
      </div>
    );
  }
  return null;
}

function Ayuda() {
  const toast = useToast();
  const secciones = useMemo(() => seccionesParaVariante(APP_VARIANT), []);
  const [descargando, setDescargando] = useState(false);

  async function descargarPDF() {
    if (descargando) return;
    setDescargando(true);
    try {
      const fecha = formatFechaES(new Date().toISOString().slice(0, 10));
      const blob = await pdf(
        <GuiaPDF
          secciones={secciones}
          appName={APP_NAME}
          appVersion={APP_VERSION}
          fechaGeneracion={fecha}
        />,
      ).toBlob();
      const buf = new Uint8Array(await blob.arrayBuffer());
      const sugerido = `Guia ${APP_NAME} v${APP_VERSION}.pdf`;
      const res = await window.api.pdf.saveInforme(sugerido, buf);
      if (res && res.path) {
        toast.success('Guía descargada');
      } else if (res && res.canceled) {
        // usuario cancelo el dialogo: no es un error
      } else {
        toast.error(res?.error ? `Error: ${res.error}` : 'No se pudo guardar la guía');
      }
    } catch (e) {
      toast.error('Error generando el PDF: ' + (e?.message || e));
    } finally {
      setDescargando(false);
    }
  }

  function scrollTo(id) {
    const el = document.getElementById(`sec-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-50">
      {/* Cabecera */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
            <BookOpen size={20} className="text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Guía de uso</h1>
            <p className="text-sm text-slate-500">
              {`${APP_NAME} · v${APP_VERSION} · ${secciones.length} secciones`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={descargarPDF}
          disabled={descargando}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50"
        >
          <Download size={16} />
          {descargando ? 'Generando…' : 'Descargar PDF'}
        </button>
      </div>

      {/* Cuerpo: TOC + contenido */}
      <div className="flex-1 min-h-0 flex">
        {/* TOC */}
        <aside className="w-64 shrink-0 bg-white border-r border-slate-200 overflow-y-auto py-5 px-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3 px-2">
            Índice
          </p>
          <nav className="flex flex-col gap-0.5">
            {secciones.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                className="text-left text-sm text-slate-600 hover:text-brand hover:bg-slate-50 px-2 py-1.5 rounded-md transition-colors"
              >
                {`${i + 1}. ${s.titulo}`}
              </button>
            ))}
          </nav>
        </aside>

        {/* Contenido */}
        <main className="flex-1 min-w-0 overflow-y-auto px-10 py-8">
          <div className="max-w-3xl">
            <div className="bg-white border border-slate-200 rounded-xl px-8 py-6 mb-6 flex gap-3">
              <Info size={20} className="text-slate-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600 leading-relaxed">
                Esta guía se actualiza con cada nueva versión de la aplicación.
                Si echas en falta una sección o ves algo que no encaja, avísame.
              </p>
            </div>

            {secciones.map((s, i) => (
              <section
                key={s.id}
                id={`sec-${s.id}`}
                className="bg-white border border-slate-200 rounded-xl px-8 py-6 mb-4 scroll-mt-6"
              >
                <h2 className="text-xl font-semibold text-brand mb-4">
                  {`${i + 1}.  ${s.titulo}`}
                </h2>
                {s.bloques.map((b, bi) => (
                  <BloqueRender key={bi} b={b} />
                ))}
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Ayuda;
