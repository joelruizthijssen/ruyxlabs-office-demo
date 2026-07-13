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

import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Joyride, STATUS } from 'react-joyride';
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
  const [stepIndex, setStepIndex] = useState(0);

  // Auto-launch del tour general en primer arranque (~800ms delay para que el
  // DOM y los elementos [data-tour] esten montados y estables).
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isTourSeen('general')) {
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
    setActiveTour(key);
    setStepIndex(0);
    // Ir a la ruta apropiada antes de arrancar el tour.
    if (tour.startPath && loc.pathname !== tour.startPath) {
      nav(tour.startPath);
      // Dejar tiempo a que la ruta cargue y monte sus [data-tour].
      setTimeout(() => setRun(true), 400);
    } else {
      setTimeout(() => setRun(true), 100);
    }
  }, [loc.pathname, nav]);

  const handleCallback = useCallback((data) => {
    const { status, action } = data || {};
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED || action === 'close') {
      setRun(false);
      if (activeTour) markTourSeen(activeTour);
      setActiveTour(null);
      setStepIndex(0);
    } else if (data?.type === 'step:after' && data?.index != null) {
      // El step avanzo/retrocedio; sincronizamos el stepIndex nuestro.
      const next = data.action === 'prev' ? data.index - 1 : data.index + 1;
      setStepIndex(next);
    }
  }, [activeTour]);

  if (!activeTour) return null;
  const steps = TOURS[activeTour]?.steps || [];
  if (steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
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
