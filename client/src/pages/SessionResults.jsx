import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDateTime, formatMark, BAND_LABELS } from '../components/format.js';
import { useCountdown, formatClock } from '../hooks/useCountdown.js';
import { Loading, Notice, StatusPill } from '../components/ui.jsx';

/** FR11: both examiners' marks side by side, plus the computed final mark. */
export default function SessionResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [state, setState] = useState({ loading: true, error: null });
  const [busy, setBusy] = useState(false);
  const [reopenFor, setReopenFor] = useState(null);
  const [reason, setReason] = useState('');
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.getSessionResults(id);
      setData(result);
      setState({ loading: false, error: null });
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const running = data?.session?.status === 'in_progress';
  const { remainingMs } = useCountdown(id, { active: running, onFetch: api.getTimer });

  async function start() {
    setBusy(true);
    try { await api.startSession(id); await load(); }
    catch (error) { setState((s) => ({ ...s, error: error.message })); }
    finally { setBusy(false); }
  }

  async function downloadSheet() {
    setDownloading(true);
    try {
      await api.downloadResultSheet(id);
    } catch (error) {
      setState((s) => ({ ...s, error: error.message }));
    } finally {
      setDownloading(false);
    }
  }

  async function reopen() {
    setBusy(true);
    try {
      await api.reopenEvaluation(reopenFor, reason);
      setReopenFor(null);
      setReason('');
      await load();
    } catch (error) {
      setState((s) => ({ ...s, error: error.message }));
    } finally { setBusy(false); }
  }

  if (state.loading) return <div className="content"><Loading label="Loading the session" /></div>;
  if (!data) return <div className="content"><Notice tone="error">{state.error ?? 'Session not found.'}</Notice></div>;

  const { session, chief, support, rubric, finalMark, finalBand, examinerSpread, spreadFlagged } = data;

  const renderSheet = (evaluation, label) => (
    <div className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">{label}</span>
          <h2>{evaluation?.examiner?.name ?? 'Unassigned'}</h2>
        </div>
        <span className={`pill ${evaluation?.status === 'submitted' ? 'seal' : ''}`}>
          {evaluation?.status === 'submitted' ? 'Submitted' : 'Not submitted'}
        </span>
      </div>

      {evaluation?.status === 'submitted' ? (
        <>
          <div className="stat" style={{ marginBottom: 16 }}>
            <span className="eyebrow">Total</span>
            <span className="value">{formatMark(evaluation.total)}</span>
          </div>

          <table>
            <thead>
              <tr><th>Criterion</th><th style={{ textAlign: 'right' }}>Wt</th><th style={{ textAlign: 'right' }}>Mark</th></tr>
            </thead>
            <tbody>
              {rubric.criteria.map((c) => {
                const row = evaluation.scores.find((s) => s.criterionId === c.id);
                return (
                  <tr key={c.id}>
                    <td>
                      {c.title}
                      {row?.comment ? <div className="small muted">{row.comment}</div> : null}
                    </td>
                    <td className="num muted">{c.weight}%</td>
                    <td className="num">{row?.score ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {evaluation.generalComment ? (
            <p className="small" style={{ marginTop: 16 }}><strong>Overall:</strong> {evaluation.generalComment}</p>
          ) : null}

          {user.role === 'admin' ? (
            reopenFor === evaluation._id ? (
              <div style={{ marginTop: 16 }}>
                <div className="field">
                  <label>Why is this being reopened?</label>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Transcription error on criterion 5" />
                </div>
                <div className="btn-row">
                  <button className="btn danger small" onClick={reopen} disabled={busy || reason.trim().length < 5}>Reopen sheet</button>
                  <button className="btn ghost small" onClick={() => setReopenFor(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="btn ghost small" style={{ marginTop: 16 }} onClick={() => setReopenFor(evaluation._id)}>
                Reopen this sheet
              </button>
            )
          ) : null}

          {evaluation.reopenCount > 0 ? (
            <p className="small muted" style={{ marginTop: 12 }}>
              Reopened {evaluation.reopenCount} time(s). Last reason: {evaluation.lastReopenReason}
            </p>
          ) : null}
        </>
      ) : (
        <p className="small muted">Marks appear here once this examiner submits.</p>
      )}
    </div>
  );

  return (
    <div className="content">
      <div className="page-head">
        <span className="eyebrow">{session.apprentice?.registrationNumber}</span>
        <h1>{session.apprentice?.name}</h1>
        <p>{session.apprentice?.projectTitle}</p>
      </div>

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <div className="card">
        <div className="card-head">
          <div className="grid cols-3" style={{ flex: 1 }}>
            <div><span className="eyebrow">Scheduled</span><div>{formatDateTime(session.scheduledAt)}</div></div>
            <div><span className="eyebrow">Venue</span><div>{session.venue}</div></div>
            <div><span className="eyebrow">Duration</span><div className="mono">{session.durationMinutes} min</div></div>
          </div>
          <StatusPill status={session.status} />
        </div>

        {session.status === 'scheduled' ? (
          <button className="btn" onClick={start} disabled={busy}>
            {busy ? 'Starting…' : 'Start the clock'}
          </button>
        ) : null}

        {running ? (
          <div className="btn-row" style={{ alignItems: 'baseline' }}>
            <span className="eyebrow">Time remaining</span>
            <span className="mono" style={{ fontSize: '2rem' }}>{formatClock(remainingMs)}</span>
          </div>
        ) : null}
      </div>

      {finalMark !== null ? (
        <div className="card" style={{ borderLeft: '3px solid var(--seal)' }}>
          <div className="card-head">
            <div className="stat">
              <span className="eyebrow">Final mark · average of both examiners</span>
              <span className="value" style={{ fontSize: '3rem' }}>{formatMark(finalMark)}</span>
            </div>
            <div className="btn-row" style={{ alignItems: 'center' }}>
              <span className="pill seal">{BAND_LABELS[finalBand] ?? finalBand}</span>
              <button className="btn ghost small" type="button" onClick={downloadSheet} disabled={downloading}>
                {downloading ? 'Preparing…' : 'Download result sheet (PDF)'}
              </button>
            </div>
          </div>
          {spreadFlagged ? (
            <Notice tone="warn" title="Wide gap between examiners">
              The two totals differ by {formatMark(examinerSpread)} marks. Worth a look before the result is published.
            </Notice>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              Examiner totals differ by {formatMark(examinerSpread)} marks.
            </p>
          )}
        </div>
      ) : (
        <Notice tone="warn" title="Final mark pending">
          Both examiners must submit before the average is calculated.
        </Notice>
      )}

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        {renderSheet(chief, 'Chief examiner')}
        {renderSheet(support, 'Support examiner')}
      </div>

      <button className="btn ghost" style={{ marginTop: 24 }} onClick={() => navigate(-1)}>Back</button>
    </div>
  );
}
