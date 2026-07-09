// Atajos de teclado globales. Componente sin UI propia: solo registra
// listeners en window y dispara las acciones correspondientes.
//
// Atajos activos:
//   Ctrl+N         → Crear nuevo presupuesto (y abrir su editor).
//   Ctrl+Shift+N   → Crear nueva factura (y abrir su editor).
//   Ctrl+K         → Abrir paleta de busqueda global.
//   g + X          → Navegacion rapida estilo vim (chord). 1500ms para
//                    completar tras pulsar `g`. Combinaciones:
//                      g h → Inicio
//                      g c → Clientes
//                      g p → Presupuestos
//                      g f → Facturas
//                      g e → Gastos (e de "expenses")
//                      g r → Recurrencias
//                      g $ → Resumen fiscal
//                      g s → Ajustes (s de "settings")
//
// Comportamiento:
// - No se disparan si el foco esta en un <input>, <textarea>, [contenteditable]
//   o dentro de un combobox abierto — para que escribir "n" en un campo no
//   cree presupuestos por error.
// - Para Ctrl+N y Ctrl+K SI atrapamos el evento incluso en inputs porque son
//   accion-de-app (Ctrl+K es estandar para abrir paletas en cualquier sitio).
// - preventDefault para que el browser/Electron no trate el atajo (Ctrl+N
//   abre una ventana nueva por defecto).
// - El chord `g` solo se activa fuera de inputs. Si se pulsa g+X muy rapido
//   y el segundo carater no coincide con ninguna ruta, cancelamos el modo.

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast.jsx';

const GOTO_ROUTES = {
  h: '/',
  c: '/clientes',
  p: '/presupuestos',
  f: '/facturas',
  e: '/gastos',
  r: '/recurrencias',
  '$': '/fiscal',
  s: '/ajustes',
};

const GOTO_LABELS = {
  '/': 'Inicio',
  '/clientes': 'Clientes',
  '/presupuestos': 'Presupuestos',
  '/facturas': 'Facturas',
  '/gastos': 'Gastos',
  '/recurrencias': 'Recurrencias',
  '/fiscal': 'Resumen fiscal',
  '/ajustes': 'Ajustes',
};

function isTypingInField(e) {
  const t = e.target;
  if (!t) return false;
  const tag = t.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (t.isContentEditable) return true;
  return false;
}

function KeyboardShortcuts({ onOpenPalette }) {
  const nav = useNavigate();
  const toast = useToast();
  // El chord g se gestiona con un ref para no re-renderizar este componente
  // (sin UI propia) cada vez que cambia el estado del chord.
  const chordRef = useRef({ active: false, timer: null });

  useEffect(() => {
    function cancelChord() {
      chordRef.current.active = false;
      if (chordRef.current.timer) {
        clearTimeout(chordRef.current.timer);
        chordRef.current.timer = null;
      }
    }

    async function onKeyDown(e) {
      // --- Chord `g + X` (vim-style navigation) ---
      // Solo fuera de campos. Lo procesamos ANTES del bloque de modifiers
      // porque la `g` se pulsa sin Ctrl/Cmd.
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        // Si ya estamos esperando segundo char:
        if (chordRef.current.active && !isTypingInField(e)) {
          e.preventDefault();
          const route = GOTO_ROUTES[key] || GOTO_ROUTES[e.key]; // '$' es shift+4 en algunos teclados, miramos la key real tambien
          cancelChord();
          if (route) {
            nav(route);
            toast.info(`→ ${GOTO_LABELS[route] || route}`);
          }
          return;
        }
        // Pulsacion inicial: solo 'g' fuera de un input arranca el chord.
        if (key === 'g' && !isTypingInField(e)) {
          e.preventDefault();
          chordRef.current.active = true;
          if (chordRef.current.timer) clearTimeout(chordRef.current.timer);
          chordRef.current.timer = setTimeout(cancelChord, 1500);
          return;
        }
      }

      // --- Atajos con modifier ---
      // Modifier check: meta = Cmd en macOS, ctrlKey en Windows/Linux.
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      // Ctrl+K: abrir paleta. Siempre, incluso desde inputs (estandar).
      if (key === 'k' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onOpenPalette?.();
        return;
      }

      // Ctrl+N / Ctrl+Shift+N: crear presupuesto/factura. Solo si no esta
      // escribiendo en un campo.
      if (key === 'n' && !e.altKey) {
        if (isTypingInField(e)) return;
        e.preventDefault();

        if (!window.api) return;
        try {
          if (e.shiftKey) {
            // Ctrl+Shift+N → factura
            const res = await window.api.facturas.create();
            if (res?.error) {
              toast.error(res.error);
              return;
            }
            nav(`/facturas/${res.id}`);
          } else {
            // Ctrl+N → presupuesto
            const res = await window.api.presupuestos.create();
            if (res?.error) {
              toast.error(res.error);
              return;
            }
            nav(`/presupuestos/${res.id}`);
          }
        } catch (err) {
          toast.error(err.message ?? String(err));
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nav, toast, onOpenPalette]);

  return null;
}

export default KeyboardShortcuts;
