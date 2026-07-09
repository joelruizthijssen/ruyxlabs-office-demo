// Sistema de toasts global. Tres piezas:
// - ToastProvider: contexto que mantiene la lista de toasts activos.
// - useToast(): hook que devuelve { success, error, info } para disparar.
// - <Toaster />: monta la pila visual en esquina superior derecha.
//
// Auto-dismiss a los 4s (configurable). Click en la X cierra al instante.
// La pila crece hacia abajo, los nuevos aparecen arriba.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((curr) => curr.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type, message, opts = {}) => {
    const id = nextId++;
    const duration = opts.duration ?? 4000;
    setToasts((curr) => [...curr, { id, type, message }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((curr) => curr.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const api = {
    success: (msg, opts) => push('success', msg, opts),
    error:   (msg, opts) => push('error',   msg, opts),
    info:    (msg, opts) => push('info',    msg, opts),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback silencioso si alguien usa el hook fuera del provider — evita
    // crashear la app, solo loggea. No deberia pasar en runtime normal.
    return {
      success: (m) => console.log('[toast.success]', m),
      error:   (m) => console.warn('[toast.error]', m),
      info:    (m) => console.log('[toast.info]', m),
    };
  }
  return ctx;
}

function Toaster({ toasts, onClose }) {
  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  );
}

const TYPE_STYLES = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-white border-emerald-200',
    iconColor: 'text-emerald-600',
    bar: 'bg-emerald-500',
  },
  error: {
    icon: XCircle,
    bg: 'bg-white border-red-200',
    iconColor: 'text-red-600',
    bar: 'bg-red-500',
  },
  info: {
    icon: Info,
    bg: 'bg-white border-blue-200',
    iconColor: 'text-blue-600',
    bar: 'bg-blue-500',
  },
};

function ToastItem({ type, message, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animacion de entrada: en el primer tick montamos invisible y luego
    // pasamos a visible para que la transicion CSS dispare.
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const cfg = TYPE_STYLES[type] || TYPE_STYLES.info;
  const Icon = cfg.icon;

  return (
    <div
      className={
        'pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-[420px] ' +
        'rounded-lg border shadow-lg pl-4 pr-2 py-3 ' +
        'transition-all duration-200 ' +
        (visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4') +
        ' ' + cfg.bg
      }
    >
      <Icon size={20} className={`shrink-0 mt-0.5 ${cfg.iconColor}`} />
      <div className="flex-1 text-sm text-slate-800 leading-relaxed pt-0.5">
        {message}
      </div>
      <button
        onClick={onClose}
        className="shrink-0 p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        title="Cerrar"
      >
        <X size={14} />
      </button>
    </div>
  );
}
