import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { ROLE_LABELS } from '../context/AuthContext.jsx';
import { Field, Loading, Notice } from '../components/ui.jsx';

const ROLES = ['admin', 'coordinator', 'chief_examiner', 'support_examiner'];
const BLANK = { name: '', email: '', role: 'chief_examiner', password: '', contactNumber: '', designation: '' };

/** FR12: add, deactivate, reset passwords, assign roles. */
export default function People() {
  const [users, setUsers] = useState([]);
  const [state, setState] = useState({ loading: true, error: null, details: [], ok: null });
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  async function load() {
    try {
      const { users: rows } = await api.listUsers();
      setUsers(rows);
      setState((s) => ({ ...s, loading: false }));
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }));
    }
  }

  useEffect(() => { load(); }, []);

  async function createUser(event) {
    event.preventDefault();
    setBusy(true);
    setState((s) => ({ ...s, error: null, details: [], ok: null }));
    try {
      await api.createUser(form);
      setForm(BLANK);
      setState((s) => ({ ...s, ok: 'Account created. They will be asked to choose a new password at first sign-in.' }));
      await load();
    } catch (error) {
      setState((s) => ({ ...s, error: error.message, details: error.details ?? [] }));
    } finally { setBusy(false); }
  }

  async function toggleActive(user) {
    try {
      await api.updateUser(user.id, { isActive: !user.isActive });
      await load();
    } catch (error) {
      setState((s) => ({ ...s, error: error.message }));
    }
  }

  async function resetPassword() {
    setBusy(true);
    try {
      const { message } = await api.resetUserPassword(resetFor, newPassword);
      setResetFor(null);
      setNewPassword('');
      setState((s) => ({ ...s, ok: message, error: null }));
    } catch (error) {
      setState((s) => ({ ...s, error: error.message, details: error.details ?? [] }));
    } finally { setBusy(false); }
  }

  return (
    <div className="content">
      <div className="page-head">
        <span className="eyebrow">Administration</span>
        <h1>People</h1>
        <p>Accounts for coordinators and examiners. Deactivate rather than delete when someone leaves, so their past evaluations stay readable.</p>
      </div>

      {state.error ? <Notice tone="error" details={state.details}>{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}

      <form className="card" onSubmit={createUser}>
        <h2 style={{ marginBottom: 16 }}>Add an account</h2>
        <div className="grid cols-2">
          <Field label="Full name">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Role">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
          </Field>
          <Field label="Temporary password" hint="At least 10 characters with upper, lower and a number.">
            <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </Field>
          <Field label="Contact number">
            <input value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} />
          </Field>
          <Field label="Designation">
            <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
          </Field>
        </div>
        <button className="btn seal" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>All accounts</h2>
        {state.loading ? <Loading /> : (
          <table>
            <thead>
              <tr><th>Name</th><th>Role</th><th>Email</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    {user.name}
                    {user.designation ? <div className="small muted">{user.designation}</div> : null}
                  </td>
                  <td><span className="pill">{ROLE_LABELS[user.role]}</span></td>
                  <td className="small">{user.email}</td>
                  <td>
                    <span className={`pill ${user.isActive ? 'seal' : ''}`}>{user.isActive ? 'Active' : 'Inactive'}</span>
                    {user.mustChangePassword ? <div className="small muted">Password change pending</div> : null}
                  </td>
                  <td>
                    <div className="btn-row">
                      <button className="btn ghost small" onClick={() => toggleActive(user)}>
                        {user.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button className="btn ghost small" onClick={() => { setResetFor(user.id); setNewPassword(''); }}>
                        Reset password
                      </button>
                    </div>
                    {resetFor === user.id ? (
                      <div style={{ marginTop: 10 }}>
                        <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New temporary password" />
                        <div className="btn-row" style={{ marginTop: 8 }}>
                          <button className="btn small" onClick={resetPassword} disabled={busy}>Set password</button>
                          <button className="btn ghost small" onClick={() => setResetFor(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
