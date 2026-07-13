// Contenido de la guia de la aplicacion.
//
// Estructura: array de secciones. Cada seccion declara en que variantes
// aparece (public, family, primo) — asi la guia se adapta al binario y la
// build de primo no enseyna features que el primo no tiene. La pagina
// /ayuda y el PDF descargable consumen este mismo contenido (single source
// of truth).
//
// Para AÑADIR una feature nueva a la guia: editar este archivo (añadir un
// bloque a una seccion existente o crear una seccion nueva), bumpar version
// y publicar release. Los usuarios reciben la guia actualizada por auto-update.
//
// Tipos de bloque soportados:
//   { tipo: 'parrafo',   texto: '...' }
//   { tipo: 'lista',     items: ['...', '...'] }
//   { tipo: 'subtitulo', texto: '...' }
//   { tipo: 'aviso',     texto: '...' }   - caja amarilla (constrains/cuidados)
//   { tipo: 'tip',       texto: '...' }   - caja verde (consejos)

const ALL = ['public', 'family', 'primo'];
const PUB_FAM = ['public', 'family'];
const FAM_ONLY = ['family'];

export const SECCIONES = [
  {
    id: 'bienvenida',
    titulo: 'Bienvenida',
    variantes: ALL,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Ruyx Office es una aplicacion de escritorio para autonomos españoles. Te permite gestionar clientes, crear presupuestos y facturas, registrar gastos y llevar un control basico de tu actividad. Toda la informacion se guarda localmente en tu equipo; no se sincroniza con ningun servidor.',
      },
      {
        tipo: 'parrafo',
        texto:
          'La aplicacion no transmite datos a ningun servidor externo. Lo unico que se conecta a internet son las comprobaciones de actualizacion automatica.',
      },
      {
        tipo: 'aviso',
        texto:
          'Importante: Ruyx Office es un preparador de documentos. NO es un Sistema Informatico de Facturacion (SIF) homologado por la AEAT. Los PDF que genera son utiles para tus clientes y registros internos, pero la presentacion oficial de impuestos sigue siendo responsabilidad tuya con tu asesor o por Sede Electronica.',
      },
    ],
  },

  {
    id: 'primeros-pasos',
    titulo: 'Primeros pasos',
    variantes: ALL,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'La primera vez que abres la aplicacion te pedira aceptar el aviso legal y rellenar el asistente inicial con tus datos de autonomo: nombre, NIF, direccion, IBAN y un telefono o email de contacto.',
      },
      {
        tipo: 'parrafo',
        texto:
          'Estos datos saldran como "emisor" en todos los PDF de presupuestos y facturas. Puedes cambiarlos despues en Ajustes > Datos del autonomo.',
      },
      {
        tipo: 'tip',
        texto:
          'Sube un logo y elige una plantilla en Ajustes > Aspecto para que tus PDF tengan el aspecto que te interesa antes de mandar el primero al cliente.',
      },
    ],
  },

  {
    id: 'empresas',
    titulo: 'Empresas (multi-empresa)',
    variantes: PUB_FAM,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Puedes gestionar varias empresas / actividades dentro de la misma aplicacion. Cada empresa tiene sus propios clientes, presupuestos, facturas y numeracion. En la parte superior del sidebar tienes un selector para cambiar la empresa activa.',
      },
      {
        tipo: 'parrafo',
        texto:
          'La numeracion de presupuestos y facturas es INDEPENDIENTE por empresa: si la empresa A va por 2026/15 y creas la primera factura en la empresa B, esa empezara en 2026/01.',
      },
      {
        tipo: 'tip',
        texto:
          'Cada empresa puede tener su propio logo, plantilla, color de marca y datos de emisor. Esto es util si llevas dos actividades distintas (por ejemplo consultoria + tienda).',
      },
    ],
  },

  {
    id: 'clientes',
    titulo: 'Clientes',
    variantes: ALL,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Crea fichas de clientes con sus datos fiscales. Hay 3 tipos: Particular, Autonomo y Empresa. Para Particular se atenuan los campos especificos de empresa.',
      },
      {
        tipo: 'subtitulo',
        texto: 'Datos opcionales utiles',
      },
      {
        tipo: 'lista',
        items: [
          'IBAN del cliente — sale en el PDF si lo rellenas (por si te paga por transferencia).',
          'IRPF por defecto — si pones 15%, todas las facturas que crees para este cliente aplicaran ese 15% automaticamente.',
          'Condiciones de pago — texto libre que aparece debajo del total ("Pago a 30 dias", etc.).',
          'Observaciones internas — notas que solo ves tu, NO aparecen en el PDF.',
        ],
      },
    ],
  },

  {
    id: 'productos',
    titulo: 'Productos / catalogo',
    variantes: PUB_FAM,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Si tienes servicios o productos que vendes habitualmente, puedes crear un catalogo. Cada producto tiene un codigo, un nombre, descripcion, precio e IVA.',
      },
      {
        tipo: 'parrafo',
        texto:
          'En el editor de presupuesto o factura, al escribir un codigo en la casilla "Codigo" se autocompletan los demas campos (titulo, descripcion, precio, IVA) tomando los datos del producto. Asi facturar repeticiones es mas rapido.',
      },
    ],
  },

  {
    id: 'presupuestos',
    titulo: 'Presupuestos',
    variantes: ALL,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Los presupuestos son documentos previos a la factura. La numeracion es independiente de la de facturas (un presupuesto 2026/01 NO bloquea que una factura sea 2026/01).',
      },
      {
        tipo: 'subtitulo',
        texto: 'Estados',
      },
      {
        tipo: 'lista',
        items: [
          'Borrador — todavia se puede editar libremente.',
          'Enviado — marca que ya lo mandaste al cliente.',
          'Aceptado — el cliente confirmo. Listo para convertir a factura.',
          'Rechazado — el cliente no quiere seguir. Queda archivado.',
        ],
      },
      {
        tipo: 'subtitulo',
        texto: 'Convertir a factura',
      },
      {
        tipo: 'parrafo',
        texto:
          'Desde un presupuesto puedes generar la factura correspondiente con un click. Hay 3 modos: Completa (copia todas las lineas tal cual), Resumen (una linea con el total) y Por hitos (si el presupuesto tiene hitos, genera N facturas).',
      },
    ],
  },

  {
    id: 'facturas',
    titulo: 'Facturas',
    variantes: ALL,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Cada factura tiene un numero unico por empresa, una fecha, un cliente y una o varias lineas (concepto + cantidad + precio).',
      },
      {
        tipo: 'subtitulo',
        texto: 'Subtipos',
      },
      {
        tipo: 'lista',
        items: [
          'Factura — el documento estandar.',
          'Nota de contado — venta inmediata, sin numeracion fiscal.',
          'Proforma — propuesta no vinculante (sin valor fiscal).',
          'Rectificativa — corrige una factura ya emitida.',
        ],
      },
      {
        tipo: 'subtitulo',
        texto: 'Estados',
      },
      {
        tipo: 'lista',
        items: [
          'Borrador — editable. Puedes renumerar en Ajustes si te interesa empezar desde 01.',
          'Emitida — inmutable. Si necesitas cambiar algo, crea una rectificativa.',
          'Cobrada — emitida + has marcado el cobro.',
          'Anulada — cancelada (queda en historial, pero no cuenta para totales).',
        ],
      },
      {
        tipo: 'aviso',
        texto:
          'Una factura emitida NO se puede editar (es un requisito fiscal). Si te equivocaste, anula la original y crea una rectificativa.',
      },
    ],
  },

  {
    id: 'gastos',
    titulo: 'Gastos',
    variantes: ALL,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Registra los gastos deducibles de tu actividad (combustible, material, suscripciones, etc.). Cada gasto tiene fecha, proveedor, concepto, base imponible, IVA y, opcionalmente, retencion IRPF.',
      },
      {
        tipo: 'parrafo',
        texto:
          'El total se calcula automaticamente: base + IVA - IRPF. Si pones una base de 100, IVA 21 y IRPF 15, el total es 103,00 €.',
      },
      {
        tipo: 'tip',
        texto:
          'Marca "deducible" cuando corresponda. Los gastos no deducibles se registran igual pero no se descuentan al calcular impuestos.',
      },
    ],
  },

  {
    id: 'proveedores',
    titulo: 'Proveedores',
    variantes: PUB_FAM,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Crea fichas de proveedores recurrentes (electricidad, telefono, alquiler de local, etc.) para asociar gastos. La ficha del proveedor muestra el historial de gastos que has registrado con el.',
      },
    ],
  },

  {
    id: 'recurrencias',
    titulo: 'Recurrencias',
    variantes: PUB_FAM,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Las recurrencias son plantillas que generan presupuestos o facturas en automatico cada cierto tiempo (mensual, trimestral, anual). Util para clientes con cuotas fijas.',
      },
      {
        tipo: 'parrafo',
        texto:
          'Hay dos formas de definir una recurrencia: a partir de un documento existente, o desde catalogo de productos (eliges productos del catalogo y la cadencia). El sistema te recordara cuando toca generar el siguiente.',
      },
    ],
  },

  {
    id: 'notificaciones',
    titulo: 'Notificaciones',
    variantes: PUB_FAM,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'La aplicacion vigila ciertas situaciones y te avisa: facturas vencidas (mas de 30 dias sin cobrar), presupuestos sin respuesta del cliente, borradores estancados, fechas de cierre trimestral, etc.',
      },
      {
        tipo: 'parrafo',
        texto:
          'Los plazos son configurables en Ajustes > Notificaciones. Si una alerta no te interesa, la puedes desactivar individualmente.',
      },
    ],
  },

  {
    id: 'resumen-fiscal',
    titulo: 'Resumen fiscal',
    variantes: PUB_FAM,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Calculadora interna que te da una vision del IVA y el IRPF acumulados por trimestre. Te ayuda a estimar lo que tendras que pagar antes de presentar el modelo 130, 303, etc.',
      },
      {
        tipo: 'aviso',
        texto:
          'Es una estimacion informativa, NO una declaracion oficial. La presentacion sigue siendo responsabilidad tuya y de tu asesor.',
      },
    ],
  },

  {
    id: 'cuenta-socios',
    titulo: 'Cuenta de socios internos',
    variantes: ALL,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Modulo opcional para llevar una cuenta interna con uno o mas socios (colaboradores que reciben un % de la base imponible de tus facturas y gastos). No es fiscal: es una cuenta corriente entre tu y el socio.',
      },
      {
        tipo: 'parrafo',
        texto:
          'Como activarlo: en Ajustes > Socios internos anades un socio con su nombre (por ejemplo "Diana", "Marta", "Juan"...). En cuanto hay 1 socio, aparece un menu "Cuenta [nombre]" en la barra lateral y una columna en el editor de facturas/gastos para marcar el %.',
      },
      {
        tipo: 'parrafo',
        texto:
          'Multi-socio: puedes tener varios socios por empresa. Con 2 o mas, el editor de facturas muestra un boton que abre un mini-panel para poner el % de cada socio en la linea. La pagina Cuenta socios muestra un selector arriba para ver la cuenta de cada uno por separado.',
      },
      {
        tipo: 'parrafo',
        texto:
          'Si no lo usas: deja la lista de socios vacia y esta funcion desaparece por completo del menu.',
      },
    ],
  },

  {
    id: 'plantillas-pdf',
    titulo: 'Plantillas de PDF',
    variantes: ALL,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Ruyx Office trae varias plantillas de aspecto para tus presupuestos y facturas: Bandas, Minimal, Cabecera, Lateral, Moderno y Personalizada. Cambia entre ellas en Ajustes > Aspecto.',
      },
      {
        tipo: 'parrafo',
        texto:
          'La plantilla Personalizada acepta un membrete propio: subes una imagen y la usa de fondo. Util si ya tienes papeleria corporativa.',
      },
    ],
  },

  {
    id: 'ajustes-ocultar-emisor',
    titulo: 'Opcion "uso interno"',
    variantes: ['family', 'primo'],
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'En Ajustes > Datos del autonomo hay un toggle "No mostrar mi nombre en los PDF (uso interno)". Al activarlo, el nombre del emisor no aparece en la cabecera del PDF; el resto de datos (NIF, direccion, firma) sigue saliendo.',
      },
      {
        tipo: 'parrafo',
        texto:
          'Pensado para documentos de uso interno o para clientes que ya conocen al emisor y no quieres repetir el nombre en cada PDF.',
      },
    ],
  },

  {
    id: 'auto-update',
    titulo: 'Actualizaciones automaticas',
    variantes: ALL,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Cuando hay una version nueva, la aplicacion la descarga sola en segundo plano y la instala al cerrar y reabrir. No tienes que descargar nada a mano.',
      },
      {
        tipo: 'parrafo',
        texto:
          'Tus datos NO se borran al actualizar: la base de datos vive en tu carpeta de usuario y se mantiene entre versiones.',
      },
    ],
  },

  {
    id: 'atajos',
    titulo: 'Atajos de teclado',
    variantes: ALL,
    bloques: [
      {
        tipo: 'lista',
        items: [
          'Ctrl + K — abre la paleta de busqueda global (clientes, presupuestos, facturas, gastos).',
          'Ctrl + N — nuevo presupuesto.',
          'Ctrl + Shift + N — nueva factura.',
          'Esc — cierra el modal o vista activa.',
        ],
      },
    ],
  },

  {
    id: 'datos-locales',
    titulo: 'Donde se guardan los datos',
    variantes: ALL,
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Toda la informacion vive en una unica base de datos SQLite local, en la carpeta %APPDATA% de Windows del usuario. Concretamente: C:\\Users\\<usuario>\\AppData\\Roaming\\Ruyx Office\\facturas.db (la build privada usa carpetas separadas).',
      },
      {
        tipo: 'parrafo',
        texto:
          'Esto significa que: tus datos no salen de tu equipo, son tuyos al 100%, y si formateas o cambias de PC sin copiar esa carpeta los pierdes.',
      },
      {
        tipo: 'tip',
        texto:
          'Backup recomendado: copia esa carpeta a un USB o a la nube de vez en cuando. Si algun dia hay un problema, restaurar es tan facil como pegarla de vuelta.',
      },
    ],
  },
];

// Devuelve solo las secciones aplicables a la variante actual.
export function seccionesParaVariante(variant) {
  return SECCIONES.filter((s) => s.variantes.includes(variant));
}
