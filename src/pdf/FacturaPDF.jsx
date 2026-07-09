// Despachador: escoge la plantilla segun settings.plantilla y la renderiza
// con tipo='factura'. Mantengo este fichero (en lugar de eliminarlo y usar
// templates/* directo) para no romper imports existentes.

import { getTemplate } from './templates/index.js';

function FacturaPDF({ factura, lineas, cliente, settings }) {
  const Template = getTemplate(settings?.plantilla);
  return (
    <Template
      tipo="factura"
      doc={factura}
      lineas={lineas}
      cliente={cliente}
      settings={settings}
    />
  );
}

export default FacturaPDF;
