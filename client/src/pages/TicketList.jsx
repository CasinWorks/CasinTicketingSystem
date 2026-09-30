import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const CATEGORIES = ['Incident', 'Service Request', 'Access', 'Change', 'Problem'];

export default function TicketList() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [savingId, setSavingId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api.listTickets();
      setTickets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== 'All' && t.Status !== statusFilter) return false;
      if (categoryFilter !== 'All' && t.Category !== categoryFilter) return false;
      return true;
    });
  }, [tickets, statusFilter, categoryFilter]);

  async function patchTicket(id, patch) {
    setSavingId(id);
    setError('');
    try {
      const updated = await api.updateTicket(id, patch);
      setTickets((prev) => prev.map((t) => (t.ID === id ? updated : t)));
    } catch (err) {
      setError(err.message);
      await load();
    } finally {
      setSavingId('');
    }
  }

  return (
    <section className="panel wide">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Queue</p>
          <h1>Tickets</h1>
          <p className="muted">Filter the queue and update status or assignee inline.</p>
        </div>
        <button type="button" className="btn ghost" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      <div className="filters">
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="All">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <p className="filter-count muted">
          Showing {filtered.length} of {tickets.length}
        </p>
      </div>

      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {loading ? <p className="muted">Loading tickets…</p> : null}

      {!loading && filtered.length === 0 ? (
        <p className="muted">No tickets match these filters.</p>
      ) : null}

      <div className="ticket-table-wrap">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Client</th>
              <th>Project</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assignee</th>
              <th>Requester</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.ID} className={savingId === t.ID ? 'row-saving' : ''}>
                <td className="mono">{t.ID}</td>
                <td>
                  <div className="title-cell">
                    <strong>{t.Title}</strong>
                    <span className="muted small">{t.Description?.slice(0, 80)}</span>
                  </div>
                </td>
                <td>{t.Client || '—'}</td>
                <td>{t.Project || '—'}</td>
                <td>{t.Category}</td>
                <td>
                  <span className={`prio prio-${t.Priority?.toLowerCase()}`}>{t.Priority}</span>
                </td>
                <td>
                  <select
                    value={t.Status}
                    disabled={savingId === t.ID}
                    onChange={(e) => patchTicket(t.ID, { status: e.target.value })}
                    aria-label={`Status for ${t.ID}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="inline-input"
                    defaultValue={t.Assignee}
                    key={`${t.ID}-${t.Assignee}-${t.UpdatedAt}`}
                    disabled={savingId === t.ID}
                    placeholder="Unassigned"
                    aria-label={`Assignee for ${t.ID}`}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next !== (t.Assignee || '')) {
                        patchTicket(t.ID, { assignee: next });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                  />
                </td>
                <td>{t.Requester}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
