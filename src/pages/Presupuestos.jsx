import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, FileText } from 'lucide-react';
import { formatEUR } from '../utils/format.js';
import { useToast } from '../components/Toast.jsx';
import NuevoConSerie from '../components/NuevoConSerie.jsx';

const ESTADO_BADGE = {
  borrador:   'bg-slate-200 text-slate-700',
  enviado:    'bg-blue-100 text-blue-700',
  aceptado:   'bg-emerald-100 text-emerald-700',
  rechazado:  'bg-red-100 text-red-700',
  convertido: 'bg-purple-100 text-purple-700',
};

function Presupuestos() {
  const nav = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [series, setSeries] = useState([{ id: 'A', label: 'General' }]);

  async function recargar() {
    if (!window.api) {
      setError('Esta aplicación debe ejecutarse desde Electron.');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const [res, sets] = await Promise.all([
        window.api.presupuestos.list(),
        window.api.settings.get(),
      ]);
      if (res && res.error) setError(res.error);
      else setItems(res || []);
      if (sets && !sets.error && Array.isArray(sets.series_presupuestos_list)) {
        setSeries(sets.series_presupuestos_list);
      }
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  async function crear(serie) {
    setError(null);
    try {
      const res = await window.api.presupuestos.create(serie || 'A');
      if (res && res.error) {
        setError(res.error);
        return;
      }
      nav(`/presupuestos/${res.id}`);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }

  async function eliminar(id, numero) {
    if (!confirm(`¿Eliminar presupuesto ${numero}?`)) return;
    setError(null);
    try {
      const res = await window.api.presupuestos.delete(id);
      if (res && res.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        recargar();
        toast.success(`Presupuesto ${numero} eliminado`);
      }
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(e.message ?? String(e));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-slate-800">Presupuestos</h1>
        <NuevoConSerie series={series} onCreate={crear} label="Nuevo presupuesto" />
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        {loading && <div className="px-6 py-4 text-slate-500">Cargando…</div>}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-5">
              <FileText size={36} />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              Aún no has hecho ningún presupuesto
            </h3>
            <p className="text-slate-500 max-w-sm mb-6">
              Un presupuesto detalla el coste de un trabajo antes de
              ejecutarlo. Si el cliente lo acepta, lo conviertes en factura
              con un clic.
            </p>
            <button
              onClick={() => crear('A')}
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-lg transition-colors font-medium"
            >
              <Plus size={18} />
              Crear mi primer presupuesto
            </button>
          </div>
        )}

        {!loading && items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-6 py-3 font-medium">Número</th>
                <th className="px-6 py-3 font-medium">Fecha</th>
                <th className="px-6 py-3 font-medium">Cliente / Asunto</th>
                <th className="px-6 py-3 font-medium text-right">Total</th>
                <th className="px-6 py-3 font-medium">Estado</th>
                <th className="px-6 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-800">{p.numero}</td>
                  <td className="px-6 py-3 text-slate-600">{p.fecha}</td>
                  <td className="px-6 py-3 text-slate-700">
                    {p.cliente_nombre || p.asunto || '—'}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-800">
                    {formatEUR(p.total)}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={
                          'inline-block px-2.5 py-1 rounded-full text-xs font-medium ' +
                          (ESTADO_BADGE[p.estado] || ESTADO_BADGE.borrador)
                        }
                      >
                        {p.estado}
                      </span>
                      {p.enviado_at && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-700 border border-sky-200"
                          title={`Enviado por correo: ${p.enviado_at}`}
                        >
                          ✓ Enviado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {p.factura_id && (
                        <button
                          onClick={() => nav(`/facturas/${p.factura_id}`)}
                          className="px-3 py-1.5 rounded-md border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors text-xs"
                          title="Ver factura asociada"
                        >
                          → Factura
                        </button>
                      )}
                      <button
                        onClick={() => nav(`/presupuestos/${p.id}`)}
                        className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        Abrir
                      </button>
                      <button
                        onClick={() => eliminar(p.id, p.numero)}
                        title="Eliminar"
                        className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Presupuestos;
