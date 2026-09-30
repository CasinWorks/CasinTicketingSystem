import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';

const STATUSES = ['All', 'New', 'Warm', 'Waiting'];

function money(n) {
  if (!n) return '—';
  return Number(n).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  });
}

export default function LeadList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const load = useCallback(async () => {
    setError('');
    try {
      const json = await api.listLeadsMeta();
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
    () => items.filter((l) => statusFilter === 'All' || l.Status === statusFilter),
    [items, statusFilter]
  );

  return (
    <section className="panel wide">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h1>Leads</h1>
          <p className="muted">Live from the CasinWorks Leads sheet. ₱ amounts parsed from notes when present.</p>
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
        <p className="filter-count muted">
          Showing {filtered.length} of {items.length}
        </p>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="muted">Loading leads…</p> : null}

      <div className="ticket-table-wrap">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Source</th>
              <th>Follow up</th>
              <th>Next action</th>
              <th>Est. ₱</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.ID}>
                <td>
                  <div className="title-cell">
                    <strong>{l.Company}</strong>
                    {l.NotionLink ? (
                      <a className="muted small" href={l.NotionLink} target="_blank" rel="noreferrer">
                        Notion →
                      </a>
                    ) : null}
                  </div>
                </td>
                <td>
                  <span
                    className={`prio prio-${
                      l.Priority === 'P0' ? 'critical' : l.Priority === 'P1' ? 'high' : 'medium'
                    }`}
                  >
                    {l.Priority}
                  </span>
                </td>
                <td>{l.Status}</td>
                <td className="muted small">{l.Source}</td>
                <td className="mono">{l.FollowUp || '—'}</td>
                <td className="muted small">{l.NextAction?.slice(0, 90) || '—'}</td>
                <td className="mono">{money(l.Value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
