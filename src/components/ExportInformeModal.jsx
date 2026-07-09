// Modal para configurar y exportar el informe PDF del dashboard.
// Permite elegir un rango (trimestre actual, anyo en curso, anyo anterior,
// custom) y dispara la generacion del PDF. La generacion en si vive aqui
// para no inflar Home.jsx.

import { useMemo, useState } from 'react';
import { X, FileDown } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import InformePDF from '../pdf/InformePDF.jsx';
import { useToast } from './Toast.jsx';

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';

function currentTrimestreRange() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3); // 0..3
  const start = new Date(now.getFullYear(), q * 3, 1);
  const end = new Date(now.getFullYear(), q * 3 + 3, 0);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), `T${q + 1} ${now.getFullYear()}`];
}

function yearRange(year) {
  return [`${year}-01-01`, `${year}-12-31`, `${year}`];
}

const RANGOS = ['trimestre', 'anio', 'anio_anterior', 'custom'];
const RANGOS_LABEL = {
  trimestre: 'Trimestre actual',
  anio: 'Anyo en curso',
  anio_anterior: 'Anyo anterior',
  custom: 'Personalizado',
};

function ExportInformeModal({ settings, onClose }) {
  const toast = useToast();
  const [rangoTipo, setRangoTipo] = useState('trimestre');
  const now = new Date();
  const yearActual = now.getFullYear();
  const [customDesde, setCustomDesde] = useState(`${yearActual}-01-01`);
  const [customHasta, setCustomHasta] = useState(now.toISOString().slice(0, 10));
  const [generating, setGenerating] = useState(false);

  const rango = useMemo(() => {
    if (rangoTipo === 'trimestre') {
      const [d, h, label] = currentTrimestreRange();
      return { desde: d, hasta: h, label };
    }
    if (rangoTipo === 'anio') {
      const [d, h, label] = yearRange(yearActual);
      return { desde: d, hasta: h, label };
    }
    if (rangoTipo === 'anio_anterior') {
      const [d, h, label] = yearRange(yearActual - 1);
      return { desde: d, hasta: h, label };
    }
    return {
      desde: customDesde,
      hasta: customHasta,
      label: `${customDesde}_${customHasta}`,
    };
  }, [rangoTipo, customDesde, customHasta, yearActual]);

  async function exportar() {
    setGenerating(true);
    try {
      const informe = await window.api.home.informe({
        desde: rango.desde,
        hasta: rango.hasta,
      });
      if (informe?.error) {
        toast.error(informe.error);
        return;
      }
      const blob = await pdf(
        <InformePDF informe={informe} settings={settings} />,
      ).toBlob();
      const buf = new Uint8Array(await blob.arrayBuffer());
      const sugName = `Informe_${rango.label}.pdf`;
      const res = await window.api.pdf.saveInforme(sugName, buf);
      if (res?.canceled) return;
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Informe guardado');
      onClose();
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FileDown size={18} className="text-brand" />
            Exportar informe a PDF
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            Genera un PDF imprimible con stats, breakdown mensual, top clientes
            y listado de facturas del periodo. Util para el contable o para tu
            propio archivo trimestral.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Periodo
            </label>
            <div className="grid grid-cols-2 gap-2">
              {RANGOS.map((r) => (
                <label
                  key={r}
                  className={
                    'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ' +
                    (rangoTipo === r
                      ? 'border-brand bg-brand/5 text-slate-800'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600')
                  }
                >
                  <input
                    type="radio"
                    name="rango"
                    value={r}
                    checked={rangoTipo === r}
                    onChange={() => setRangoTipo(r)}
                    className="text-brand focus:ring-brand"
                  />
                  {RANGOS_LABEL[r]}
                </label>
              ))}
            </div>
          </div>

          {rangoTipo === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Desde
                </label>
                <input
                  type="date"
                  className={inputCls}
                  value={customDesde}
                  onChange={(e) => setCustomDesde(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  className={inputCls}
                  value={customHasta}
                  onChange={(e) => setCustomHasta(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
            Rango seleccionado: <strong>{rango.desde}</strong> — <strong>{rango.hasta}</strong>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={exportar}
            disabled={generating}
            className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm inline-flex items-center gap-2 disabled:opacity-50"
          >
            <FileDown size={14} />
            {generating ? 'Generando…' : 'Generar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportInformeModal;
