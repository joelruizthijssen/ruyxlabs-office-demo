// Constantes de marca y version.
//
// `APP_VERSION` se INYECTA en tiempo de build desde package.json via `define`
// en vite.config.js (variable `__APP_VERSION__`). El package.json de la demo
// debe mantenerse en paridad con el de la app real al sincronizar releases.
//
// Naming: "Ruyx Office" es el nombre del producto que ve el usuario;
// "RuyxLabs" es la empresa propietaria.
//
// v1.5.3: fix bug de version hardcodeada (aparecia 1.3.0 en Ayuda aunque
// el codigo ya estuviera sincronizado con v1.5.2).

export const APP_NAME = 'Ruyx Office';
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
export const APP_TAGLINE = 'Tu oficina, simple.';
export const COMPANY_NAME = 'RuyxLabs';
export const COMPANY_WEB = 'ruyxlabs.com';
export const COPYRIGHT_YEAR = 2026;
