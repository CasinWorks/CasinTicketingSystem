import { useCallback, useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { api } from '../../api';
import { useTheme } from '../../ThemeContext';

const FALLBACK = ['#5BA3D9', '#E8A838', '#7BC67E', '#E07A9A', '#9B8FE8'];

function money(n) {
  return Number(n || 0).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  });
}

export default function LeadsDashboard() {
  const { theme } = useTheme();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setStats(await api.getLeadStats());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
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

  const t = stats?.totals || {};

  return (
    <div className="dashboard ref-dash">
      <header className="dash-head">
        <h1>Sales pipeline</h1>
        <p className="dash-sub">
          CasinWorks leads — follow-ups, warmth, and quoted pipeline (₱)
          {stats?.source === 'sheet' ? ' · live sheet' : ''}
        </p>
      </header>

      {stats?.sheetWarning ? <p className="ops-banner">{stats.sheetWarning}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="kpi-grid">
        <article className="kpi">
          <p className="kpi-value">{t.total ?? 0}</p>
          <p className="kpi-label">Leads</p>
        </article>
        <article className="kpi">
          <p className="kpi-value">{t.newCount ?? 0}</p>
          <p className="kpi-label">New</p>
        </article>
        <article className="kpi">
          <p className="kpi-value">{t.waitingCount ?? 0}</p>
          <p className="kpi-label">Waiting on reply</p>
        </article>
        <article className="kpi">
          <p className="kpi-value">{money(t.pipelineValue)}</p>
          <p className="kpi-label">Quoted / target ₱</p>
        </article>
      </div>

      <div className="chart-grid">
        <section className="panel chart-panel">
          <h2>By status</h2>
          <p className="muted small">New · Warm · Waiting — deal temperature.</p>
          <div className="chart-box burn-box">
            {stats?.byStage?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.byStage} margin={{ left: 8, right: 12 }}>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke={axis} tick={{ fill: axis, fontSize: 12 }} />
                  <YAxis allowDecimals={false} stroke={axis} tick={{ fill: axis, fontSize: 12 }} />
                  <Tooltip
                    contentStyle={tip}
                    formatter={(value, name) =>
                      name === 'value' ? [money(value), 'Pipeline ₱'] : [value, 'Count']
                    }
                  />
                  <Legend />
                  <Bar dataKey="count" name="count" fill="#5BA3D9" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="value" name="value" fill="#E8A838" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No status data yet.</p>
            )}
          </div>
          <p className="chart-caption">
            Avg sized opportunity: {money(t.avgDealSize)} · Follow-ups due: {t.followUpsDueCount ?? 0}
          </p>
        </section>

        <section className="panel chart-panel">
          <h2>By priority</h2>
          <p className="muted small">P0 / P1 focus for outreach this week.</p>
          <div className="chart-box pie-box">
            {stats?.byPriority?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={stats.byPriority} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={95} stroke="none">
                    {stats.byPriority.map((entry, i) => (
                      <Cell key={entry.name} fill={FALLBACK[i % FALLBACK.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tip} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No priority data yet.</p>
            )}
          </div>
        </section>
      </div>

      <div className="chart-grid" style={{ marginTop: '0.85rem' }}>
        <section className="panel chart-panel">
          <h2>By source</h2>
          <p className="muted small">Where opportunities come from.</p>
          <div className="chart-box burn-box">
            {stats?.byCategory?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.byCategory} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} stroke={axis} tick={{ fill: axis, fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    stroke={axis}
                    tick={{ fill: axis, fontSize: 10 }}
                  />
                  <Tooltip contentStyle={tip} />
                  <Bar dataKey="count" name="Leads" fill="#E07A9A" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No source data yet.</p>
            )}
          </div>
        </section>

        <section className="panel chart-panel">
          <h2>Priority outreach</h2>
          <p className="muted small">Highest priority open leads (value parsed from ₱ notes when present).</p>
          {stats?.hotLeads?.length ? (
            <ul className="attention-list">
              {stats.hotLeads.map((l) => (
                <li key={l.id}>
                  <div>
                    <strong>{l.company}</strong>
                    <span className="muted small">
                      {l.priority} · {l.status} · {l.title?.slice(0, 80)}
                    </span>
                  </div>
                  <div className="attention-meta">
                    <span className="mono">{l.value ? money(l.value) : '—'}</span>
                    <span className="muted small">{l.followUp ? `Follow up ${l.followUp}` : ''}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ marginTop: '1rem' }}>
              No open leads.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
