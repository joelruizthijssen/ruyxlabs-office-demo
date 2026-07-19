import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import LegalWelcome from './components/LegalWelcome.jsx';
import SetupWizard from './components/SetupWizard.jsx';
import { ToastProvider } from './components/Toast.jsx';
import KeyboardShortcuts from './components/KeyboardShortcuts.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import Home from './pages/Home.jsx';
import Clientes from './pages/Clientes.jsx';
import ClienteDetalle from './pages/ClienteDetalle.jsx';
import Presupuestos from './pages/Presupuestos.jsx';
import PresupuestoEditor from './pages/PresupuestoEditor.jsx';
import Facturas from './pages/Facturas.jsx';
import FacturaEditor from './pages/FacturaEditor.jsx';
import Fiscal from './pages/Fiscal.jsx';
import Gastos from './pages/Gastos.jsx';
import Proveedores from './pages/Proveedores.jsx';
import ProveedorDetalle from './pages/ProveedorDetalle.jsx';
import Pedidos from './pages/Pedidos.jsx';
import PedidoEditor from './pages/PedidoEditor.jsx';
import Recurrencias from './pages/Recurrencias.jsx';
import Productos from './pages/Productos.jsx';
import ProductoDetalle from './pages/ProductoDetalle.jsx';
import Depositos from './pages/Depositos.jsx';
import MarcasInforme from './pages/MarcasInforme.jsx';
import CuentaDiana from './pages/CuentaDiana.jsx';
import Notificaciones from './pages/Notificaciones.jsx';
import Ajustes from './pages/Ajustes.jsx';
import Ayuda from './pages/Ayuda.jsx';
import { LicenseGate, TrialBanner } from './components/LicenseGate.jsx';
import { IS_PRIVATE_BUILD } from './utils/variant.js';
import DemoBanner from './components/DemoBanner.jsx';
import DemoWelcomeModal from './components/DemoWelcomeModal.jsx';
import TourController from './tours/TourController.jsx';
import { Analytics } from '@vercel/analytics/react';

// Decide si hay que mostrar el wizard de primer arranque. Lo activamos solo si
// faltan los dos campos obligatorios (nombre + NIF). Con eso evitamos que se
// dispare en instalaciones existentes que ya tienen datos.
function needsSetup(settings) {
  if (!settings) return false;
  if (settings.error) return false;
  return !settings.emisor_nombre?.trim() || !settings.emisor_nif?.trim();
}

function needsLegal(settings) {
  if (!settings) return false;
  if (settings.error) return false;
  return !settings.legal_aceptado_at;
}

function App() {
  // 'checking' | 'legal' | 'setup' | 'done'
  const [phase, setPhase] = useState('checking');
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Estado de licencia/prueba. Solo aplica a la build pública: las builds
  // privadas (family + primo) son de regalo, sin prueba ni bloqueo.
  const [lic, setLic] = useState(null);

  async function refreshLicense() {
    if (IS_PRIVATE_BUILD || !window.api?.app) {
      setLic({ status: 'active', licenseActivated: true });
      return;
    }
    try {
      const st = await window.api.app.licenseState();
      setLic(st && !st.error ? st : { status: 'active' });
    } catch {
      // Si falla la consulta, no bloqueamos al usuario (fail-open).
      setLic({ status: 'active' });
    }
  }

  async function refreshPhase() {
    if (!window.api) {
      setPhase('done');
      return;
    }
    try {
      const s = await window.api.settings.get();
      if (needsLegal(s)) setPhase('legal');
      else if (needsSetup(s)) setPhase('setup');
      else setPhase('done');
    } catch {
      setPhase('done');
    }
  }

  useEffect(() => {
    refreshPhase();
    refreshLicense();
  }, []);

  if (phase === 'checking' || lic === null) {
    return null;
  }

  // Trial caducado y sin licencia → bloqueo total (salvo builds privadas).
  // Va después del gate legal: si el usuario aún no aceptó lo legal, eso
  // tiene prioridad (requisito legal); después se aplica el de licencia.
  const bloqueadoPorLicencia =
    !IS_PRIVATE_BUILD && phase !== 'legal' && lic.status === 'expired';

  return (
    <ToastProvider>
      <div className="h-screen flex flex-col">
        <DemoBanner />
        {phase === 'done' && !bloqueadoPorLicencia && lic.status === 'trial' && (
          <TrialBanner
            daysLeft={lic.daysLeft}
            onComprar={() => window.api?.license?.openRequest?.().catch(() => {})}
          />
        )}
        <div className="flex-1 min-h-0">
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/clientes/:id" element={<ClienteDetalle />} />
              <Route path="/presupuestos" element={<Presupuestos />} />
              <Route path="/presupuestos/:id" element={<PresupuestoEditor />} />
              <Route path="/facturas" element={<Facturas />} />
              <Route path="/facturas/:id" element={<FacturaEditor />} />
              <Route path="/gastos" element={<Gastos />} />
              <Route path="/proveedores" element={<Proveedores />} />
              <Route path="/proveedores/:id" element={<ProveedorDetalle />} />
              <Route path="/pedidos" element={<Pedidos />} />
              <Route path="/pedidos/:id" element={<PedidoEditor />} />
              <Route path="/recurrencias" element={<Recurrencias />} />
              <Route path="/notificaciones" element={<Notificaciones />} />
              <Route path="/productos" element={<Productos />} />
              <Route path="/productos/:id" element={<ProductoDetalle />} />
              <Route path="/depositos" element={<Depositos />} />
              <Route path="/marcas" element={<MarcasInforme />} />
              <Route path="/diana" element={<CuentaDiana />} />
              <Route path="/fiscal" element={<Fiscal />} />
              <Route path="/ajustes" element={<Ajustes />} />
              <Route path="/ayuda" element={<Ayuda />} />
            </Routes>
          </Layout>
        </div>
      </div>

      {bloqueadoPorLicencia && (
        <LicenseGate onActivated={() => refreshLicense()} />
      )}

      {/* Atajos globales (Ctrl+N, Ctrl+Shift+N, Ctrl+K). Solo activos cuando
          la app esta operativa (ya pasamos legal + setup). */}
      {phase === 'done' && (
        <>
          <KeyboardShortcuts onOpenPalette={() => setPaletteOpen(true)} />
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
          />
          <TourController />
        </>
      )}

      {/* Modal legal: gate previo al setup wizard. Mientras este montado, el
          resto de la app no es interactiva (el modal cubre la pantalla con un
          backdrop con z-index 60). */}
      {phase === 'legal' && (
        <LegalWelcome onAccept={() => refreshPhase()} />
      )}

      {phase === 'setup' && (
        <SetupWizard onComplete={() => setPhase('done')} />
      )}

      <DemoWelcomeModal />
      <Analytics />
    </ToastProvider>
  );
}

export default App;
