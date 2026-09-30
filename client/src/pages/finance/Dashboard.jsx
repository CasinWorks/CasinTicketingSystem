import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { api } from '../../api';
import { useTheme } from '../../ThemeContext';
import { formatPhp, formatPhpOrZero } from '../../money';

const STATUS_COLORS = {
  Guaranteed: '#7BC67E',
  Hopeful: '#5BA3D9',
  'At risk': '#E8A838',
  'Early stage': '#9B8FE8',
  Lost: '#8B95A8',
};

export default function FinanceDashboard() {
  const { theme } = useTheme();
  const [includeOffBooks, setIncludeOffBooks] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setStats(await api.getFinanceDashboard(includeOffBooks));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [includeOffBooks]);

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const axis = theme === 'dark' ? '#8B95A8' : '#64748B';
  const grid = theme === 'dark' ? '#2A3341' : '#E2E8F0';
  const tip = {
    background: theme === 'dark' ? '#1A222C' : '#fff',
    border: `1px solid ${grid}`,
    borderRadius: 8,
    color: theme === 'dark' ? '#F1F5F9' : '#0F172A',
  };

  const k = stats?.kpis || {};

  return (
    <div className="dashboard ref-dash">
      <header className="dash-head" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1>Where am I right now</h1>
          <p className="dash-sub">
            Business cash, runway, and pipeline — never mix hopeful/at-risk into cash
            {stats?.source === 'sheet' ? ' · live sheet' : ''}
          </p>
        </div>
        <label className="finance-toggle">
          <input
            type="checkbox"
            checked={includeOffBooks}
            onChange={(e) => setIncludeOffBooks(e.target.checked)}
          />
          Include off-books
        </label>
      </header>

      {stats?.sheetWarning ? <p className="ops-banner">{stats.sheetWarning}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {loading && !stats ? <p className="muted">Loading finance…</p> : null}

      <div className="kpi-grid finance-kpi-grid">
        <article className="kpi">
          <p className="kpi-value">{formatPhpOrZero(k.businessCash)}</p>
          <p className="kpi-label">Business cash</p>
          <p className="muted small">{k.cashDate ? `As of ${k.cashDate}` : 'No cash row'}</p>
        </article>
        <article className="kpi">
          <p className="kpi-value">
            {k.runwayNote ? (
              <Link to="/ops/finance/settings" className="kpi-link">
                {k.runwayNote}
              </Link>
            ) : (
              `${k.runwayWeeks ?? '—'} wks`
            )}
          </p>
          <p className="kpi-label">Runway</p>
          <p className="muted small">cash ÷ (burn / 4.33)</p>
        </article>
        <article className="kpi">
          <p className="kpi-value">{formatPhpOrZero(k.guaranteedStillOwed)}</p>
          <p className="kpi-label">Guaranteed still owed</p>
          <p className="muted small">On-books only: {formatPhpOrZero(k.guaranteedStillOwedOnBooks)}</p>
        </article>
        <article className="kpi">
          <p className="kpi-value">{k.overdueCount ?? 0}</p>
          <p className="kpi-label">Overdue</p>
          <p className="muted small">{formatPhpOrZero(k.overdueAmount)} outstanding</p>
        </article>
        <article className="kpi">
          <p className="kpi-value">{formatPhpOrZero(k.hopefulPipeline)}</p>
          <p className="kpi-label">Hopeful pipeline</p>
          <p className="muted small">NOT cash</p>
        </article>
        <article className="kpi">
          <p className="kpi-value">{formatPhpOrZero(k.atRiskEarlyPipeline)}</p>
          <p className="kpi-label">At-risk + early stage</p>
          <p className="muted small">NOT cash</p>
        </article>
        <article className="kpi">
          <p className="kpi-value">{formatPhpOrZero(k.totalAssets)}</p>
          <p className="kpi-label">Total assets</p>
        </article>
      </div>

      <div className="chart-grid" style={{ marginTop: '0.85rem' }}>
        <section className="panel chart-panel">
          <h2>Alerts</h2>
          <p className="muted small">Pause-work thresholds and partial shortfalls.</p>
          {stats?.alerts?.length ? (
            <ul className="attention-list">
              {stats.alerts.map((a) => (
                <li key={`${a.type}-${a.paymentId}`}>
                  <div>
                    <strong>{a.title}</strong>
                    <span className="muted small">{a.detail}</span>
                  </div>
                  <span className={`prio ${a.severity === 'critical' ? 'prio-critical' : 'prio-high'}`}>
                    {formatPhp(a.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ marginTop: '1rem' }}>
              No alerts.
            </p>
          )}
        </section>

        <section className="panel chart-panel">
          <h2>Upcoming (30 days)</h2>
          <p className="muted small">Payments due in the next month.</p>
          {stats?.upcoming?.length ? (
            <ul className="attention-list">
              {stats.upcoming.map((p) => (
                <li key={p.paymentId}>
                  <div>
                    <strong>
                      {p.client || p.projectId} · {p.milestone}
                    </strong>
                    <span className="muted small">
                      Due {p.dueDate} · {p.status}
                    </span>
                  </div>
                  <span className="mono">{formatPhp(p.balance || p.amountDue)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ marginTop: '1rem' }}>
              Nothing due in the next 30 days.
            </p>
          )}
        </section>
      </div>

      <div className="chart-grid" style={{ marginTop: '0.85rem' }}>
        <section className="panel chart-panel">
          <h2>Pipeline by status</h2>
          <p className="muted small">Contract value — not cash.</p>
          <div className="chart-box burn-box">
            {stats?.pipelineByStatus?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.pipelineByStatus} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke={axis}
                    tick={{ fill: axis, fontSize: 12 }}
                    tickFormatter={(v) => `₱${Math.round(v / 1000)}k`}
                  />
                  <YAxis type="category" dataKey="name" width={90} stroke={axis} tick={{ fill: axis, fontSize: 12 }} />
                  <Tooltip
                    contentStyle={tip}
                    formatter={(value) => [formatPhp(value), 'Contract value']}
                  />
                  <Bar dataKey="value" name="Value" radius={[0, 6, 6, 0]}>
                    {stats.pipelineByStatus.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#5DBF9A'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No billing rows yet.</p>
            )}
          </div>
          {stats?.pipelineByStatus?.length ? (
            <table className="ticket-table" style={{ marginTop: '0.75rem' }}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {stats.pipelineByStatus.map((row) => (
                  <tr key={row.name}>
                    <td>
                      <span className={`status-badge status-${slug(row.name)}`}>{row.name}</span>
                    </td>
                    <td>{row.count}</td>
                    <td className="mono">{formatPhp(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <section className="panel chart-panel">
          <h2>Concentration by referrer</h2>
          <p className="muted small">Share of total pipeline (excl. Lost).</p>
          {stats?.concentrationWarning ? (
            <p className="ops-banner">
              Warning: {stats.concentrationWarning.name} is {stats.concentrationWarning.sharePct}% of
              pipeline (&gt;50%).
            </p>
          ) : null}
          {stats?.concentration?.length ? (
            <table className="ticket-table">
              <thead>
                <tr>
                  <th>Referred by</th>
                  <th>Pipeline</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {stats.concentration.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td className="mono">{formatPhp(row.value)}</td>
                    <td>{row.sharePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No pipeline concentration data.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}
