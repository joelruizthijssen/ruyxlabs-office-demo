// Seccion de adjuntos para FacturaEditor y PresupuestoEditor.
//
// Props:
//   parentType: 'factura' | 'presupuesto'
//   parentId:   id del documento
//   disabled:   bloquea subida y borrado (cuando el documento no es editable)
//
// Comportamiento:
// - Lista de adjuntos del documento, ordenados por fecha desc.
// - Boton "Adjuntar archivo": abre file picker, sube y refresca.
// - Cada adjunto tiene: nombre, tamanyo, fecha + acciones [abrir | guardar como… | eliminar].
//   "Abrir" lanza el archivo con la app por defecto del sistema.
//   "Guardar como…" copia el archivo a una ruta elegida por el usuario.
// - Adjuntos NO van en el PDF — son solo para el archivo personal del autonomo.

import { useEffect, useState } from 'react';
import { Paperclip, FileText, Image as ImageIcon, Download, ExternalLink, Trash2, Plus } from 'lucide-react';
import { useToast } from './Toast.jsx';

function formatBytes(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function iconForMime(mime) {
  if (!mime) return FileText;
  if (mime.startsWith('image/')) return ImageIcon;
  return FileText;
}

function AdjuntosSection({ parentType, parentId, disabled }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function recargar() {
    if (!window.api || !parentId) return;
    setLoading(true);
    try {
      const res = await window.api.adjuntos.list(parentType, parentId);
      if (Array.isArray(res)) setItems(res);
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    recargar();
  }, [parentType, parentId]);

  async function onPick(file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error('El archivo es muy grande. Máximo 25 MB.');
      return;
    }
    setUploading(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const res = await window.api.adjuntos.create(parentType, parentId, {
        filename: file.name,
        buffer: buf,
        mime: file.type || null,
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`"${file.name}" adjuntado`);
        await recargar();
      }
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setUploading(false);
    }
  }

  async function onAbrir(item) {
    try {
      const res = await window.api.adjuntos.open(item.id);
      if (res?.error) toast.error(res.error);
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function onGuardar(item) {
    try {
      const res = await window.api.adjuntos.saveAs(item.id);
      if (res?.canceled) return;
      if (res?.error) toast.error(res.error);
      else toast.success('Adjunto guardado');
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  async function onEliminar(item) {
    if (!confirm(`¿Eliminar el adjunto "${item.filename}"?`)) return;
    try {
      const res = await window.api.adjuntos.delete(item.id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success('Adjunto eliminado');
        await recargar();
      }
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  return (
    <section className="bg-white rounded-lg shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-2">
          <Paperclip size={14} />
          Adjuntos
          {items.length > 0 && (
            <span className="text-slate-400 font-normal normal-case">
              ({items.length})
            </span>
          )}
        </h3>
        <label
          className={
            'inline-flex items-center gap-1.5 text-sm text-brand hover:text-brand-dark cursor-pointer ' +
            ((disabled || uploading) ? 'opacity-50 pointer-events-none' : '')
          }
        >
          <Plus size={14} />
          {uploading ? 'Subiendo…' : 'Adjuntar archivo'}
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              onPick(f);
            }}
          />
        </label>
      </div>

      {loading && items.length === 0 && (
        <div className="text-sm text-slate-500 py-3">Cargando…</div>
      )}

      {!loading && items.length === 0 && (
        <p className="text-sm text-slate-500 py-3">
          Sin adjuntos. Puedes subir fotos del trabajo, contratos firmados,
          albaranes, etc. (máx 25 MB por archivo). No aparecen en el PDF.
        </p>
      )}

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((it) => {
            const Icon = iconForMime(it.mime);
            return (
              <div
                key={it.id}
                className="flex items-center gap-3 px-3 py-2 rounded-md border border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <Icon size={18} className="text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => onAbrir(it)}
                    className="block w-full text-left font-medium text-slate-800 truncate hover:text-brand-dark"
                    title="Abrir con la app por defecto"
                  >
                    {it.filename}
                  </button>
                  <div className="text-xs text-slate-400">
                    {formatBytes(it.size)} · {it.created_at?.replace('T', ' ').slice(0, 16)}
                  </div>
                </div>
                <button
                  onClick={() => onAbrir(it)}
                  className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Abrir"
                >
                  <ExternalLink size={15} />
                </button>
                <button
                  onClick={() => onGuardar(it)}
                  className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Guardar copia…"
                >
                  <Download size={15} />
                </button>
                {!disabled && (
                  <button
                    onClick={() => onEliminar(it)}
                    className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default AdjuntosSection;
