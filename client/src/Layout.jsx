import { NavLink, Outlet, Navigate, Link, useParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { OPS_META } from './opsMeta';

export function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export function RequireOwner({ children }) {
  const { isAuthenticated, isOwner, roleLoaded } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!roleLoaded) return <p className="muted" style={{ padding: '2rem' }}>Checking access…</p>;
  if (!isOwner) return <Navigate to="/" replace />;
  return children;
}

export function OpsLayout() {
  const { opId } = useParams();
  const meta = OPS_META[opId];
  const { logout, isOwner } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (!meta) return <Navigate to="/" replace />;
  if (meta.ownerOnly && !isOwner) return <Navigate to="/" replace />;

  const navItems = meta.nav?.length
    ? meta.nav
    : [
        { to: meta.basePath, label: 'Dashboard', end: true },
        { to: meta.listPath, label: meta.listLabel },
        { to: meta.newPath, label: meta.newLabel },
      ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand-block">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="brand">CasinWorks OPS</p>
            <p className="brand-sub">{meta.name}</p>
          </div>
        </Link>

        <nav className="nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={Boolean(item.end)}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-actions">
          <Link className="btn ghost" to="/">
            All ops
          </Link>
          <button type="button" className="btn ghost" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button type="button" className="btn ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className={`page${meta.id === 'finance' ? ' page-finance' : ''}`}>
        <Outlet context={{ meta }} />
      </main>
    </div>
  );
}

/** @deprecated kept for any old imports */
export default function Layout() {
  return <Navigate to="/" replace />;
}
