// Pagina con la lista de todas las recurrencias activas y desactivadas.
// Tareas habituales: ver cuanto falta para la siguiente generacion, generar
// manualmente el borrador del proximo ciclo, editar/eliminar la recurrencia.
//
// La generacion automatica al arrancar la app vive en Home (banner). Esta
// pagina es la "vista detalle" de todo el sistema.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Repeat, Play, Pencil, AlertCircle, Calendar, Plus } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import RecurrenciaModal from '../components/RecurrenciaModal.jsx';
import NuevaRecurrenciaModal from '../components/NuevaRecurrenciaModal.jsx';
import RecurrenciaCatalogoModal from '../components/RecurrenciaCatalogoModal.jsx';
import { formatEUR, formatFechaES } from '../utils/format.js';

const PERIODICIDAD_LABEL = {
  semanal: 'Semanal',
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  anual: 'Anual',
};

function diasHasta(isoFecha) {
  if (!isoFecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(`${isoFecha}T00:00:00`);
  const ms = f.getTime() - hoy.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function Recurrencias() {
  const nav = useNavigate();
  const toast = useToast();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // recurrencia abierta en el modal
  // Cuando el usuario pulsa "+ Nueva recurrencia" desde la pagina, primero
  // abre el modal de seleccion (NuevaRecurrenciaModal) y al confirmar
  // pasamos a abrir el RecurrenciaModal estandar con el tipo+sourceId
  // elegidos. Asi reutilizamos el modal existente sin tocarlo.
  const [creando, setCreando] = useState(false);
  const [nuevoSeed, setNuevoSeed] = useState(null); // { tipo, sourceId, sourceLabel }
  const [creandoCatalogo, setCreandoCatalogo] = useState(false);
  const [generandoId, setGenerandoId] = useState(null);

  const recargar = useCallback(async () => {
    if (!window.api) return;
    try {
      const res = await window.api.recurrencias.list();
      setLista(Array.isArray(res) ? res : []);
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { recargar(); }, [recargar]);

  async function generar(r) {
    if (generandoId) return;
    setGenerandoId(r.id);
    try {
      const res = await window.api.recurrencias.generar(r.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Generado ${res.tipo === 'factura' ? 'factura' : 'presupuesto'} ${res.numero}`,
      );
      // Refrescar sidebar: el badge de notificaciones depende de recurrencias
      // pendientes y borradores estancados (acabamos de crear uno nuevo).
      window.dispatchEvent(new CustomEvent('data-changed'));
      await recargar();
      const ruta = res.tipo === 'factura' ? `/facturas/${res.id}` : `/presupuestos/${res.id}`;
      nav(ruta);
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setGenerandoId(null);
    }
  }

  const pendientes = useMemo(
    () => lista.filter((r) => r.activa && (diasHasta(r.proxima_fecha) ?? 1) <= 0),
    [lista],
  );

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800 flex items-center gap-2">
            <Repeat size={26} className="text-brand" />
            Recurrencias
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Facturas y presupuestos que se generan periodicamente. Tu los
            revisas y los emites manualmente cuando toca.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm shrink-0"
        >
          <Plus size={16} /> Nueva recurrencia
        </button>
      </div>

      {pendientes.length > 0 && (
        <div className="mb-5 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 flex items-start gap-3">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong>{pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}</strong> de
            generar. Pulsa "Generar ahora" en cada una para crear el borrador.
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Cargando…</p>
      ) : lista.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-10 text-center">
          <Repeat size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-700 font-medium mb-1">
            Aun no tienes recurrencias
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            En cualquier factura o presupuesto encontraras el boton{' '}
            <strong>"Hacer recurrente"</strong>. Util para clientes con cuotas
            mensuales (mantenimientos, igualas, alquileres, etc).
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left text-xs">
              <tr>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Modelo</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium text-right">Importe</th>
                <th className="px-5 py-3 font-medium">Frecuencia</th>
                <th className="px-5 py-3 font-medium">Proxima</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => {
                const dias = diasHasta(r.proxima_fecha);
                const pendiente = r.activa && dias !== null && dias <= 0;
                const esCatalogo = r.modo === 'catalogo';
                const tipoDoc = r.tipo_doc || r.tipo;
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 capitalize text-slate-700">
                      <div>{tipoDoc}</div>
                      {esCatalogo && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-amber-100 text-amber-800">
                          Catálogo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {esCatalogo ? (
                        <span className="text-slate-500 italic">(catálogo)</span>
                      ) : r.source_numero || (
                        <span className="text-red-600">⚠ borrado</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {r.source_cliente || '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-800 tabular-nums">
                      {formatEUR(r.source_total || 0)}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {PERIODICIDAD_LABEL[r.periodicidad] || r.periodicidad}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        {formatFechaES(r.proxima_fecha)}
                      </div>
                      {dias !== null && (
                        <div
                          className={
                            'text-[11px] mt-0.5 ' +
                            (pendiente
                              ? 'text-amber-700 font-medium'
                              : 'text-slate-500')
                          }
                        >
                          {dias < 0
                            ? `${Math.abs(dias)} dias de retraso`
                            : dias === 0
                            ? 'Hoy'
                            : `En ${dias} dias`}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {r.activa ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Activa
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Pausada
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {(esCatalogo || r.source_numero) && r.activa && (
                          <button
                            onClick={() => generar(r)}
                            disabled={generandoId === r.id}
                            className={
                              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs disabled:opacity-50 ' +
                              (pendiente
                                ? 'bg-brand hover:bg-brand-dark text-white'
                                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50')
                            }
                            title={
                              pendiente
                                ? 'Generar el borrador del proximo ciclo'
                                : 'Generar ahora (adelantando la fecha)'
                            }
                          >
                            <Play size={12} />
                            {generandoId === r.id ? 'Generando…' : 'Generar'}
                          </button>
                        )}
                        <button
                          onClick={() => setEditing(r)}
                          className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs inline-flex items-center gap-1.5"
                        >
                          <Pencil size={12} />
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <RecurrenciaModal
          tipo={editing.tipo}
          sourceId={editing.source_id}
          sourceLabel={editing.source_numero || '(eliminado)'}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => recargar()}
        />
      )}

      {creando && (
        <NuevaRecurrenciaModal
          onClose={() => setCreando(false)}
          onSelect={(seed) => {
            setCreando(false);
            setNuevoSeed(seed);
          }}
          onChooseCatalogo={() => {
            setCreando(false);
            setCreandoCatalogo(true);
          }}
        />
      )}

      {creandoCatalogo && (
        <RecurrenciaCatalogoModal
          onClose={() => setCreandoCatalogo(false)}
          onSaved={() => {
            setCreandoCatalogo(false);
            recargar();
            toast.success('Recurrencia desde catálogo creada');
          }}
        />
      )}

      {nuevoSeed && (
        <RecurrenciaModal
          tipo={nuevoSeed.tipo}
          sourceId={nuevoSeed.sourceId}
          sourceLabel={nuevoSeed.sourceLabel}
          onClose={() => setNuevoSeed(null)}
          onSaved={() => { setNuevoSeed(null); recargar(); }}
        />
      )}
    </div>
  );
}

export default Recurrencias;
