// Helpers de formateo compartidos entre la UI y el componente PDF.

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const eurFmt = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

export function formatEUR(n) {
  return eurFmt.format(Number(n) || 0);
}

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

export function formatFechaES(yyyymmdd) {
  if (!yyyymmdd) return '';
  // Acepta 'YYYY-MM-DD'. Cualquier cosa que no parsee → devolvemos tal cual.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(yyyymmdd));
  if (!m) return String(yyyymmdd);
  const [, y, mes, d] = m;
  return `${parseInt(d, 10)} DE ${MESES[parseInt(mes, 10) - 1]} DE ${y}`;
}

// Calcula totales soportando IVA por linea + IRPF.
//   lineas: [{ importe, iva_pct? }]
//   ivaPctGlobal: tipo IVA del documento (fallback si linea no tiene iva_pct)
//   irpfPct: 0..100 retencion IRPF (opcional, solo aplica a facturas)
//   opts.incluyeIva: si false, fuerza IVA total a 0 e ignora el iva_pct de
//     cada linea. La base se calcula igual. El PDF mostrara una nota
//     "IVA no incluido" para que quede claro.
// Devuelve:
//   base, iva, total, irpf, ivaBreakdown: [{ pct, base, importe }]
//   - ivaBreakdown agrupa lineas por tipo IVA para mostrar el desglose en
//     PDFs y AEAT (cuando hay multiples tipos en la misma factura).
//   - Cuando incluyeIva=false, ivaBreakdown queda vacio y iva=0.
// Tipo de recargo de equivalencia segun el IVA: 21->5,2 ; 10->1,4 ; 4->0,5.
function reRate(p) {
  const x = Number(p) || 0;
  if (x >= 21) return 5.2;
  if (x >= 10) return 1.4;
  if (x > 0) return 0.5;
  return 0;
}

// Importe de un descuento sobre `bruto`. tipo 'eur' = cantidad fija (acotada
// a no superar el bruto); cualquier otra cosa ('pct' o vacio) = porcentaje.
export function descuentoImporte(bruto, tipo, valor) {
  const b = Number(bruto) || 0;
  const v = Number(valor) || 0;
  if (b <= 0 || v <= 0) return 0;
  if (tipo === 'eur') return round2(Math.min(v, b));
  return round2((b * v) / 100);
}

// Calcula totales soportando IVA por linea + IRPF + recargo de equivalencia +
// descuento por linea + descuento global del documento.
//   lineas: [{ importe, iva_pct?, descuento_tipo?, descuento_valor? }]
//   opts.descuentoGlobalTipo / opts.descuentoGlobalValor: descuento sobre el
//     subtotal (tras descuentos de linea). Se reparte proporcionalmente entre
//     los tramos de IVA para que el desglose siga cuadrando.
export function calcTotales(lineas, ivaPctGlobal, irpfPct, opts) {
  const ivaGlobal = Number(ivaPctGlobal) || 0;
  const irpf = Number(irpfPct) || 0;
  const incluyeIva = opts?.incluyeIva !== false;
  const conRecargo = !!opts?.recargoEquivalencia;
  const buckets = new Map(); // pct -> base neta (tras descuento de linea)

  let brutoTotal = 0;
  let descLineas = 0;
  for (const l of (lineas || [])) {
    const imp = Number(l.importe) || 0;
    const pct = l.iva_pct == null || l.iva_pct === ''
      ? ivaGlobal
      : (Number(l.iva_pct) || 0);
    const dl = descuentoImporte(imp, l.descuento_tipo, l.descuento_valor);
    const net = round2(imp - dl);
    brutoTotal += imp;
    descLineas += dl;
    buckets.set(pct, (buckets.get(pct) || 0) + net);
  }

  // Subtotal tras descuentos de linea = base sobre la que aplica el global.
  let subtotal = 0;
  for (const b of buckets.values()) subtotal += b;
  subtotal = round2(subtotal);
  const descGlobal = descuentoImporte(
    subtotal, opts?.descuentoGlobalTipo, opts?.descuentoGlobalValor,
  );
  const factor = subtotal > 0 ? Math.max(0, (subtotal - descGlobal) / subtotal) : 1;

  let base = 0;
  let iva = 0;
  let recargoEq = 0;
  const ivaBreakdown = [];
  for (const [pct, b] of buckets) {
    const bR = round2(b * factor);
    const i = incluyeIva ? round2((bR * pct) / 100) : 0;
    base += bR;
    iva += i;
    if (conRecargo) recargoEq += round2((bR * reRate(pct)) / 100);
    if (incluyeIva) {
      ivaBreakdown.push({ pct, base: bR, importe: i });
    }
  }
  ivaBreakdown.sort((a, b) => b.pct - a.pct);

  const baseR = round2(base);
  const ivaR = round2(iva);
  const recargoEqR = round2(recargoEq);
  const irpfImporte = round2((baseR * irpf) / 100);
  const total = round2(baseR + ivaR - irpfImporte + recargoEqR);
  return {
    base: baseR,
    iva: ivaR,
    irpf: irpfImporte,
    irpfPct: irpf,
    recargoEq: recargoEqR,
    recargoEquivalencia: conRecargo,
    total,
    ivaBreakdown,
    incluyeIva,
    subtotalBruto: round2(brutoTotal),
    descuentoLineas: round2(descLineas),
    descuentoGlobal: round2(subtotal - round2(subtotal * factor)),
  };
}
