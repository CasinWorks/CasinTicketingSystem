import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { formatPhp } from '../../money';

export default function AssetsPage() {
  const [items, setItems] = useState([]);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const json = await api.listFinanceAssets();
      setItems(json.items || []);
      setTotalCost(json.totalCost || 0);
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

  const extraKeys = Array.from(
    new Set(items.flatMap((a) => Object.keys(a.extra || {}).filter((k) => !['Item', 'Serial / Specs', 'Purchase date', 'Cost', 'Funded by', 'Category', 'Book treatment', 'Receipt link', 'Notes'].includes(k))))
  );

  return (
    <section className="panel wide">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Assets</h1>
          <p className="muted">Capital register — total cost {formatPhp(totalCost)}.</p>
        </div>
        <button type="button" className="btn ghost" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      {warning ? <p className="ops-banner">{warning}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="muted">Loading assets…</p> : null}

      <article className="kpi" style={{ marginBottom: '1rem', maxWidth: '16rem' }}>
        <p className="kpi-value">{formatPhp(totalCost)}</p>
        <p className="kpi-label">Total cost</p>
      </article>

      <div className="ticket-table-wrap">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Serial / Specs</th>
              <th>Purchase date</th>
              <th>Cost</th>
              <th>Funded by</th>
              <th>Category</th>
              <th>Book treatment</th>
              <th>Receipt</th>
              <th>Notes</th>
              {extraKeys.map((k) => (
                <th key={k}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.item}>
                <td>
                  <strong>{a.item}</strong>
                </td>
                <td className="muted small">{a.serial || '—'}</td>
                <td className="mono">{a.purchaseDate || '—'}</td>
                <td className="mono">{formatPhp(a.cost)}</td>
                <td>{a.fundedBy || '—'}</td>
                <td>{a.category || '—'}</td>
                <td className="muted small">{a.bookTreatment || '—'}</td>
                <td>
                  {a.receiptLink ? (
                    <a href={a.receiptLink} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="muted small">{a.notes?.slice(0, 80) || '—'}</td>
                {extraKeys.map((k) => (
                  <td key={k} className="muted small">
                    {a.extra?.[k] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
