import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, FileText, Receipt, Calculator, Settings, Wallet, Repeat, Package, Bell, TrendingUp, Truck, Handshake, BookOpen, ClipboardList } from 'lucide-react';
import AcercaDeModal from './AcercaDeModal.jsx';
import EmpresaSelector from './EmpresaSelector.jsx';
import { APP_TAGLINE, APP_VERSION } from '../utils/appInfo.js';
import { IS_FAMILY_BUILD, IS_PRIMO_BUILD, IS_PRIVATE_BUILD } from '../utils/variant.js';

// Items visibles en la build PRIMO. Es un MVP super reducido: el primo
// quiere algo parecido a como empezamos (presupuestos + facturas, poco
// mas). Las demas paginas no se inyectan en el menu, aunque sus rutas
// siguen registradas (no son accesibles desde la UI).
const PRIMO_VISIBLE_KEYS = new Set([
  'inicio',
  'clientes',
  'presupuestos',
  'facturas',
  'gastos',
  'ajustes',
  'ayuda',
]);
import brandIcon from '../assets/brand-icon.png';

// Items base que ven todos los usuarios. La entrada "Productos" se anyade
// dinamicamente cuando la empresa activa tiene tipo_negocio en
// ('productos', 'mixto'). Si el negocio es de servicios puros (pintor,
// consultor, etc.) la pagina no aparece — ahorra ruido.
const items = [
  { to: '/',             label: 'Inicio',       icon: Home,     end: true, key: 'inicio' },
  { to: '/clientes',     label: 'Clientes',     icon: Users,    key: 'clientes' },
  { to: '/presupuestos', label: 'Presupuestos', icon: FileText, key: 'presupuestos' },
  { to: '/facturas',     label: 'Facturas',     icon: Receipt,    key: 'facturas' },
  { to: '/gastos',       label: 'Gastos',       icon: Wallet,     key: 'gastos' },
  { to: '/proveedores',  label: 'Proveedores',  icon: Truck,      key: 'proveedores' },
  { to: '/pedidos',      label: 'Pedidos',      icon: ClipboardList, key: 'pedidos' },
  { to: '/recurrencias', label: 'Recurrencias', icon: Repeat,     key: 'recurrencias' },
  { to: '/notificaciones', label: 'Notificaciones', icon: Bell,   key: 'notificaciones' },
  { to: '/fiscal',       label: 'Resumen fiscal', icon: Calculator, key: 'fiscal' },
  { to: '/marcas',       label: 'Marcas',       icon: TrendingUp, key: 'marcas' },
  { to: '/diana',        label: 'Cuenta Diana', icon: Handshake,  key: 'diana' },
  { to: '/ajustes',      label: 'Ajustes',      icon: Settings,   key: 'ajustes' },
  { to: '/ayuda',        label: 'Ayuda',        icon: BookOpen,   key: 'ayuda' },
];

