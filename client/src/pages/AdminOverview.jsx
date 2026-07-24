import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { formatDateTime, formatMark } from '../components/format.js';
import { Loading, Notice, StatusPill } from '../components/ui.jsx';

/** FR2: the administrator's system overview. */
export default function AdminOverview() {
  const [data, setData] = useState({ sessions: [], users: [], apprentices: [], results: [] });
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    async function load() {
      try {
        const [sessions, users, apprentices, results] = await Promise.all([
          api.listSessions(''),
          api.listUsers(),
          api.listApprentices(),
          api.listResults(),
        ]);
        setData({
          sessions: sessions.sessions,
          users: users.users,
          apprentices: apprentices.apprentices,
          results: results.results,
        });
        setState({ loading: false, error: null });
      } catch (error) {
        setState({ loading: false, error: error.message });
      }
    }
    load();
  }, []);

  if (state.loading) return <div className="content"><Loading label="Loading the overview" /></div>;

  const running = data.sessions.filter((s) => s.status === 'in_progress');
  const upcoming = data.sessions.filter((s) => s.status === 'scheduled');
  const averageMark = data.results.length
    ? data.results.reduce((sum, r) => sum + (r.finalMark ?? 0), 0) / data.results.length
    : null;

  return (
    <div className="content">
      <div className="page-head">
        <span className="eyebrow">Administration</span>
        <h1>System overview</h1>
      </div>

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <div className="grid cols-3">
        <div className="card stat">
          <span className="eyebrow">Running now</span>
          <span className="value">{running.length}</span>
          <span className="small muted">{upcoming.length} scheduled</span>
        </div>
        <div className="card stat">
          <span className="eyebrow">Completed evaluations</span>
          <span className="value">{data.results.length}</span>
          <span className="small muted">
            {averageMark !== null ? `Average final mark ${formatMark(averageMark)}` : 'No results yet'}
          </span>
        </div>
        <div className="card stat">
          <span className="eyebrow">Accounts</span>
          <span className="value">{data.users.filter((u) => u.isActive).length}</span>
          <span className="small muted">{data.apprentices.length} apprentices on file</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h2>Sessions in progress and upcoming</h2>
          <Link className="btn ghost small" to="/sessions" style={{ textDecoration: 'none' }}>All sessions</Link>
        </div>

        {running.length + upcoming.length === 0 ? (
          <p className="small muted">Nothing on the calendar. Coordinators schedule sessions from their dashboard.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Apprentice</th><th>When</th><th>Examiners</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {[...running, ...upcoming].slice(0, 12).map((session) => (
                <tr key={session._id}>
                  <td>{session.apprentice?.name}</td>
                  <td className="small">{formatDateTime(session.scheduledAt)}</td>
                  <td className="small muted">{session.chiefExaminer?.name} · {session.supportExaminer?.name}</td>
                  <td><StatusPill status={session.status} /></td>
                  <td><Link className="btn ghost small" to={`/sessions/${session._id}`} style={{ textDecoration: 'none' }}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
