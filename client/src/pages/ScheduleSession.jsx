import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { Field, Loading, Notice } from '../components/ui.jsx';
import { toLocalInputValue } from '../components/format.js';

/** FR4: date, time, chief examiner, support examiner, apprentice, venue, duration. */
export default function ScheduleSession() {
  const navigate = useNavigate();
  const [options, setOptions] = useState({ apprentices: [], examiners: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [details, setDetails] = useState([]);
  const [busy, setBusy] = useState(false);

  const oneHourOut = new Date(Date.now() + 60 * 60 * 1000);
  const [form, setForm] = useState({
    apprentice: '',
    chiefExaminer: '',
    supportExaminer: '',
    venue: '',
    scheduledAt: toLocalInputValue(oneHourOut),
    durationMinutes: 45,
    notes: '',
  });

  useEffect(() => {
    async function load() {
      try {
        const [{ apprentices }, { users }] = await Promise.all([api.listApprentices(), api.listExaminers()]);
        setOptions({ apprentices: apprentices.filter((a) => a.isActive), examiners: users });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setDetails([]);
    setBusy(true);
    try {
      const { session } = await api.createSession({
        ...form,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
      });
      navigate(`/sessions/${session._id}`);
    } catch (err) {
      setError(err.message);
      setDetails(err.details ?? []);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="content"><Loading label="Loading people and apprentices" /></div>;

  const noApprentices = options.apprentices.length === 0;
  const tooFewExaminers = options.examiners.length < 2;

  return (
    <div className="content">
      <div className="page-head">
        <span className="eyebrow">New session</span>
        <h1>Schedule a session</h1>
        <p>Every session needs one chief examiner and one support examiner. Nobody can be booked twice at the same time.</p>
      </div>

      {noApprentices ? (
        <Notice tone="warn" title="No apprentices on file">
          Add an apprentice record first — a session has to point at someone.
        </Notice>
      ) : null}
      {tooFewExaminers ? (
        <Notice tone="warn" title="Not enough examiners">
          At least two active examiner accounts are needed before a session can be scheduled.
        </Notice>
      ) : null}
      {error ? <Notice tone="error" details={details}>{error}</Notice> : null}

      <form className="card" onSubmit={handleSubmit}>
        <Field label="Apprentice">
          <select value={form.apprentice} onChange={(e) => setForm({ ...form, apprentice: e.target.value })} required>
            <option value="">Choose an apprentice</option>
            {options.apprentices.map((a) => (
              <option key={a.id} value={a.id}>{a.registrationNumber} — {a.name}</option>
            ))}
          </select>
        </Field>

        <div className="grid cols-2">
          <Field label="Chief examiner">
            <select value={form.chiefExaminer} onChange={(e) => setForm({ ...form, chiefExaminer: e.target.value })} required>
              <option value="">Choose an examiner</option>
              {options.examiners.map((u) => (
                <option key={u.id} value={u.id} disabled={u.id === form.supportExaminer}>{u.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Support examiner">
            <select value={form.supportExaminer} onChange={(e) => setForm({ ...form, supportExaminer: e.target.value })} required>
              <option value="">Choose an examiner</option>
              {options.examiners.map((u) => (
                <option key={u.id} value={u.id} disabled={u.id === form.chiefExaminer}>{u.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid cols-2">
          <Field label="Date and time">
            <input type="datetime-local" value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} required />
          </Field>
          <Field label="Duration" hint="Minutes. The countdown runs for exactly this long.">
            <input type="number" min="5" max="240" value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} required />
          </Field>
        </div>

        <Field label="Venue">
          <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })}
            placeholder="Auditorium B, NAITA Head Office" required />
        </Field>

        <Field label="Notes for examiners" hint="Optional.">
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>

        <div className="btn-row">
          <button className="btn seal" type="submit" disabled={busy || noApprentices || tooFewExaminers}>
            {busy ? 'Scheduling…' : 'Schedule session'}
          </button>
          <button className="btn ghost" type="button" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
