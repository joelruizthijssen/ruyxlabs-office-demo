import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Vite resuelve esto a un URL del worker bundleado. En Electron file:// va
// igualmente bien porque es un asset relativo del propio renderer.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Renderiza un Blob PDF en un <canvas>. Sin iframe → no roba el foco del
// teclado del editor. Soporta multi-pagina con prev/next; las paginas se
// escalan al ancho del contenedor.
function PDFCanvasPreview({ pdfBlob }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);
  const [rendering, setRendering] = useState(false);

  // Cuando llega un blob nuevo, resetear a pagina 1.
  useEffect(() => {
    setCurrentPage(1);
  }, [pdfBlob]);

  useEffect(() => {
    if (!pdfBlob) {
      setPageCount(0);
      setError(null);
      return;
    }
    let cancelled = false;
    let renderTask = null;
    setRendering(true);
    setError(null);

    (async () => {
      try {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        if (cancelled) return;
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        setPageCount(pdfDoc.numPages);
        const pageNum = Math.min(currentPage, pdfDoc.numPages) || 1;
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const containerWidth = containerRef.current?.clientWidth ?? 500;
        const baseViewport = page.getViewport({ scale: 1 });
        // Escalamos al ancho del contenedor (con un pequeño padding).
        const scale = (containerWidth - 16) / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const ctx = canvas.getContext('2d');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        // Fondo blanco (algunos PDF dejan transparente).
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (e) {
        if (!cancelled && e?.name !== 'RenderingCancelledException') {
          setError(e?.message ?? String(e));
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      if (renderTask) {
        try { renderTask.cancel(); } catch { /* noop */ }
      }
    };
  }, [pdfBlob, currentPage]);

  return (
    <div className="h-full flex flex-col">
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-slate-200 rounded-lg p-2 flex items-start justify-center"
      >
        {!pdfBlob && !error && (
          <div className="text-slate-400 text-sm py-8">Generando vista previa…</div>
        )}
        {error && (
          <div className="text-red-600 text-sm py-8 px-4 text-center">
            Error al renderizar PDF: {error}
          </div>
        )}
        <canvas
          ref={canvasRef}
          tabIndex={-1}
          className="shadow-md bg-white"
          style={{ display: pdfBlob && !error ? 'block' : 'none', maxWidth: '100%' }}
        />
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 mt-2 text-sm text-slate-600">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40"
          >
            ←
          </button>
          <span>
            Página {currentPage} de {pageCount}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
            disabled={currentPage >= pageCount}
            className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
      {rendering && pdfBlob && (
        <div className="text-xs text-slate-400 mt-1 text-center">Actualizando…</div>
      )}
    </div>
  );
}

export default PDFCanvasPreview;
