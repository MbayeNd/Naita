import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Field, Empty, Loading, Notice } from '../components/ui.jsx';

const BLANK = { registrationNumber: '', name: '', course: '', trainingCentre: '', projectTitle: '', email: '', contactNumber: '' };

export default function Apprentices() {
  const [apprentices, setApprentices] = useState([]);
  const [state, setState] = useState({ loading: true, error: null, details: [] });
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { apprentices: rows } = await api.listApprentices();
      setApprentices(rows);
      setState((s) => ({ ...s, loading: false }));
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }));
    }
  }

  useEffect(() => { load(); }, []);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setState((s) => ({ ...s, error: null, details: [] }));
    try {
      await api.createApprentice(form);
      setForm(BLANK);
      await load();
    } catch (error) {
      setState((s) => ({ ...s, error: error.message, details: error.details ?? [] }));
    } finally { setBusy(false); }
  }

  return (
    <div className="content">
      <div className="page-head">
        <span className="eyebrow">Records</span>
        <h1>Apprentices</h1>
        <p>Each session points at one apprentice record, so their evaluation history stays together.</p>
      </div>

      {state.error ? <Notice tone="error" details={state.details}>{state.error}</Notice> : null}

      <form className="card" onSubmit={create}>
        <h2 style={{ marginBottom: 16 }}>Add an apprentice</h2>
        <div className="grid cols-2">
          <Field label="Registration number">
            <input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} placeholder="NA/2026/0142" required />
          </Field>
          <Field label="Full name">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Course">
            <input value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
          </Field>
          <Field label="Training centre">
            <input value={form.trainingCentre} onChange={(e) => setForm({ ...form, trainingCentre: e.target.value })} />
          </Field>
        </div>
        <Field label="Project title">
          <input value={form.projectTitle} onChange={(e) => setForm({ ...form, projectTitle: e.target.value })} />
        </Field>
        <button className="btn seal" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add apprentice'}</button>
      </form>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>On file</h2>
        {state.loading ? <Loading /> : apprentices.length === 0 ? (
          <Empty title="No apprentices yet">Add the first record above, then schedule their evaluation.</Empty>
        ) : (
          <table>
            <thead>
              <tr><th>Registration</th><th>Name</th><th>Project</th><th>Centre</th></tr>
            </thead>
            <tbody>
              {apprentices.map((a) => (
                <tr key={a.id}>
                  <td className="mono small">{a.registrationNumber}</td>
                  <td>{a.name}</td>
                  <td className="small">{a.projectTitle || '—'}</td>
                  <td className="small muted">{a.trainingCentre || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