function Sidebar() {
  const [logoUrl, setLogoUrl] = useState(null);
  const [tipoNegocio, setTipoNegocio] = useState('servicios');
  const [showAcercaDe, setShowAcercaDe] = useState(false);
  const [vencidasCount, setVencidasCount] = useState(0);
  const [notifCount, setNotifCount] = useState(0);

  async function refrescarLogo() {
    if (!window.api) return;
    try {
      const s = await window.api.settings.get();
      if (s && !s.error) {
        setLogoUrl(s.logo_data_url || null);
        setTipoNegocio(s.tipo_negocio || 'servicios');
      }
    } catch { /* noop */ }
  }

  async function refrescarStats() {
    if (!window.api) return;
    try {
      const s = await window.api.home.stats();
      if (s && !s.error) {
        setVencidasCount(s.facturas_vencidas?.count ?? 0);
      }
    } catch { /* noop */ }
  }

  async function refrescarNotifs() {
    if (!window.api?.notif) return;
    try {
      const n = await window.api.notif.countNoLeidas();
      if (typeof n === 'number') setNotifCount(n);
    } catch { /* noop */ }
  }

  useEffect(() => {
    refrescarLogo();
    refrescarStats();
    refrescarNotifs();
    // Recargar cuando Ajustes notifica que ha cambiado settings.
    const onChanged = () => { refrescarLogo(); refrescarNotifs(); };
    const onDataChanged = () => { refrescarStats(); refrescarNotifs(); };
    const onNotifChanged = () => refrescarNotifs();
    const onFocus = () => { refrescarStats(); refrescarNotifs(); };
    window.addEventListener('settings-changed', onChanged);
    window.addEventListener('empresa-changed', onChanged);
    window.addEventListener('data-changed', onDataChanged);
    window.addEventListener('notif-changed', onNotifChanged);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('settings-changed', onChanged);
      window.removeEventListener('empresa-changed', onChanged);
      window.removeEventListener('data-changed', onDataChanged);
      window.removeEventListener('notif-changed', onNotifChanged);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // v1.2.24: Productos siempre visible en el menu. Antes lo gateabamos por
  // tipo_negocio (servicios/productos/mixto), pero la madre lo pidio en
  // empresas tipo 'servicios' tambien (Jose pintor) — incluso un autonomo
  // de servicios puede mantener un catalogo (productos sueltos, suministros).
  // Si no lo usan, la pagina queda vacia: no molesta. tipoNegocio se sigue
  // leyendo para mantener compat futura.
  const menuItems = [...items];
  // Solo inyectamos "Productos" si la variante lo permite. En primo no se
  // muestra ningun cataloog: la build es MVP.
  if (!IS_PRIMO_BUILD) {
    menuItems.splice(2, 0, {
      to: '/productos', label: 'Productos', icon: Package, key: 'productos',
    });
  }
  void tipoNegocio;

  // En la build PRIMO filtramos a lo basico (presupuestos/facturas/clientes/
  // gastos/ajustes/inicio). El resto del menu queda fuera para reducir ruido.
  const visibleItems = IS_PRIMO_BUILD
    ? menuItems.filter((it) => PRIMO_VISIBLE_KEYS.has(it.key))
    : menuItems;

  return (
    <>
      <aside className="w-[220px] shrink-0 bg-slate-900 text-slate-100 flex flex-col p-5 h-full overflow-y-auto min-h-0">
        <div className="px-2 pb-6 pt-2 flex flex-col items-center justify-center min-h-[60px]">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="max-h-[64px] max-w-full object-contain"
            />
          ) : (
            <>
              <img
                src={brandIcon}
                alt="RuyxLabs"
                className="h-12 w-12 mb-2"
              />
              <h1 className="text-xl font-bold text-white tracking-tight leading-tight text-center">
                Ruyx <span className="text-brand">Office</span>
              </h1>
              {/* v1.2.32: en builds privadas (family + primo) quitamos el
                  slogan para que no se solape visualmente con el badge
                  'PRIVADO'/'PRIMO' que va justo debajo. La build publica
                  sigue mostrando el slogan. */}
              {!IS_PRIVATE_BUILD ? (
                <p className="text-[11px] text-slate-400 mt-1">{APP_TAGLINE}</p>
              ) : null}
            </>
          )}
        </div>

        {/* Distintivo de la build de FAMILIA. Solo aparece en la variante
            'family' — así, de un vistazo, se distingue de la pública aunque
            el usuario haya subido su propio logo (que oculta el texto de
            marca). En la build pública este bloque no se renderiza. */}
        {IS_FAMILY_BUILD && (
          <div className="-mt-3 mb-4 flex justify-center">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-bold tracking-[0.15em] uppercase">
              Privado
            </span>
          </div>
        )}
        {IS_PRIMO_BUILD && (
          <div className="-mt-3 mb-4 flex justify-center">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold tracking-[0.15em] uppercase">
              Primo
            </span>
          </div>
        )}

        {/* Selector de empresa activa (multi-empresa). Solo aparece si hay
            al menos una empresa creada (siempre tras la migracion v1.15). */}
        <EmpresaSelector />

        <nav className="flex flex-col gap-1">
          {visibleItems.map(({ to, label, icon: Icon, end, key }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 py-3 px-4 rounded-lg transition-colors',
                  'text-[15px] font-medium',
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                ].join(' ')
              }
            >
              <Icon size={20} />
              <span className="flex-1">{label}</span>
              {key === 'facturas' && vencidasCount > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold"
                  title={`${vencidasCount} factura(s) llevan más de 30 días sin cobrar`}
                >
                  {vencidasCount}
                </span>
              )}
              {key === 'notificaciones' && notifCount > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand text-white text-[11px] font-semibold"
                  title={`${notifCount} notificación(es) sin leer`}
                >
                  {notifCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer del sidebar: version a la izquierda, link "Acerca de" a la
            derecha. Patron habitual en apps de escritorio. mt-auto empuja
            todo al fondo del flex column. */}
        <div className="mt-auto pt-6 px-2 text-xs text-slate-500 flex items-center justify-between gap-2">
          <span className="truncate">v{APP_VERSION}</span>
          <button
            type="button"
            onClick={() => setShowAcercaDe(true)}
            className="text-slate-400 hover:text-slate-200 transition-colors shrink-0"
          >
            Acerca de
          </button>
        </div>
      </aside>

      {showAcercaDe && (
        <AcercaDeModal onClose={() => setShowAcercaDe(false)} />
      )}
    </>
  );
}

export default Sidebar;
