# Ruyx Office — Demo Web

Demo interactiva de [Ruyx Office](https://ruyxlabs.com) ejecutada 100% en el navegador.

## Arquitectura

- **UI**: React 19 + Vite + Tailwind (idéntico al desktop)
- **BD**: SQLite compilada a WebAssembly (`sql.js`) — corre en el navegador
- **Persistencia**: IndexedDB con TTL 24h. Al cerrar pestaña + 24h, se borra
- **Sin servidor**: todo pasa en el cliente, cero backend
- **Zero-config**: `npm install && npm run dev` y funciona

## Diferencias respecto al desktop

- Sin auto-update, sin licencias (siempre "active")
- Adjuntos, backup ZIP, VIES online: no disponibles (muestran mensaje "solo en escritorio")
- Notificaciones y recurrencias: deshabilitadas
- El resto de funcionalidades (clientes, facturas, presupuestos, gastos,
  productos, pedidos, PDFs, dashboards, fiscal) portadas 1:1

## Estructura

```
src/
  browserApi/         # capa que sustituye a electron/repository.cjs
    sqlite.js         # shim node-sqlite3-wasm → sql.js
    persistence.js    # snapshot BD → IndexedDB con TTL
    db.js             # schema + migraciones (idéntico al desktop)
    helpers.js        # utils compartidos (numeracion, empresaScope, etc.)
    repository/       # port de cada namespace
    mount/            # cada mount.js registra su namespace en window.api
    seed.js           # datos de ejemplo realistas
    index.js          # boot orquestrador
  components/
    DemoBanner.jsx        # banner amarillo permanente arriba
    DemoWelcomeModal.jsx  # modal de bienvenida primera visita
  ...resto igual al desktop
public/
  sql-wasm.wasm       # WebAssembly de SQLite (~660KB)
```

## Deploy en Vercel

### Opción A: dashboard web (recomendada)

1. Empuja este repo a GitHub (`ruyx-office-demo` sugerido).
2. Ve a [vercel.com/new](https://vercel.com/new) → importa el repo.
3. Framework preset: **Vite** (autodetectado).
4. Build command: `npm run build` (autodetectado).
5. Output dir: `dist` (autodetectado).
6. Click "Deploy".
7. Vercel te da una URL tipo `ruyx-office-demo-xxx.vercel.app`.

### Opción B: CLI

```bash
npm i -g vercel
vercel   # primera vez: pide login + link
vercel --prod   # deploy a produccion
```

### Custom domain (después)

Cuando la demo esté a tu gusto:

1. En Vercel → project → Settings → Domains → Add.
2. Escribe `demo.ruyxlabs.com`.
3. En **Hostinger** → hPanel → Dominios → `ruyxlabs.com` → DNS Zone Editor:
   - Añadir CNAME: nombre `demo`, valor `cname.vercel-dns.com`.
4. Propaga en 5-15 min. Vercel emitirá certificado SSL automáticamente.

## Comandos

- `npm run dev` — dev server en localhost:5173
- `npm run build` — build de producción a `dist/`
- `npm run preview` — sirve el build local para probar
