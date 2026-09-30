import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';

export default function Login() {
  const { isAuthenticated, login, error, clearError } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    clearError();
    setBusy(true);
    await login(password);
    setBusy(false);
  }

  return (
    <div className="login-screen">
      <button type="button" className="btn ghost theme-float" onClick={toggleTheme}>
        {theme === 'light' ? 'Dark' : 'Light'}
      </button>

      <section className="login-panel">
        <div className="login-brand-row">
          <img className="login-logo" src="/app-icon.png" alt="" width={72} height={72} />
          <p className="brand login-brand">CasinWorks OPS</p>
        </div>
        <h1>Sign in to operations</h1>
        <p className="muted">Enter the shared workspace password to open Service Desk, Project Manager, or Leads.</p>

        <form onSubmit={onSubmit} className="stack-form">
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="error-text" role="alert">{error}</p> : null}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  );
}
