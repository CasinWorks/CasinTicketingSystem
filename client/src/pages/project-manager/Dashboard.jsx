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

const STAGE_COLORS = {
  Idea: '#5BA3D9',
  Beta: '#E8A838',
  MVP: '#7BC67E',
  Live: '#E07A9A',
};
const FALLBACK = ['#5BA3D9', '#E8A838', '#7BC67E', '#E07A9A', '#9B8FE8'];

export default function ProjectDashboard() {
  const { theme } = useTheme();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setStats(await api.getProjectStats());
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
  const doneCount =
    t.done ??
    stats?.byStatus?.find((row) => /^done$/i.test(String(row.name || '').trim()))?.count ??
    0;

  return (
    <div className="dashboard ref-dash">
      <header className="dash-head">
        <h1>Project portfolio</h1>
        <p className="dash-sub">
          CasinWorks delivery board — status, stage, and what needs attention
          {stats?.source === 'sheet' ? ' · live sheet' : ''}
        </p>
      </header>

      {stats?.sheetWarning ? <p className="ops-banner">{stats.sheetWarning}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="kpi-grid">
        <article className="kpi">
          <p className="kpi-value">{t.total ?? 0}</p>
          <p className="kpi-label">Projects</p>
        </article>
        <article className="kpi">
          <p className="kpi-value">{t.active ?? 0}</p>
          <p className="kpi-label">Active</p>
        </article>
        <article className="kpi">
          <p className="kpi-value">{t.atRisk ?? 0}</p>
          <p className="kpi-label">Blocked / due soon</p>
        </article>
        <article className="kpi">
          <p className="kpi-value">{doneCount}</p>
          <p className="kpi-label">Done</p>
        </article>
        <article className="kpi">
          <p className="kpi-value">{t.liveStage ?? 0}</p>
          <p className="kpi-label">Live products</p>
        </article>
      </div>

      <div className="chart-grid">
        <section className="panel chart-panel">
          <h2>By status</h2>
          <p className="muted small">Active, on hold, blocked, and done — from the Projects sheet.</p>
          <div className="chart-box burn-box">
            {stats?.byStatus?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.byStatus} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} stroke={axis} tick={{ fill: axis, fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={80} stroke={axis} tick={{ fill: axis, fontSize: 12 }} />
                  <Tooltip contentStyle={tip} />
                  <Bar dataKey="count" name="Projects" fill="#7BC67E" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No status data yet.</p>
            )}
          </div>
        </section>

        <section className="panel chart-panel">
          <h2>By stage</h2>
          <p className="muted small">Idea → Beta → MVP → Live maturity.</p>
          <div className="chart-box pie-box">
            {stats?.byStage?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={stats.byStage} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={95} stroke="none">
                    {stats.byStage.map((entry, i) => (
                      <Cell key={entry.name} fill={STAGE_COLORS[entry.name] || FALLBACK[i % FALLBACK.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tip} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No stage data yet.</p>
            )}
          </div>
        </section>
      </div>

      <div className="chart-grid" style={{ marginTop: '0.85rem' }}>
        <section className="panel chart-panel">
          <h2>By priority</h2>
          <p className="muted small">P0–P3 focus distribution.</p>
          <div className="chart-box burn-box">
            {stats?.byPriority?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.byPriority}>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke={axis} tick={{ fill: axis, fontSize: 12 }} />
                  <YAxis allowDecimals={false} stroke={axis} tick={{ fill: axis, fontSize: 12 }} />
                  <Tooltip contentStyle={tip} />
                  <Bar dataKey="count" name="Projects" fill="#5BA3D9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No priority data yet.</p>
            )}
          </div>
        </section>

        <section className="panel chart-panel">
          <h2>Needs attention</h2>
          <p className="muted small">Blocked, on hold, has blockers, or deadline within 7 days.</p>
          {stats?.attention?.length ? (
            <ul className="attention-list">
              {stats.attention.map((p) => (
                <li key={p.id}>
                  <div>
                    <strong>{p.title}</strong>
                    <span className="muted small">
                      {p.priority} · {p.stage} · {p.focus?.slice(0, 70) || p.blockers?.slice(0, 70) || '—'}
                    </span>
                  </div>
                  <div className="attention-meta">
                    <span className="prio prio-high">{p.status}</span>
                    <span className="muted small">{p.dueDate ? `Due ${p.dueDate}` : 'No deadline'}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ marginTop: '1rem' }}>
              Nothing flagged.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
