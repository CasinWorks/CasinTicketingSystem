import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';

export default function OpsHome() {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [ops, setOps] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listOps()
      .then((data) => {
        if (!cancelled) {
          setOps(data);
          setError('');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        if (err.status === 401) {
          clearToken();
          navigate('/login', { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="ops-home">
      <header className="ops-home-top">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="brand">CasinWorks OPS</p>
            <p className="brand-sub">Operations hub</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn ghost" onClick={toggleTheme}>
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button type="button" className="btn ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <section className="ops-hero">
        <h1>Choose an operation</h1>
        <p className="muted">
          Pick Service Desk, Project Manager, Leads, or Finance. Each op uses its own Google Sheet as
          source of truth.
        </p>
      </section>

      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {loading ? <p className="muted">Loading operations…</p> : null}

      <div className="ops-grid">
        {ops.map((op) => (
          <Link
            key={op.id}
            to={`/ops/${op.id}`}
            className="ops-card"
            style={{ '--op-accent': op.accent }}
          >
            <span className="ops-card-accent" aria-hidden="true" />
            <div className="ops-card-body">
              <p className="ops-card-status">{op.statusLabel}</p>
              <h2>{op.name}</h2>
              <p className="muted">{op.description}</p>
              <span className="ops-card-cta">Open {op.name} →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
