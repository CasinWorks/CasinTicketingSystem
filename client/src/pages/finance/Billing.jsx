import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { formatPhp } from '../../money';

const STATUSES = ['All', 'Guaranteed', 'Hopeful', 'At risk', 'Early stage', 'Lost'];

export default function BillingPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [offBooksFilter, setOffBooksFilter] = useState('All');

  const load = useCallback(async () => {
    setError('');
    try {
      const json = await api.listFinanceBilling();
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
      items.filter((b) => {
        if (statusFilter !== 'All' && b.status !== statusFilter) return false;
        if (offBooksFilter === 'On-books' && b.offBooks) return false;
        if (offBooksFilter === 'Off-books' && !b.offBooks) return false;
        return true;
      }),
    [items, statusFilter, offBooksFilter]
  );

  return (
    <section className="panel wide">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Billing</h1>
          <p className="muted">Contract pipeline from the Finance sheet. Read-only — Manny writes.</p>
        </div>
        <button type="button" className="btn ghost" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      {warning ? <p className="ops-banner">{warning}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

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
          Off-books
          <select value={offBooksFilter} onChange={(e) => setOffBooksFilter(e.target.value)}>
            <option value="All">All</option>
            <option value="On-books">On-books only</option>
            <option value="Off-books">Off-books only</option>
          </select>
        </label>
        <p className="filter-count muted">
          Showing {filtered.length} of {items.length}
        </p>
      </div>

      {loading ? <p className="muted">Loading billing…</p> : null}

      <div className="ticket-table-wrap">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Client / Project</th>
              <th>Status</th>
              <th>Contract</th>
              <th>DP</th>
              <th>Received</th>
              <th>Balance</th>
              <th>Referred by</th>
              <th>Off books</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.projectId}>
                <td>
                  <div className="title-cell">
                    <strong>{b.client}</strong>
                    <span className="muted small">
                      {b.projectId}
                      {b.pmId ? (
                        <>
                          {' · '}
                          <Link to={b.pmPath || '/ops/project-manager/projects'}>{b.pmTitle || b.pmId}</Link>
                        </>
                      ) : null}
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`status-badge status-${slug(b.status)}`}>{b.status}</span>
                </td>
                <td className="mono">{formatPhp(b.contractValue)}</td>
                <td className="mono">
                  {formatPhp(b.downPaymentAmount)}
                  <span className="muted small"> ({b.downPaymentPct}%)</span>
                </td>
                <td className="mono">{formatPhp(b.receivedToDate)}</td>
                <td className="mono">{formatPhp(b.balance)}</td>
                <td>{b.referredBy || '—'}</td>
                <td>{b.offBooks ? 'Y' : 'N'}</td>
              </tr>
            ))}
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
