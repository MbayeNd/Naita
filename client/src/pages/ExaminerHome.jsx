import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, formatTime } from '../components/format.js';
import { Empty, Loading, Notice, StatusPill } from '../components/ui.jsx';

/** FR5: the examiner's own upcoming sessions with a way into the marking sheet. */
export default function ExaminerHome() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { sessions: rows } = await api.listSessions('?upcoming=true');
        if (cancelled) return;
        setSessions(rows);
        setState({ loading: false, error: null });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message });
      }
    }
    load();
    // Refresh periodically so a coordinator starting the clock shows up here.
    const timer = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  return (
    <div className="content">
      <div className="page-head">
        <span className="eyebrow">Assigned to you</span>
        <h1>My sessions</h1>
        <p>Marking opens when the coordinator starts the clock. You can score at any time before then, but marks only submit once.</p>
      </div>

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.loading ? <Loading label="Loading your schedule" /> : null}

      {!state.loading && sessions.length === 0 ? (
        <Empty title="Nothing scheduled">
          When a coordinator assigns you to an evaluation, it will appear here with the time and venue.
        </Empty>
      ) : null}

      {sessions.map((session) => {
        const slot = String(session.chiefExaminer?._id) === String(user.id) ? 'Chief examiner' : 'Support examiner';
        return (
          <div key={session._id} className={`card session-card status-${session.status}`}>
            <div className="card-head">
              <div>
                <h2>{session.apprentice?.name}</h2>
                <div className="small muted mono">{session.apprentice?.registrationNumber}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="pill">{slot}</span>
                <StatusPill status={session.status} />
              </div>
            </div>

            {session.apprentice?.projectTitle ? (
              <p style={{ marginTop: 0, maxWidth: '65ch' }}>{session.apprentice.projectTitle}</p>
            ) : null}

            <div className="grid cols-3" style={{ marginBottom: 16 }}>
              <div>
                <span className="eyebrow">Date</span>
                <div>{formatDate(session.scheduledAt)}</div>
              </div>
              <div>
                <span className="eyebrow">Time</span>
                <div className="mono">{formatTime(session.scheduledAt)} · {session.durationMinutes} min</div>
              </div>
              <div>
                <span className="eyebrow">Venue</span>
                <div>{session.venue}</div>
              </div>
            </div>

            {session.notes ? <p className="small muted">{session.notes}</p> : null}

            <Link className="btn seal" to={`/evaluate/${session._id}`} style={{ textDecoration: 'none' }}>
              Open marking sheet
            </Link>
          </div>
        );
      })}
    </div>
  );
}
