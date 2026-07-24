import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { formatDateTime } from '../components/format.js';
import { Empty, Loading, Notice } from '../components/ui.jsx';

/**
 * The SRS does not ask for an audit trail, but Business Rule 3 gives
 * administrators the power to unlock submitted marks. A privilege like that
 * needs a record, otherwise the result is not defensible after the fact.
 */
export default function Activity() {
  const [entries, setEntries] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    async function load() {
      try {
        const { entries: rows } = await api.listAudit();
        setEntries(rows);
        setState({ loading: false, error: null });
      } catch (error) {
        setState({ loading: false, error: error.message });
      }
    }
    load();
  }, []);

  return (
    <div className="content">
      <div className="page-head">
        <span className="eyebrow">Administration</span>
        <h1>Activity log</h1>
        <p>Who changed what, and when. Reopened marking sheets are recorded here with the reason given.</p>
      </div>

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.loading ? <Loading /> : null}

      {!state.loading && entries.length === 0 ? (
        <Empty title="Nothing logged yet">Account changes, timer starts, submissions and reopenings will appear here.</Empty>
      ) : null}

      {entries.length > 0 ? (
        <div className="card">
          <table>
            <thead>
              <tr><th>When</th><th>Action</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry._id}>
                  <td className="small mono">{formatDateTime(entry.createdAt)}</td>
                  <td><span className="pill">{entry.action}</span></td>
                  <td className="small">
                    {entry.summary}
                    {entry.metadata?.reason ? <div className="muted">Reason: {entry.metadata.reason}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
