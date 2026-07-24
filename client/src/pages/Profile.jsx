import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth, ROLE_LABELS } from '../context/AuthContext.jsx';
import { Field, Notice } from '../components/ui.jsx';

/** FR3: examiners maintain their own name, email, contact details and password. */
export default function Profile() {
  const { user, setUser } = useAuth();
  const [details, setDetails] = useState({
    name: user.name,
    email: user.email,
    contactNumber: user.contactNumber ?? '',
    designation: user.designation ?? '',
  });
  const [detailState, setDetailState] = useState({ error: null, ok: null, busy: false });

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [passwordState, setPasswordState] = useState({ error: null, details: [], ok: null, busy: false });

  async function saveDetails(event) {
    event.preventDefault();
    setDetailState({ error: null, ok: null, busy: true });
    try {
      const { user: updated } = await api.updateProfile(details);
      setUser(updated);
      setDetailState({ error: null, ok: 'Details saved.', busy: false });
    } catch (error) {
      setDetailState({ error: error.message, ok: null, busy: false });
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirm) {
      setPasswordState({ error: 'The two new passwords do not match.', details: [], ok: null, busy: false });
      return;
    }
    setPasswordState({ error: null, details: [], ok: null, busy: true });
    try {
      await api.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      setUser({ ...user, mustChangePassword: false });
      setPasswordState({ error: null, details: [], ok: 'Password updated.', busy: false });
    } catch (error) {
      setPasswordState({ error: error.message, details: error.details, ok: null, busy: false });
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <span className="eyebrow">{ROLE_LABELS[user.role]}</span>
        <h1>My profile</h1>
      </div>

      {user.mustChangePassword ? (
        <Notice tone="warn" title="Choose a new password">
          This account is still using a password set by an administrator. Change it below.
        </Notice>
      ) : null}

      <div className="grid cols-2">
        <form className="card" onSubmit={saveDetails}>
          <h2 style={{ marginBottom: 16 }}>Details</h2>
          {detailState.error ? <Notice tone="error">{detailState.error}</Notice> : null}
          {detailState.ok ? <Notice tone="ok">{detailState.ok}</Notice> : null}

          <Field label="Full name">
            <input value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} required />
          </Field>
          <Field label="Email">
            <input type="email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} required />
          </Field>
          <Field label="Contact number">
            <input value={details.contactNumber} onChange={(e) => setDetails({ ...details, contactNumber: e.target.value })} />
          </Field>
          <Field label="Designation">
            <input value={details.designation} onChange={(e) => setDetails({ ...details, designation: e.target.value })} />
          </Field>

          <button className="btn" type="submit" disabled={detailState.busy}>
            {detailState.busy ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        <form className="card" onSubmit={savePassword}>
          <h2 style={{ marginBottom: 16 }}>Password</h2>
          {passwordState.error ? <Notice tone="error" details={passwordState.details}>{passwordState.error}</Notice> : null}
          {passwordState.ok ? <Notice tone="ok">{passwordState.ok}</Notice> : null}

          <Field label="Current password">
            <input type="password" autoComplete="current-password" value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} required />
          </Field>
          <Field label="New password" hint="At least 10 characters, with an uppercase letter, a lowercase letter and a number.">
            <input type="password" autoComplete="new-password" value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} required />
          </Field>
          <Field label="Confirm new password">
            <input type="password" autoComplete="new-password" value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} required />
          </Field>

          <button className="btn" type="submit" disabled={passwordState.busy}>
            {passwordState.busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
