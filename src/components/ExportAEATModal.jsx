// Modal "Resumen para app AEAT". Renderiza los datos de la factura
// formateados segun el orden y nomenclatura del formulario de la
// Aplicacion gratuita de Facturacion Verifactu de la AEAT, con un boton
// "copiar" individual por campo. Asi el usuario salta a la web de AEAT y
// rellena rapido en pocos clicks.
//
// La app NO emite la factura — solo prepara los datos. La emision oficial la
// hace el usuario en la AEAT.

import { useState } from 'react';
import { Copy, Check, ExternalLink, X, AlertTriangle } from 'lucide-react';
import { calcTotales } from '../utils/format.js';

const AEAT_URL =
  'https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu.html';

// ---- formateo para la app AEAT ----
//
// La app AEAT en su formulario web acepta importes con coma decimal y SIN
// separador de miles (lo del separador es lo que mas suele romper el copy-
// paste). Fecha en DD-MM-YYYY (la BD guarda YYYY-MM-DD).

function formatImporteAEAT(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  // Spanish locale, no thousands grouping, 2 decimales fijos.
  return v
    .toFixed(2)
    .replace('.', ',');
}

function formatFechaAEAT(yyyymmdd) {
  if (!yyyymmdd || typeof yyyymmdd !== 'string') return '';
  const m = yyyymmdd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return yyyymmdd;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function descripcionFactura(factura, lineas) {
  const asunto = (factura?.asunto || '').trim();
  if (asunto) return asunto;
  const titulos = (lineas || [])
    .map((l) => (l.titulo || '').trim())
    .filter(Boolean);
  if (titulos.length === 0) return 'Servicios prestados según factura adjunta';
  if (titulos.length === 1) return titulos[0];
  return titulos.join(' + ');
}

// ---- componente "fila copiable" ----

function CopyField({ label, value, hint }) {
  const [copiado, setCopiado] = useState(false);
  const isEmpty = value === '' || value == null;

  async function copiar() {
    if (isEmpty) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Sin clipboard API (raro en Electron) — fallback silencioso.
    }
  }

  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500 mb-0.5">{label}</div>
        <div
          className={
            'font-mono text-sm break-words ' +
            (isEmpty ? 'text-slate-400 italic' : 'text-slate-800')
          }
        >
          {isEmpty ? '— vacío —' : value}
        </div>
        {hint && <div className="text-[11px] text-slate-400 mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={copiar}
        disabled={isEmpty}
        className={
          'shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs transition-colors ' +
          (isEmpty
            ? 'text-slate-300 cursor-not-allowed'
            : copiado
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
        }
        title={isEmpty ? 'Sin valor' : 'Copiar al portapapeles'}
      >
        {copiado ? <Check size={13} /> : <Copy size={13} />}
        {copiado ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

// ---- modal principal ----

function ExportAEATModal({ factura, lineas, cliente, settings, onClose }) {
  const f = factura || {};
  const ls = lineas || [];
  const c = cliente || null;
  const s = settings || {};
  const [verLineas, setVerLineas] = useState(false);

  const sinCliente = !c;
  const sinLineas = ls.length === 0;

  const desc = descripcionFactura(f, ls);
  const dirCliente = c
    ? [c.direccion, [c.cp, c.ciudad].filter(Boolean).join(' '), c.provincia]
        .filter(Boolean)
        .join(', ')
    : '';

  // Calculo en vivo desde las lineas (los campos f.base_imponible / iva_importe
  // / total no estan en el estado local del editor — los recalcula el backend
  // y aqui no llegan, asi que confiarse en ellos daria 0). Misma logica que
  // usa el editor para los totales que muestra abajo a la derecha.
  const ivaPct = Number(f.iva_porcentaje) || 0;
  const { base, iva: cuota, total } = calcTotales(ls, ivaPct);

  return (
    <div
      className="fixed inset-0 z-[55] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Resumen para app AEAT
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Factura {f.numero ?? ''} — copia los campos uno a uno
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Tutorial corto */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm text-slate-700 mb-2">
              <strong>Cómo emitir esta factura oficial gratis</strong>
            </p>
            <ol className="text-sm text-slate-700 list-decimal ml-5 space-y-1">
              <li>
                Abre la{' '}
                <a
                  href={AEAT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline inline-flex items-center gap-0.5"
                >
                  app gratuita de la AEAT
                  <ExternalLink size={11} />
                </a>{' '}
                e identifícate con tu certificado o Cl@ve.
              </li>
              <li>Pulsa "Crear factura" o equivalente.</li>
              <li>
                Copia los siguientes campos en orden con los botones de la
                derecha y pégalos en el formulario.
              </li>
              <li>Revísalo, fírmalo y la AEAT te dará el QR Verifactu oficial.</li>
            </ol>
          </div>

          {/* Avisos */}
          {sinCliente && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-700 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900">
                Esta factura no tiene cliente asignado. Asigna un cliente
                antes de exportar para que se rellenen los datos del
                destinatario.
              </div>
            </div>
          )}
          {sinLineas && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-700 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900">
                Esta factura no tiene líneas. Añade al menos una antes de
                exportar.
              </div>
            </div>
          )}

          {/* Expedidor */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Datos del expedidor
            </h3>
            <CopyField label="NIF" value={s.emisor_nif || ''} />
            <CopyField label="Nombre o razón social" value={s.emisor_nombre || ''} />
          </section>

          {/* Destinatario */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Datos del destinatario
            </h3>
            <CopyField label="NIF cliente" value={c?.nif || ''} />
            <CopyField label="Nombre o razón social" value={c?.nombre || ''} />
            <CopyField label="Dirección" value={dirCliente} />
          </section>

          {/* Factura */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Datos de la factura
            </h3>
            <CopyField
              label="Tipo de factura"
              value="F1"
              hint="F1 = factura completa estándar. Si era simplificada (ticket), cámbialo a F2 en la AEAT."
            />
            <CopyField
              label="Número (referencia interna)"
              value={f.numero || ''}
              hint="Tu numeración interna. La AEAT asignará el número oficial al guardarla."
            />
            <CopyField
              label="Fecha de emisión"
              value={formatFechaAEAT(f.fecha)}
              hint="Formato DD-MM-YYYY"
            />
            <CopyField label="Descripción de la operación" value={desc} />
          </section>

          {/* Importes */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Importes
            </h3>
            <CopyField
              label="Base imponible"
              value={formatImporteAEAT(base)}
              hint="Suma de líneas sin IVA"
            />
            <CopyField label="Tipo de IVA (%)" value={String(ivaPct)} />
            <CopyField label="Cuota de IVA" value={formatImporteAEAT(cuota)} />
            <CopyField
              label="Total factura"
              value={formatImporteAEAT(total)}
            />
          </section>

          {/* Lineas (opcional, plegable) */}
          <section>
            <button
              type="button"
              onClick={() => setVerLineas((x) => !x)}
              className="text-xs text-brand hover:text-brand-dark"
            >
              {verLineas ? '▾' : '▸'} Detalle de líneas ({ls.length})
            </button>
            {verLineas && (
              <div className="mt-2 space-y-2">
                {ls.map((l, i) => (
                  <div
                    key={l.id ?? i}
                    className="border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <div className="text-xs text-slate-500 mb-1">
                      Línea {i + 1}
                    </div>
                    <CopyField
                      label="Concepto"
                      value={(l.titulo || '').trim() || '—'}
                    />
                    <CopyField
                      label="Importe"
                      value={formatImporteAEAT(l.importe)}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between">
          <a
            href={AEAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline"
          >
            <ExternalLink size={14} />
            Abrir app AEAT
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportAEATModal;
