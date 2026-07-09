// Genera un QR EPC069-12 (a.k.a. "Girocode" / "SEPA QR") como data URL.
// Cualquier app de banca movil europea lo escanea y prefilla la transferencia
// con el IBAN, importe y concepto. Estandar publicado por European Payments
// Council, formato:
//
//   BCD                            (service tag)
//   002                            (version)
//   1                              (charset, 1 = UTF-8)
//   SCT                            (identification, SEPA Credit Transfer)
//   [BIC]                          (opcional, vacio funciona en SEPA zone)
//   [Beneficiario]                 (max 70 chars)
//   [IBAN]                         (sin espacios)
//   EUR[importe con punto]         (ej. "EUR123.45")
//   [purpose code]                 (opcional)
//   [structured ref]               (opcional)
//   [unstructured ref]             (concepto libre, max 140 chars)
//   [info to beneficiary]          (opcional)
//
// Si falta IBAN o nombre, devolvemos null y el QR no se imprime.

import QRCode from 'qrcode';

function clean(s) {
  return String(s || '').trim();
}

function cleanIban(s) {
  return String(s || '').replace(/\s+/g, '').toUpperCase();
}

export function buildSepaPayload({ beneficiario, iban, importe, concepto }) {
  const benef = clean(beneficiario).slice(0, 70);
  const ibanC = cleanIban(iban);
  if (!benef || !ibanC) return null;
  const amt = Math.max(0, Number(importe) || 0);
  if (amt <= 0) return null;
  // El estandar pide separador decimal con punto y maximo 2 decimales.
  const amtStr = amt.toFixed(2);
  const conc = clean(concepto).slice(0, 140);
  return [
    'BCD',
    '002',
    '1',
    'SCT',
    '',           // BIC vacio (no hace falta para SEPA)
    benef,
    ibanC,
    `EUR${amtStr}`,
    '',           // purpose
    '',           // structured ref
    conc,
    '',           // info beneficiary
  ].join('\n');
}

// Genera el QR como data URL (PNG) listo para embedar en el PDF.
// Si falta info, devuelve null sin lanzar.
export async function generateSepaQrDataUrl(opts) {
  const payload = buildSepaPayload(opts);
  if (!payload) return null;
  try {
    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    });
  } catch (err) {
    console.warn('[sepaQr] error generando QR:', err && err.message);
    return null;
  }
}
