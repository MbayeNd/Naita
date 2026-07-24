import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, formatMark, BAND_LABELS } from '../components/format.js';
import { Empty, Loading, Notice } from '../components/ui.jsx';

/** FR11: completed evaluations, scoped to what the signed-in role may see. */
export default function Results() {
  const { user } = useAuth();
  const [results, setResults] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });
  const [downloadingId, setDownloadingId] = useState(null);
  const canOpen = user.role === 'admin' || user.role === 'coordinator';

  async function download(sessionId) {
    setDownloadingId(sessionId);
    try {
      await api.downloadResultSheet(sessionId);
    } catch (error) {
      setState((s) => ({ ...s, error: error.message }));
    } finally {
      setDownloadingId(null);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const { results: rows } = await api.listResults();
        setResults(rows);
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
        <span className="eyebrow">History</span>
        <h1>{canOpen ? 'Results' : 'Past evaluations'}</h1>
        <p>Completed sessions only — a result appears once both examiners have submitted.</p>
      </div>

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.loading ? <Loading label="Loading results" /> : null}

      {!state.loading && results.length === 0 ? (
        <Empty title="No completed evaluations yet">
          Results are calculated automatically once both marking sheets are submitted.
        </Empty>
      ) : null}

      {results.length > 0 ? (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Apprentice</th><th>Project</th><th>Completed</th>
                <th style={{ textAlign: 'right' }}>Final</th><th>Band</th>{canOpen ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row._id}>
                  <td>
                    {row.apprentice?.name}
                    <div className="small muted mono">{row.apprentice?.registrationNumber}</div>
                  </td>
                  <td className="small" style={{ maxWidth: '32ch' }}>{row.apprentice?.projectTitle || '—'}</td>
                  <td className="small">{formatDate(row.completedAt)}</td>
                  <td className="num" style={{ fontSize: '1.05rem' }}>{formatMark(row.finalMark)}</td>
                  <td><span className="pill seal">{BAND_LABELS[row.finalBand] ?? '—'}</span></td>
                  {canOpen ? (
                    <td>
                      <div className="btn-row">
                        <Link className="btn ghost small" to={`/sessions/${row._id}`} style={{ textDecoration: 'none' }}>Open</Link>
                        <button
                          className="btn ghost small"
                          type="button"
                          onClick={() => download(row._id)}
                          disabled={downloadingId === row._id}
                        >
                          {downloadingId === row._id ? 'Preparing…' : 'PDF'}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
