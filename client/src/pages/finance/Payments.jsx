import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { formatPhp } from '../../money';

const STATUSES = ['All', 'Not billed', 'Billed', 'Paid', 'Partial', 'Overdue'];

export default function PaymentsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [projectFilter, setProjectFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const json = await api.listFinancePayments();
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

  const projects = useMemo(() => {
    const ids = [...new Set(items.map((p) => p.projectId).filter(Boolean))];
    return ids.sort();
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter((p) => {
        if (projectFilter !== 'All' && p.projectId !== projectFilter) return false;
        if (statusFilter !== 'All' && p.status !== statusFilter) return false;
        if (fromDate && p.dueDate && p.dueDate < fromDate) return false;
        if (toDate && p.dueDate && p.dueDate > toDate) return false;
        return true;
      }),
    [items, projectFilter, statusFilter, fromDate, toDate]
  );

  return (
    <section className="panel wide">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Payments</h1>
          <p className="muted">Milestones, receipts, and overdue highlighting.</p>
        </div>
        <button type="button" className="btn ghost" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      {warning ? <p className="ops-banner">{warning}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="filters">
        <label>
          Project
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="All">All</option>
            {projects.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
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
          Due from
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label>
          Due to
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <p className="filter-count muted">
          Showing {filtered.length} of {items.length}
        </p>
      </div>

      {loading ? <p className="muted">Loading payments…</p> : null}

      <div className="ticket-table-wrap">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Payment</th>
              <th>Project</th>
              <th>Milestone</th>
              <th>Due</th>
              <th>Received</th>
              <th>Due date</th>
              <th>Status</th>
              <th>Off books</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const overdue =
                /^overdue$/i.test(p.status) ||
                (p.dueDate &&
                  p.dueDate < new Date().toISOString().slice(0, 10) &&
                  (p.amountReceived || 0) < (p.amountDue || 0));
              return (
                <tr key={p.paymentId} className={overdue ? 'row-overdue' : undefined}>
                  <td className="mono">{p.paymentId}</td>
                  <td>
                    <div className="title-cell">
                      <strong>{p.client || p.projectId}</strong>
                      <span className="muted small">
                        {p.projectId}
                        {p.pmId ? (
                          <>
                            {' · '}
                            <Link to={p.pmPath || '/ops/project-manager/projects'}>{p.pmTitle}</Link>
                          </>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td>{p.milestone}</td>
                  <td className="mono">{formatPhp(p.amountDue)}</td>
                  <td className="mono">{formatPhp(p.amountReceived)}</td>
                  <td className="mono">{p.dueDate || '—'}</td>
                  <td>
                    <span className={`status-badge status-${slug(p.status)}`}>{p.status}</span>
                  </td>
                  <td>{p.offBooks ? 'Y' : 'N'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}
