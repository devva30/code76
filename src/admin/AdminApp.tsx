import { ContentHome, SectionEditor } from './content/ContentPages';
import { SettingsPage } from './settings/SettingsPage';
import { useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { History, Images, Layers, LayoutDashboard, LogOut, Mail, Menu, Package, PanelsTopLeft, Settings, Shirt, Store, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { Wordmark } from '@/components/ui/Wordmark';
import { cx } from '@/lib/format';
import { AdminButton, Loading } from './ui';
import Dashboard from './pages/Dashboard';
import Activity from './pages/Activity';
import Subscribers from './pages/Subscribers';
import MediaLibrary from './media/MediaLibrary';
import ProductList from './products/ProductList';
import ProductEditor from './products/ProductEditor';
import CollectionsPage from './products/CollectionsPage';
import OrderList from './orders/OrderList';
import AdminOrderPage from './orders/AdminOrderPage';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: Package },
  { to: '/admin/products', label: 'Products', icon: Shirt },
  { to: '/admin/collections', label: 'Collections', icon: Layers },
  { to: '/admin/content', label: 'Website content', icon: PanelsTopLeft },
  { to: '/admin/media', label: 'Media library', icon: Images },
  { to: '/admin/subscribers', label: 'Subscribers', icon: Mail },
  { to: '/admin/settings', label: 'Store settings', icon: Settings },
  { to: '/admin/activity', label: 'Activity', icon: History },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-rule px-5 py-5">
        <Link to="/admin" onClick={onNavigate} aria-label="Admin dashboard" className="block w-24"><Wordmark /></Link>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-graphite">Admin</span>
      </div>
      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4" data-lenis-prevent>
        <ul className="space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) => cx('flex items-center gap-3 px-3 py-2.5 text-sm transition-colors', isActive ? 'bg-ink text-paper' : 'text-ink hover:bg-newsprint')}
              >
                <Icon className="h-4 w-4" strokeWidth={1.6} /> {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-1 border-t border-rule px-3 py-4 text-sm">
        <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2 text-graphite hover:text-ink">
          <Store className="h-4 w-4" strokeWidth={1.6} /> View store
        </a>
        <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-3 px-3 py-2 text-left text-graphite hover:text-ink">
          <LogOut className="h-4 w-4" strokeWidth={1.6} /> Sign out
        </button>
        <p className="truncate px-3 pt-1 text-xs text-graphite">{user?.email}</p>
      </div>
    </div>
  );
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-svh bg-newsprint text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-rule bg-paper lg:block">
        <Sidebar />
      </aside>

      {/* Phones and tablets: top bar with a slide-in menu */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-rule bg-paper px-4 lg:hidden">
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open admin menu" className="-ml-2 flex h-10 w-10 items-center justify-center">
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.12em]">CODE76 Admin</span>
        <span className="w-10" />
      </header>
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72 bg-paper shadow-xl">
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="absolute right-2 top-3 flex h-10 w-10 items-center justify-center">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <main className="lg:pl-60">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="media" element={<MediaLibrary />} />
          <Route path="activity" element={<Activity />} />
          <Route path="subscribers" element={<Subscribers />} />
          <Route path="orders" element={<OrderList />} />
          <Route path="orders/:orderNumber" element={<AdminOrderPage />} />
          <Route path="products" element={<ProductList />} />
          <Route path="products/:id" element={<ProductEditor />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="content" element={<ContentHome />} />
          <Route path="content/:key" element={<SectionEditor />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

/** Entry point for /admin/*: only admins get past the guard. Loaded on demand, so shoppers never download it. */
export default function AdminApp() {
  const { status, user } = useAuth();
  const { pathname } = useLocation();

  if (status === 'loading') return <div className="px-6"><Loading label="Checking your access…" /></div>;
  if (status === 'unavailable') {
    return <Notice title="Admin needs the server" body="The admin panel works with the CODE76 server, which isn’t connected in this preview." />;
  }
  if (status === 'signed-out') return <Navigate to={`/account?next=${encodeURIComponent(pathname)}`} replace />;
  if (user?.role !== 'admin') {
    return (
      <Notice
        title="No access"
        body={`You’re signed in as ${user?.email ?? 'a customer'}, which isn’t an admin account. Sign in with the store owner’s email, or ask the owner to add yours to the admin list.`}
        action={<SwitchAccount next={pathname} />}
      />
    );
  }
  return <Shell />;
}

/** Signs out and goes straight to the sign-in page, so a wrong login is never a dead end. */
function SwitchAccount({ next }: { next: string }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      navigate(`/account?next=${encodeURIComponent(next)}`, { replace: true });
    }
  };
  return (
    <AdminButton onClick={() => void go()} disabled={busy}>
      <LogOut className="h-4 w-4" strokeWidth={1.6} /> {busy ? 'Signing out…' : 'Sign in with a different account'}
    </AdminButton>
  );
}

function Notice({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-newsprint px-6 text-center">
      <div className="w-28"><Wordmark /></div>
      <h1 className="mt-8 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-graphite">{body}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {action}
        <Link to="/"><AdminButton variant="outline">Back to the store</AdminButton></Link>
      </div>
    </div>
  );
}
