import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const CATEGORIES = ['Incident', 'Service Request', 'Access', 'Change', 'Problem'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const empty = {
  title: '',
  description: '',
  category: 'Incident',
  priority: 'Medium',
  requester: '',
  client: '',
  project: '',
  coordinator: '',
};

export default function NewTicket() {
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState('');

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const ticket = await api.createTicket(form);
      setCreatedId(ticket.ID);
      setForm(empty);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (createdId) {
    return (
      <section className="panel confirm-panel">
        <p className="eyebrow">Ticket created</p>
        <h1>Your request is logged</h1>
        <p className="confirm-id">{createdId}</p>
        <p className="muted">Written to the CasinWorks Google Sheet — share this ID for follow-up.</p>
        <div className="btn-row">
          <button type="button" className="btn primary" onClick={() => setCreatedId('')}>
            Submit another
          </button>
          <Link className="btn ghost" to="/ops/service-desk/tickets">
            View tickets
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <p className="eyebrow">Intake</p>
      <h1>New ticket</h1>
      <p className="muted">Creates a row on the live Tickets sheet (source of truth).</p>

      <form className="stack-form ticket-form" onSubmit={onSubmit}>
        <label>
          Title
          <input
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            maxLength={200}
            required
            placeholder="Short summary of the issue"
          />
        </label>

        <label>
          Summary
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={5}
            maxLength={5000}
            required
            placeholder="What happened, who is affected, and any steps already tried"
          />
        </label>

        <div className="form-grid">
          <label>
            Client
            <input
              value={form.client}
              onChange={(e) => update('client', e.target.value)}
              maxLength={100}
              placeholder="e.g. AMKOR"
            />
          </label>
          <label>
            Project
            <input
              value={form.project}
              onChange={(e) => update('project', e.target.value)}
              maxLength={200}
              placeholder="e.g. NAS Synology Phase 1"
            />
          </label>
        </div>

        <div className="form-grid">
          <label>
            Category
            <select value={form.category} onChange={(e) => update('category', e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label>
            Priority
            <select value={form.priority} onChange={(e) => update('priority', e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-grid">
          <label>
            Requester
            <input
              value={form.requester}
              onChange={(e) => update('requester', e.target.value)}
              maxLength={100}
              required
              placeholder="Name of the person requesting help"
            />
          </label>
          <label>
            Coordinator
            <input
              value={form.coordinator}
              onChange={(e) => update('coordinator', e.target.value)}
              maxLength={100}
              placeholder="Optional"
            />
          </label>
        </div>

        {error ? <p className="error-text" role="alert">{error}</p> : null}

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Submitting…' : 'Create ticket'}
        </button>
      </form>
    </section>
  );
}
