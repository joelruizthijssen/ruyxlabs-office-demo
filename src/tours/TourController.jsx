// v1.5.0: Controller central de los tours guiados.
//
// Se monta una sola vez en App.jsx (dentro del Router). Escucha eventos globales
// para arrancar/parar tours, y renderiza <Joyride> con los pasos del tour
// activo. Persiste "primera-vez visto" por tour en localStorage.
//
// Uso:
//   1. Auto-launch: al primer arranque, el tour "general" arranca solo si no
//      esta marcado como visto.
//   2. Manual: `window.dispatchEvent(new CustomEvent('start-tour', { detail: 'general' }))`
//      dispara el tour que se pida. Lo usa el boton "Ver tour" en Ayuda.
//   3. El tour pide ir a una ruta especifica antes de arrancar (startPath) para
//      que los elementos [data-tour] existan en el DOM.
//
// NOTA v1.5.0: NO usamos modo controlado (stepIndex prop). Dejamos que Joyride
// gestione internamente su indice. Nuestro callback solo maneja el fin del
// tour (FINISHED/SKIPPED/CLOSE) para persistir "visto" y desmontar. Esto evita
// race conditions entre setState y el ciclo interno de Joyride que causaban
// que el tour se pegara con overlay sin tooltip al pasar de un step al
// siguiente.

import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Joyride, STATUS, ACTIONS } from 'react-joyride';
import { TOURS, isTourSeen, markTourSeen } from './tourDefinitions.js';

const STYLES = {
  options: {
    primaryColor: '#1abc9c',
    zIndex: 10000,
    arrowColor: '#ffffff',
    backgroundColor: '#ffffff',
    overlayColor: 'rgba(15, 23, 42, 0.6)',
    textColor: '#0f172a',
  },
  tooltip: {
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 8,
    color: '#0f172a',
  },
  buttonNext: {
    backgroundColor: '#1abc9c',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
  },
  buttonBack: {
    color: '#64748b',
    fontSize: 13,
  },
  buttonSkip: {
    color: '#94a3b8',
    fontSize: 12,
  },
  buttonClose: {
    display: 'none',
  },
};

function TourController() {
  const nav = useNavigate();
  const loc = useLocation();
  const [activeTour, setActiveTour] = useState(null);
  const [run, setRun] = useState(false);

  // Auto-launch del tour general en primer arranque (~800ms delay para que el
  // DOM y los elementos [data-tour] esten montados y estables).
  //
  // v1.5.1: marcar el tour como visto TAN PRONTO como se arranca (no al
  // terminarlo). El comportamiento anterior solo marcaba en FINISHED/SKIPPED,
  // por lo que si el usuario cerraba la app durante el tour, cambiaba de
  // pagina, o un paso se quedaba colgado (target no montado), el flag nunca
  // se seteaba y el tour salia OTRA vez al proximo arranque.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isTourSeen('general')) {
        markTourSeen('general');
        startTour('general');
      }
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listener de evento global para arrancar tours desde otros sitios (Ayuda,
  // etc.). Payload: string con la key del tour ('general', 'facturas', ...).
  useEffect(() => {
    const onStartTour = (e) => {
      const key = e?.detail;
      if (!key || !TOURS[key]) return;
      startTour(key);
    };
    window.addEventListener('start-tour', onStartTour);
    return () => window.removeEventListener('start-tour', onStartTour);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTour = useCallback((key) => {
    const tour = TOURS[key];
    if (!tour) return;
    // Reset primero: desmonta cualquier Joyride previo antes de re-montarlo
    // con el nuevo tour. Sin esto, si activeTour ya estaba puesto de un tour
    // anterior, Joyride no re-inicializa correctamente.
    setRun(false);
    setActiveTour(null);
    setTimeout(() => {
      setActiveTour(key);
      // Ir a la ruta apropiada antes de arrancar el tour.
      if (tour.startPath && loc.pathname !== tour.startPath) {
        nav(tour.startPath);
        setTimeout(() => setRun(true), 500);
      } else {
        setTimeout(() => setRun(true), 200);
      }
    }, 50);
  }, [loc.pathname, nav]);

  const handleCallback = useCallback((data) => {
    const { status, action } = data || {};

    // Fin del tour: terminado, saltado o cerrado con X
    if (
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED ||
      action === ACTIONS.CLOSE ||
      action === ACTIONS.RESET
    ) {
      setRun(false);
      if (activeTour) markTourSeen(activeTour);
      setActiveTour(null);
      return;
    }
  }, [activeTour]);

  if (!activeTour) return null;
  const steps = TOURS[activeTour]?.steps || [];
  if (steps.length === 0) return null;

  return (
    <Joyride
      key={activeTour}
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose
      disableScrolling={false}
      spotlightPadding={4}
      locale={{
        back: 'Atras',
        close: 'Cerrar',
        last: 'Terminar',
        next: 'Siguiente',
        skip: 'Saltar',
      }}
      styles={STYLES}
      callback={handleCallback}
    />
  );
}

export default TourController;
