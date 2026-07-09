// Constantes de marca y version. Mantener sincronizado con package.json
// `version` cuando se publique una nueva.
//
// Si en algun momento queremos leerlo dinamicamente, se puede inyectar via
// `define` en vite.config.js usando pkg.version del package.json. Para una
// app pequenya con releases manuales, hardcodear es lo mas simple.
//
// Naming: "Ruyx Office" es el nombre del producto que ve el usuario;
// "RuyxLabs" es la empresa propietaria. En sidebar/headers se muestra el
// producto a secas; en footer/Acerca de/PDF aparece la empresa.
//
// v1.3.0: rebrand desde "Brava Office" / "Brava AI Labs".

export const APP_NAME = 'Ruyx Office';
export const APP_VERSION = '1.3.0';
export const APP_TAGLINE = 'Tu oficina, simple.';
export const COMPANY_NAME = 'RuyxLabs';
export const COMPANY_WEB = 'ruyxlabs.com';
export const COPYRIGHT_YEAR = 2026;
