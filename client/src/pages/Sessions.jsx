import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { formatDateTime, formatMark } from '../components/format.js';
import { Empty, Loading, Notice, StatusPill } from '../components/ui.jsx';

/** Coordinator home and admin session list (FR5, FR11). */
export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState('upcoming');
  const [state, setState] = useState({ loading: true, error: null });
  const [starting, setStarting] = useState(null);

  async function load() {
    setState({ loading: true, error: null });
    try {
      const query = filter === 'upcoming' ? '?upcoming=true' : filter === 'all' ? '' : `?status=${filter}`;
      const { sessions: rows } = await api.listSessions(query);
      setSessions(rows);
      setState({ loading: false, error: null });
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  async function start(id) {
    setStarting(id);
    try {
      await api.startSession(id);
      await load();
    } catch (error) {
      setState((s) => ({ ...s, error: error.message }));
    } finally {
      setStarting(null);
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <span className="eyebrow">Evaluation schedule</span>
        <h1>Sessions</h1>
        <p>Start the clock when the apprentice is ready. Both examiners see the same countdown.</p>
      </div>

      <div className="btn-row" style={{ marginBottom: 20 }}>
        {[
          ['upcoming', 'Upcoming'],
          ['completed', 'Completed'],
          ['cancelled', 'Cancelled'],
          ['all', 'All'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn small ${filter === value ? '' : 'ghost'}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
        <Link className="btn seal small" to="/sessions/schedule" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
          Schedule a session
        </Link>
      </div>

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.loading ? <Loading label="Loading sessions" /> : null}

      {!state.loading && sessions.length === 0 ? (
        <Empty title="No sessions here yet">
          Schedule one to put an apprentice in front of two examiners with a fixed duration.
        </Empty>
      ) : null}

      {sessions.map((session) => (
        <div key={session._id} className={`card session-card status-${session.status}`}>
          <div className="card-head">
            <div>
              <h2>{session.apprentice?.name}</h2>
              <div className="small muted mono">{session.apprentice?.registrationNumber}</div>
              {session.apprentice?.projectTitle ? (
                <div className="small" style={{ marginTop: 6, maxWidth: '60ch' }}>{session.apprentice.projectTitle}</div>
              ) : null}
            </div>
            <StatusPill status={session.status} />
          </div>

          <div className="grid cols-3" style={{ marginBottom: 16 }}>
            <div>
              <span className="eyebrow">When</span>
              <div>{formatDateTime(session.scheduledAt)}</div>
              <div className="small muted mono">{session.durationMinutes} min</div>
            </div>
            <div>
              <span className="eyebrow">Where</span>
              <div>{session.venue}</div>
            </div>
            <div>
              <span className="eyebrow">Examiners</span>
              <div className="small">Chief · {session.chiefExaminer?.name}</div>
              <div className="small">Support · {session.supportExaminer?.name}</div>
            </div>
          </div>

          <div className="btn-row">
            {session.status === 'scheduled' ? (
              <button className="btn" onClick={() => start(session._id)} disabled={starting === session._id}>
                {starting === session._id ? 'Starting…' : 'Start the clock'}
              </button>
            ) : null}
            <Link className="btn ghost small" to={`/sessions/${session._id}`} style={{ textDecoration: 'none' }}>
              {session.status === 'completed' ? 'View result' : 'Open session'}
            </Link>
            {session.status === 'completed' ? (
              <span className="mono" style={{ marginLeft: 'auto', fontSize: '1.3rem' }}>
                {formatMark(session.finalMark)}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
