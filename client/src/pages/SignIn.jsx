import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Field, Notice } from '../components/ui.jsx';

export default function SignIn() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const me = await signIn(email, password);
      navigate(me.mustChangePassword ? '/profile' : '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-aside">
        <span className="eyebrow">National Apprentice and Industrial Training Authority</span>
        <h1>Project evaluation, on the record.</h1>
        <p>
          Schedule sessions, run the clock, and score capstone projects against the ten-criterion
          rubric. Totals are calculated for you and every submission is logged.
        </p>
      </div>

      <div className="login-form-wrap">
        <form className="login-form" onSubmit={handleSubmit}>
          <h2 style={{ marginBottom: 6 }}>Sign in</h2>
          <p className="small muted" style={{ marginTop: 0, marginBottom: 24 }}>
            Use the account issued to you by the ICT division.
          </p>

          {error ? <Notice tone="error">{error}</Notice> : null}

          <Field label="Email">
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <button className="btn seal" type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
