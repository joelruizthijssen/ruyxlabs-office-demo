// v1.5.0: definiciones de tours guiados con react-joyride.
//
// Cada tour es una lista de pasos. Cada paso tiene:
//   target: selector CSS (usamos [data-tour="key"] en la UI) o 'body' para
//     paso general sin flecha.
//   content: string con el texto que sale en la vinieta.
//   title: opcional, titulo destacado arriba del contenido.
//   placement: 'top' | 'bottom' | 'left' | 'right' | 'auto' | 'center'
//   disableBeacon: true por defecto — no queremos que aparezca el "pulso"
//     antes del step; iniciamos el tour ya en el paso 1.
//
// El "run" del tour lo gestiona TourController via useTour(). El estado
// "primera-vez" se persiste en localStorage con clave `ruyx.tours.<name>.seen`.

export const TOURS = {
  general: {
    key: 'general',
    startPath: '/',
    steps: [
      {
        target: 'body',
        placement: 'center',
        title: 'Bienvenido a Ruyx Office',
        content:
          'Te voy a ensenar rapidamente que hay en cada sitio. Puedes saltar el tour en cualquier momento con "Saltar".',
        disableBeacon: true,
      },
      {
        target: '[data-tour="empresa-selector"]',
        placement: 'bottom',
        title: 'Selector de empresa',
        content:
          'Si trabajas con mas de una empresa (varios negocios, marcas, NIFs), puedes cambiar entre ellas aqui. Cada empresa tiene sus clientes, facturas, gastos y numeracion propios.',
      },
      {
        target: '[data-tour="sidebar-inicio"]',
        placement: 'right',
        title: 'Inicio',
        content:
          'La pantalla que estas viendo. Un resumen de tu actividad: facturado del ano, pendiente de cobro, presupuestos del mes, top clientes y grafica de ingresos.',
      },
      {
        target: '[data-tour="sidebar-clientes"]',
        placement: 'right',
        title: 'Clientes',
        content:
          'Aqui gestionas tu agenda: crear, editar y ver el historial de cada cliente (facturas, presupuestos, pagos pendientes).',
      },
      {
        target: '[data-tour="sidebar-presupuestos"]',
        placement: 'right',
        title: 'Presupuestos',
        content:
          'Presupuestos y proformas. Cuando el cliente los acepta, con un click se convierten en factura sin volver a picar los datos.',
      },
      {
        target: '[data-tour="sidebar-facturas"]',
        placement: 'right',
        title: 'Facturas',
        content:
          'Tus facturas emitidas. Puedes generar el PDF, marcarlas como cobradas, exportarlas para gestoria o para modelos AEAT.',
      },
      {
        target: '[data-tour="sidebar-gastos"]',
        placement: 'right',
        title: 'Gastos',
        content:
          'Gastos y compras a proveedores. Alimentan tus modelos fiscales (130/303) y salen en el resumen fiscal.',
      },
      {
        target: '[data-tour="sidebar-fiscal"]',
        placement: 'right',
        title: 'Resumen fiscal',
        content:
          'Datos preparados para tu declaracion: base imponible, IVA repercutido, IVA soportado, IRPF... por trimestre y por ano. Puedes copiarlos para modelo 130 / 303.',
      },
      {
        target: '[data-tour="sidebar-ajustes"]',
        placement: 'right',
        title: 'Ajustes',
        content:
          'Configuracion de tu empresa: datos del autonomo, logo, aspecto de los PDF, series de numeracion, plantillas, socios internos, copia de seguridad...',
      },
      {
        target: '[data-tour="btn-nueva-factura"]',
        placement: 'left',
        title: 'Crear una factura',
        content:
          'Desde cualquier pantalla puedes crear una factura nueva con este boton. Si tienes un presupuesto aceptado, tambien puedes convertirlo directamente en factura desde su pagina.',
      },
      {
        target: 'body',
        placement: 'center',
        title: 'Listo',
        content:
          'Ya tienes lo basico. Para tours mas detallados de cada seccion (facturas, gastos, clientes), o para volver a ver este tour, ve a Ayuda > Ver tour de nuevo.',
      },
    ],
  },

  facturas: {
    key: 'facturas',
    startPath: '/facturas',
    steps: [
      {
        target: 'body',
        placement: 'center',
        title: 'Facturas',
        content:
          'Aqui tienes todas tus facturas emitidas. Te ensieno las cosas mas utiles.',
        disableBeacon: true,
      },
      {
        target: '[data-tour="facturas-nueva"]',
        placement: 'bottom',
        title: 'Nueva factura',
        content:
          'Crear factura desde cero. Se abre el editor con el siguiente numero automatico. Tambien puedes crear una proforma, nota de contado o rectificativa desde el desplegable.',
      },
      {
        target: '[data-tour="facturas-filtros"]',
        placement: 'bottom',
        title: 'Filtros',
        content:
          'Filtra por estado (borrador, emitida, cobrada), por cliente, por serie, por rango de fechas o por texto libre. Combinables.',
      },
      {
        target: '[data-tour="facturas-tabla"]',
        placement: 'top',
        title: 'Listado',
        content:
          'Doble click en una fila abre la factura para editar. Los badges de la izquierda muestran el estado y el subtipo (proforma, rectificativa, etc.).',
      },
      {
        target: '[data-tour="facturas-export"]',
        placement: 'left',
        title: 'Exportar',
        content:
          'Exporta el rango filtrado a XLSX (para gestoria), a Facturae XML (para AEAT) o el resumen AEAT gratuito. Uso principal: gestoria a fin de trimestre.',
      },
    ],
  },

  presupuestos: {
    key: 'presupuestos',
    startPath: '/presupuestos',
    steps: [
      {
        target: 'body',
        placement: 'center',
        title: 'Presupuestos',
        content:
          'Presupuestos, proformas y confirmaciones de pedido. Todos comparten la misma base — solo cambia el tipo cuando se emite.',
        disableBeacon: true,
      },
      {
        target: '[data-tour="presupuestos-nueva"]',
        placement: 'bottom',
        title: 'Nuevo presupuesto',
        content:
          'Se abre el editor. Puedes marcar cabecera, cliente, lineas, IVA, descuentos, notas. Al guardar como aceptado, aparece el boton "Convertir a factura".',
      },
      {
        target: '[data-tour="presupuestos-tabla"]',
        placement: 'top',
        title: 'Estados',
        content:
          'Borrador (editable), Enviado (email al cliente), Aceptado (listo para convertir), Rechazado, Convertido (ya es factura). Se pueden filtrar arriba.',
      },
    ],
  },

  gastos: {
    key: 'gastos',
    startPath: '/gastos',
    steps: [
      {
        target: 'body',
        placement: 'center',
        title: 'Gastos',
        content:
          'Tus compras y gastos deducibles. Alimentan tu resumen fiscal automaticamente.',
        disableBeacon: true,
      },
      {
        target: '[data-tour="gastos-nuevo"]',
        placement: 'bottom',
        title: 'Nuevo gasto',
        content:
          'Registra un gasto: proveedor, concepto, base imponible, IVA e IRPF. Puedes desglosar en varias lineas si el gasto agrupa varios conceptos.',
      },
      {
        target: '[data-tour="gastos-abono"]',
        placement: 'bottom',
        title: 'Abonos',
        content:
          'Si un proveedor te devuelve dinero o emite una factura rectificativa negativa, registralo como "abono". Resta automaticamente en el modelo 303/130.',
      },
    ],
  },

  clientes: {
    key: 'clientes',
    startPath: '/clientes',
    steps: [
      {
        target: 'body',
        placement: 'center',
        title: 'Clientes',
        content:
          'Tu agenda de clientes. Cada cliente guarda datos fiscales, historico de facturas y pagos pendientes.',
        disableBeacon: true,
      },
      {
        target: '[data-tour="clientes-nuevo"]',
        placement: 'bottom',
        title: 'Nuevo cliente',
        content:
          'Alta rapida con NIF y datos fiscales. Los datos se auto-rellenan en el resto de la app cuando lo asignas a una factura o presupuesto.',
      },
      {
        target: '[data-tour="clientes-tabla"]',
        placement: 'top',
        title: 'Ficha del cliente',
        content:
          'Click en un cliente abre su ficha con el historial: facturas emitidas, saldo pendiente, ultimos presupuestos. Util para reclamar pagos.',
      },
    ],
  },
};

export function isTourSeen(key) {
  try {
    return localStorage.getItem(`ruyx.tours.${key}.seen`) === '1';
  } catch { return false; }
}
export function markTourSeen(key) {
  try {
    localStorage.setItem(`ruyx.tours.${key}.seen`, '1');
  } catch { /* noop */ }
}
export function resetAllTours() {
  try {
    for (const k of Object.keys(TOURS)) {
      localStorage.removeItem(`ruyx.tours.${k}.seen`);
    }
  } catch { /* noop */ }
}
