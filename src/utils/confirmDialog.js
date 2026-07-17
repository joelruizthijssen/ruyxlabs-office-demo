// Helper para reemplazar `window.confirm()` en la app.
//
// Motivacion (v1.5.1): en Electron 42 + sandbox + contextIsolation,
// `window.confirm()` puede bloquear el thread del renderer o mostrar el
// dialogo detras de la ventana principal — la usuaria interpreta esto como
// "app bloqueada" y fuerza el cierre. Reemplazandolo por un dialogo nativo
// del main process (via IPC + dialog.showMessageBox) el dialogo se ancla
// siempre a la ventana padre y no bloquea nada.
//
// Uso:
//   const ok = await confirmDialog({ message: '¿Eliminar factura?' });
//   if (!ok) return;
//
// Devuelve `true` si el usuario confirma, `false` si cancela.
// En dev (sin window.api), cae a `window.confirm()` para no romper el flujo.
export async function confirmDialog(opts) {
  const options = typeof opts === 'string' ? { message: opts } : (opts || {});
  if (typeof window !== 'undefined' && window.api?.dialog?.confirm) {
    const r = await window.api.dialog.confirm(options);
    return r?.ok === true;
  }
  // Fallback para dev/tests sin IPC bridge.
  return window.confirm(options.message || '¿Continuar?');
}
