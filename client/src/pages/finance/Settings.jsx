import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { formatPhp } from '../../money';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const json = await api.getFinanceSettings();
      setSettings(json.settings || null);
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

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Settings</h1>
          <p className="muted">Read-only values from the Finance sheet Settings tab.</p>
        </div>
        <button type="button" className="btn ghost" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      {warning ? <p className="ops-banner">{warning}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="muted">Loading settings…</p> : null}

      <div className="ticket-table-wrap">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Setting</th>
              <th>Value</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {(settings?.rows || []).map((r) => (
              <tr key={r.key}>
                <td>
                  <strong>{r.key}</strong>
                </td>
                <td className="mono">{r.value || '—'}</td>
                <td className="muted small">{r.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted small" style={{ marginTop: '1rem' }}>
        Parsed: business burn {settings?.monthlyBusinessBurn != null ? formatPhp(settings.monthlyBusinessBurn) : 'blank'} ·
        living burn {settings?.monthlyLivingBurn != null ? formatPhp(settings.monthlyLivingBurn) : 'blank'} · default DP{' '}
        {settings?.defaultDownPaymentPct ?? '—'}% · pause after {settings?.daysLateBeforeWorkPauses ?? '—'} days late.
      </p>
    </section>
  );
}
