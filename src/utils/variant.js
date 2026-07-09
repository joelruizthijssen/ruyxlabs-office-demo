// Variante de build del renderer.
//
//   'public' → app general que se publica en GitHub (auto-update activo).
//              NO incluye opciones de "uso interno".
//   'family' → build privada para la madre. Incluye la opción "No mostrar
//              mi nombre en los PDFs" y todas las páginas. Auto-update por
//              repo PRIVADO propio.
//   'primo'  → build privada para el primo. MVP super reducido: solo
//              Inicio, Clientes, Presupuestos, Facturas, Gastos, Ajustes.
//              Mismas opciones "uso interno" que family. Auto-update por
//              repo PRIVADO propio (distinto del de family).
//
// El valor se inyecta en tiempo de build con la variable de entorno
// `VITE_VARIANT`. Si no está definida, asumimos 'public' (que es el caso
// por defecto en `npm run dev` y en la build pública).
const RAW =
  import.meta.env.VITE_VARIANT === 'family'
    ? 'family'
    : import.meta.env.VITE_VARIANT === 'primo'
    ? 'primo'
    : 'public';

export const APP_VARIANT = RAW;

export const IS_FAMILY_BUILD = APP_VARIANT === 'family';
export const IS_PRIMO_BUILD = APP_VARIANT === 'primo';
// "Build privada" = family OR primo. Usar este flag para features que
// existen en ambas y NO en la pública (ej. opción "ocultar emisor", saltar
// gate de licencia, etc.). Mantener IS_FAMILY_BUILD solo cuando algo es
// exclusivo de family.
export const IS_PRIVATE_BUILD = IS_FAMILY_BUILD || IS_PRIMO_BUILD;
