import { useCallback, useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../../api';
import { useTheme } from '../../ThemeContext';
import { formatPhp } from '../../money';

export default function CashPage() {
  const { theme } = useTheme();
  const [business, setBusiness] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const json = await api.listFinanceCash();
      setBusiness(json.business || []);
      setPersonal(json.personal || []);
      setLatest(json.latest || null);
      setWarning(json.sheetWarning || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const axis = theme === 'dark' ? '#8B95A8' : '#64748B';
  const grid = theme === 'dark' ? '#2A3341' : '#E2E8F0';
  const tip = {
    background: theme === 'dark' ? '#1A222C' : '#fff',
    border: `1px solid ${grid}`,
    borderRadius: 8,
    color: theme === 'dark' ? '#F1F5F9' : '#0F172A',
  };

  return (
    <section className="panel wide">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Cash</h1>
          <p className="muted">
            Latest business balance {latest ? `${formatPhp(latest.balance)} on ${latest.date}` : '—'}.
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      {warning ? <p className="ops-banner">{warning}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="muted">Loading cash…</p> : null}

      <section className="panel chart-panel" style={{ marginBottom: '1rem' }}>
        <h2>Business cash history</h2>
        <div className="chart-box burn-box">
          {business.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={business}>
                <CartesianGrid stroke={grid} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={axis} tick={{ fill: axis, fontSize: 12 }} />
                <YAxis
                  stroke={axis}
                  tick={{ fill: axis, fontSize: 12 }}
                  tickFormatter={(v) => `₱${Math.round(v / 1000)}k`}
                />
                <Tooltip contentStyle={tip} formatter={(v) => [formatPhp(v), 'Balance']} />
                <Line type="monotone" dataKey="balance" stroke="#5DBF9A" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">No business cash rows yet.</p>
          )}
        </div>
      </section>

      <h2>Business balances</h2>
      <div className="ticket-table-wrap" style={{ marginBottom: '1.5rem' }}>
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Balance</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {[...business].reverse().map((r) => (
              <tr key={r.date}>
                <td className="mono">{r.date}</td>
                <td className="mono">{formatPhp(r.balance)}</td>
                <td className="muted small">{r.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Personal (excluded from business cash)</h2>
      <p className="muted small" style={{ marginBottom: '0.75rem' }}>
        Never counted toward runway or business cash KPIs.
      </p>
      <div className="ticket-table-wrap">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Amount / range</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {personal.map((r) => (
              <tr key={r.item}>
                <td>{r.item}</td>
                <td className="mono">{r.amountText || formatPhp(r.amount)}</td>
                <td className="muted small">{r.note || '—'}</td>
              </tr>
            ))}
            {!personal.length ? (
              <tr>
                <td colSpan={3} className="muted">
                  No personal cash rows.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
