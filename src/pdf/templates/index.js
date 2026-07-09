// Registro de plantillas. Anyadir una plantilla nueva = un fichero
// `<Nombre>.jsx` que exporta por defecto el componente, mas una entrada aqui.

import Bandas from './Bandas.jsx';
import Minimal from './Minimal.jsx';
import Cabecera from './Cabecera.jsx';
import Lateral from './Lateral.jsx';
import Moderno from './Moderno.jsx';
import Constructora from './Constructora.jsx';
import Apaisado from './Apaisado.jsx';
import A5Ticket from './A5Ticket.jsx';
import Personalizada from './Personalizada.jsx';

// id   -> id persistido en settings.plantilla
// label -> texto mostrado en el selector de Ajustes
// hint  -> descripcion corta debajo del nombre
// Component -> componente React-PDF
export const TEMPLATES = [
  {
    id: 'bandas',
    label: 'Bandas',
    hint: 'Franjas de color arriba y abajo (clásico).',
    Component: Bandas,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    hint: 'Líneas finas, mucho aire blanco. Discreto.',
    Component: Minimal,
  },
  {
    id: 'cabecera',
    label: 'Cabecera sólida',
    hint: 'Bloque de color arriba con el título en blanco.',
    Component: Cabecera,
  },
  {
    id: 'lateral',
    label: 'Banda lateral',
    hint: 'Franja vertical en el lado izquierdo.',
    Component: Lateral,
  },
  {
    id: 'moderno',
    label: 'Moderno',
    hint: 'Sidebar oscura con datos del emisor. Look SaaS.',
    Component: Moderno,
  },
  {
    id: 'constructora',
    label: 'Constructora',
    hint: 'Robusta para obra/gremios: banda de color y franja de proyecto.',
    Component: Constructora,
  },
  {
    id: 'apaisado',
    label: 'Apaisado',
    hint: 'A4 horizontal. Totales en columna lateral. Conceptos largos.',
    Component: Apaisado,
  },
  {
    id: 'a5ticket',
    label: 'A5 Ticket',
    hint: 'Media hoja (A5), compacto tipo recibo. Documentos cortos.',
    Component: A5Ticket,
  },
  {
    id: 'personalizada',
    label: 'Personalizada',
    hint: 'Usa tu propio membrete (Ajustes → Diseño).',
    Component: Personalizada,
    // Requiere que `settings.membrete_path` esté definido — la UI debería
    // deshabilitar el botón si no hay membrete subido.
    requiereMembrete: true,
  },
];

export const DEFAULT_TEMPLATE_ID = 'bandas';

export function getTemplate(id) {
  return (
    TEMPLATES.find((t) => t.id === id)?.Component ||
    TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID).Component
  );
}
