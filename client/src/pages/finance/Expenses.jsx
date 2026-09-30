import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { formatPhp } from '../../money';

export default function ExpensesPage() {
  const [items, setItems] = useState([]);
  const [summaries, setSummaries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [paidFrom, setPaidFrom] = useState('All');

  const load = useCallback(async () => {
    setError('');
    try {
      const json = await api.listFinanceExpenses();
      setItems(json.items || []);
      setSummaries(json.summaries || null);
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
      items.filter((e) => {
        if (paidFrom === 'Business' && e.isPersonal) return false;
        if (paidFrom === 'Personal' && !e.isPersonal) return false;
        return true;
      }),
    [items, paidFrom]
  );

  return (
    <section className="panel wide">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Expenses</h1>
          <p className="muted">Personal spend is excluded from business totals.</p>
        </div>
        <button type="button" className="btn ghost" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      {warning ? <p className="ops-banner">{warning}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="kpi-grid" style={{ marginBottom: '1rem', gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        <article className="kpi">
          <p className="kpi-value">{formatPhp(summaries?.businessTotal)}</p>
          <p className="kpi-label">Business total</p>
        </article>
        <article className="kpi">
          <p className="kpi-value">{formatPhp(summaries?.personalTotal)}</p>
          <p className="kpi-label">Personal (excluded)</p>
        </article>
      </div>

      <div className="filters">
        <label>
          Paid from
          <select value={paidFrom} onChange={(e) => setPaidFrom(e.target.value)}>
            <option value="All">All</option>
            <option value="Business">Business</option>
            <option value="Personal">Personal</option>
          </select>
        </label>
        <p className="filter-count muted">
          Showing {filtered.length} of {items.length}
        </p>
      </div>

      {loading ? <p className="muted">Loading expenses…</p> : null}

      <div className="chart-grid" style={{ marginBottom: '1rem' }}>
        <section className="panel">
          <h2>By category (business)</h2>
          {summaries?.byCategory?.length ? (
            <table className="ticket-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {summaries.byCategory.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className="mono">{formatPhp(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No categorized business spend yet.</p>
          )}
        </section>
        <section className="panel">
          <h2>By month (business)</h2>
          {summaries?.byMonth?.length ? (
            <table className="ticket-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {summaries.byMonth.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className="mono">{formatPhp(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No dated business spend yet.</p>
          )}
        </section>
      </div>

      <div className="ticket-table-wrap">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Paid from</th>
              <th>Project</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr key={`${e.description}-${i}`}>
                <td className="mono">{e.date || '—'}</td>
                <td>{e.category || '—'}</td>
                <td>{e.description}</td>
                <td className="mono">{formatPhp(e.amount)}</td>
                <td>{e.paidFrom || '—'}</td>
                <td className="mono">{e.projectId || '—'}</td>
                <td>
                  {e.receiptLink ? (
                    <a href={e.receiptLink} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
