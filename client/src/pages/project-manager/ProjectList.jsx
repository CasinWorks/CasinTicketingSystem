import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';

const STATUSES = ['All', 'Active', 'On hold', 'Blocked', 'Done'];
const STAGES = ['All', 'Idea', 'Beta', 'MVP', 'Live', 'Paused'];

export default function ProjectList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');

  const load = useCallback(async () => {
    setError('');
    try {
      const json = await api.listProjectsMeta();
      setItems(json.items || []);
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

  const filtered = useMemo(
    () =>
      items.filter((p) => {
        if (statusFilter !== 'All' && p.Status !== statusFilter) return false;
        if (stageFilter !== 'All' && p.Stage !== stageFilter) return false;
        return true;
      }),
    [items, statusFilter, stageFilter]
  );

  return (
    <section className="panel wide">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Delivery</p>
          <h1>Projects</h1>
          <p className="muted">Live from the CasinWorks Project Tracker sheet.</p>
        </div>
        <button type="button" className="btn ghost" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      {warning ? <p className="ops-banner">{warning}</p> : null}

      <div className="filters">
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stage
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <p className="filter-count muted">
          Showing {filtered.length} of {items.length}
        </p>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="muted">Loading projects…</p> : null}

      <div className="ticket-table-wrap">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Priority</th>
              <th>Stage</th>
              <th>Status</th>
              <th>Deadline</th>
              <th>Focus now</th>
              <th>Blockers</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.ID}>
                <td>
                  <div className="title-cell">
                    <strong>{p.Title}</strong>
                    {p.NotionLink ? (
                      <a className="muted small" href={p.NotionLink} target="_blank" rel="noreferrer">
                        Notion →
                      </a>
                    ) : null}
                  </div>
                </td>
                <td>
                  <span
                    className={`prio prio-${
                      p.Priority === 'P0' ? 'critical' : p.Priority === 'P1' ? 'high' : 'medium'
                    }`}
                  >
                    {p.Priority}
                  </span>
                </td>
                <td>{p.Stage}</td>
                <td>{p.Status}</td>
                <td className="mono">{p.DueDate || '—'}</td>
                <td className="muted small">{p.FocusNow?.slice(0, 90) || '—'}</td>
                <td className="muted small">{p.Blockers?.slice(0, 70) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
