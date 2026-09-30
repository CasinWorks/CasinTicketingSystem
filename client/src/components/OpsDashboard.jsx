import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useTheme } from '../ThemeContext';

const FALLBACK_COLORS = ['#5BA3D9', '#E8A838', '#7BC67E', '#E07A9A', '#9B8FE8'];

function GroupLegend({ items, total, colors, plural }) {
  if (!items?.length) return null;
  return (
    <ul className="pie-legend">
      {items.map((item, i) => {
        const pct = total === 0 ? 0 : Math.round((item.count / total) * 100);
        const color = colors[item.name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
        const label = plural[item.name] || item.name;
        return (
          <li key={item.name}>
            <span className="swatch" style={{ background: color }} />
            <span className="legend-label">{label}</span>
            <span className="legend-meta">
              {item.count} · {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function OpsDashboard({
  meta,
  fetchStats,
  awaitingSheet = false,
  dataLabel = 'sample data',
}) {
  const { theme } = useTheme();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchStats();
      setStats(data);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [fetchStats]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const axisColor = theme === 'dark' ? '#8B95A8' : '#64748B';
  const gridColor = theme === 'dark' ? '#2A3341' : '#E2E8F0';
  const tooltipStyle = {
    background: theme === 'dark' ? '#1A222C' : '#FFFFFF',
    border: `1px solid ${gridColor}`,
    borderRadius: 8,
    color: theme === 'dark' ? '#F1F5F9' : '#0F172A',
  };

  const totals = stats?.totals || { total: 0, open: 0, resolved: 0, completionPct: 0, winRate: 0 };
  const categoryTotal = useMemo(
    () => (stats?.byCategory || []).reduce((sum, c) => sum + c.count, 0),
    [stats]
  );
  const sprintDays = stats?.sprintDays || 10;

  return (
    <div className="dashboard ref-dash">
      <header className="dash-head">
        <h1>{meta.dashboardTitle}</h1>
        <p className="dash-sub">
          Sprint of {sprintDays} working days · {dataLabel}
        </p>
      </header>

      {awaitingSheet ? (
        <p className="ops-banner">
          Dashboard is ready with sample data. Paste the Google Sheet ID in{' '}
          <code>server/.env</code> when Geoff shares the link — then this op goes live.
        </p>
      ) : null}

      {error ? <p className="error-text" role="alert">{error}</p> : null}

      <div className="kpi-grid">
        {meta.kpi.map((k) => {
          const raw = totals[k.key] ?? totals[k.fallbackKey] ?? 0;
          return (
            <article className="kpi" key={k.key}>
              <p className="kpi-value">
                {raw}
                {k.suffix || ''}
              </p>
              <p className="kpi-label">{k.label}</p>
            </article>
          );
        })}
      </div>

      <div className="chart-grid">
        <section className="panel chart-panel">
          <h2>{meta.groupTitle}</h2>
          <div className="chart-box pie-box">
            {stats?.byCategory?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.byCategory}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    stroke="none"
                  >
                    {stats.byCategory.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={meta.colors[entry.name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => {
                      const pct =
                        categoryTotal === 0 ? 0 : Math.round((value / categoryTotal) * 100);
                      return [`${value} (${pct}%)`, meta.plural[name] || name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No category data yet.</p>
            )}
          </div>
          <GroupLegend
            items={stats?.byCategory}
            total={categoryTotal}
            colors={meta.colors}
            plural={meta.plural}
          />
        </section>

        <section className="panel chart-panel">
          <h2>{meta.burnTitle}</h2>
          <div className="chart-box burn-box">
            {stats?.burnup?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={stats.burnup} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="day"
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 12 }}
                    axisLine={{ stroke: gridColor }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={36}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="plainline"
                    wrapperStyle={{ paddingTop: 8, fontSize: 13, color: axisColor }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    name="Completed"
                    stroke="#5BA3D9"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#5BA3D9', strokeWidth: 0 }}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="scope"
                    name="Total scope"
                    stroke="#D3615A"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ideal"
                    name="Ideal pace"
                    stroke={theme === 'dark' ? '#8B95A8' : '#94A3B8'}
                    strokeWidth={2}
                    strokeDasharray="6 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No burn-up data yet.</p>
            )}
          </div>
          {stats?.scopeNote ? <p className="chart-caption">{stats.scopeNote}</p> : null}
        </section>
      </div>
    </div>
  );
}
