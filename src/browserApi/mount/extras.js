// Mount de los namespaces restantes: pdf, adjuntos, backup, facturae, holded,
// license, mig. En web demo estos son "descargar en el navegador" en vez de
// "guardar en filesystem" — usamos Blob + createObjectURL para forzar download.

import { overrideApi } from '../index.js';

function _downloadBlob(blob, suggestedName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName || 'descarga';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function _bufferToBlob(buffer, mime) {
  if (buffer instanceof Blob) return buffer;
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return new Blob([uint8], { type: mime || 'application/octet-stream' });
}

export default function mount() {
  overrideApi('pdf', {
    savePresupuesto: (id, buffer) => {
      const blob = _bufferToBlob(buffer, 'application/pdf');
      _downloadBlob(blob, `Presupuesto-${id}.pdf`);
      return { ok: true };
    },
    saveFactura: (id, buffer) => {
      const blob = _bufferToBlob(buffer, 'application/pdf');
      _downloadBlob(blob, `Factura-${id}.pdf`);
      return { ok: true };
    },
    saveInforme: (suggestedName, buffer) => {
      const blob = _bufferToBlob(buffer, 'application/pdf');
      _downloadBlob(blob, suggestedName || 'Informe.pdf');
      return { ok: true };
    },
  });

  overrideApi('holded', {
    saveXlsx: (suggestedName, buffer) => {
      const blob = _bufferToBlob(buffer,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      _downloadBlob(blob, suggestedName || 'Holded.xlsx');
      return { ok: true };
    },
  });

  overrideApi('facturae', {
    saveXml: (suggestedName, content) => {
      const str = typeof content === 'string' ? content : String(content || '');
      const blob = new Blob([str], { type: 'application/xml' });
      _downloadBlob(blob, suggestedName || 'Facturae.xml');
      return { ok: true };
    },
  });

  overrideApi('adjuntos', {
    list: () => [],
    create: () => ({
      ok: false,
      error: 'Los adjuntos no estan disponibles en la demo web. Descarga la app de escritorio para adjuntar archivos.',
    }),
    delete: () => ({ ok: true }),
    open: () => ({ ok: false, error: 'Solo en la app de escritorio.' }),
    saveAs: () => ({ ok: false, error: 'Solo en la app de escritorio.' }),
  });

  overrideApi('backup', {
    export: () => ({
      ok: false,
      error: 'Copias de seguridad ZIP no disponibles en la demo web. Descarga la app de escritorio para hacer backups.',
    }),
    import: () => ({
      ok: false,
      error: 'Restaurar copias de seguridad solo disponible en la app de escritorio.',
    }),
  });

  overrideApi('license', {
    activate: () => ({ ok: true, status: 'active' }),
    deactivate: () => ({ ok: true }),
    revalidate: () => ({ ok: true, status: 'active' }),
    openRequest: () => {
      window.open('https://ruyxlabs.com', '_blank', 'noopener,noreferrer');
      return { ok: true };
    },
  });

  overrideApi('mig', {
    numeroLog: () => [],
  });

  // Notif y recurrencias: stubs con arrays vacios / count 0.
  overrideApi('notif', {
    listar: () => [],
    countNoLeidas: () => 0,
    marcarLeida: () => ({ ok: true }),
    marcarTodasLeidas: () => ({ ok: true }),
    descartar: () => ({ ok: true }),
    snooze: () => ({ ok: true }),
  });

  overrideApi('recurrencias', {
    list: () => [],
    pendientes: () => [],
    forSource: () => [],
    create: () => ({ ok: true }),
    update: () => ({ ok: true }),
    delete: () => ({ ok: true }),
    generar: () => ({ ok: false, error: 'Recurrencias solo en la app de escritorio.' }),
    lineas: () => [],
  });
}
