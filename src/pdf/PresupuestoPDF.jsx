// Despachador: escoge la plantilla segun settings.plantilla y la renderiza
// con tipo='presupuesto'. Mantengo este fichero (en lugar de eliminarlo y
// usar templates/* directo) para no romper imports existentes.

import { getTemplate } from './templates/index.js';

function PresupuestoPDF({ presupuesto, lineas, cliente, settings }) {
  const Template = getTemplate(settings?.plantilla);
  return (
    <Template
      tipo="presupuesto"
      doc={presupuesto}
      lineas={lineas}
      cliente={cliente}
      settings={settings}
    />
  );
}

export default PresupuestoPDF;
