import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { LiveSessionBar } from '../components/LiveSessionBar.jsx';
import { Field, Loading, Notice } from '../components/ui.jsx';
import { formatMark } from '../components/format.js';

/**
 * FR7 / FR8. Scores are held locally, autosaved as a draft, and locked on
 * submit. Picking a band fills in that band's midpoint so an examiner can work
 * fast, then nudge the exact number if they want to.
 */
export default function MarkingSheet() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [rubric, setRubric] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [scores, setScores] = useState({});
  const [generalComment, setGeneralComment] = useState('');

  const [state, setState] = useState({ loading: true, error: null, details: [] });
  const [saveState, setSaveState] = useState('idle');
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [{ session: s }, { evaluation: e, rubric: r }] = await Promise.all([
          api.getSession(sessionId),
          api.getMyEvaluation(sessionId),
        ]);
        if (cancelled) return;
        setSession(s);
        setRubric(r);
        setEvaluation(e);
        setScores(Object.fromEntries((e.scores ?? []).map((row) => [row.criterionId, { score: row.score, comment: row.comment ?? '' }])));
        setGeneralComment(e.generalComment ?? '');
        setState({ loading: false, error: null, details: [] });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, details: [] });
      }
    }
    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  const locked = evaluation?.status === 'submitted';

  const payload = useMemo(
    () => ({
      scores: Object.entries(scores).map(([criterionId, row]) => ({
        criterionId,
        score: row.score === '' || row.score === null || row.score === undefined ? null : Number(row.score),
        comment: row.comment ?? '',
      })),
      generalComment,
    }),
    [scores, generalComment]
  );

  const save = useCallback(async () => {
    if (locked) return;
    setSaveState('saving');
    try {
      const { evaluation: updated } = await api.saveMyEvaluation(sessionId, payload);
      setEvaluation(updated);
      setSaveState('saved');
      dirtyRef.current = false;
    } catch (error) {
      setSaveState('failed');
      setState((s) => ({ ...s, error: error.message }));
    }
  }, [locked, payload, sessionId]);

  // Autosave a second after typing stops, so nothing is lost if the tab closes.
  useEffect(() => {
    if (!evaluation || locked || !dirtyRef.current) return undefined;
    const timer = setTimeout(save, 1000);
    return () => clearTimeout(timer);
  }, [payload, evaluation, locked, save]);

  function setScore(criterionId, patch) {
    dirtyRef.current = true;
    setScores((prev) => ({ ...prev, [criterionId]: { score: null, comment: '', ...prev[criterionId], ...patch } }));
  }

  const scoredCount = useMemo(
    () => Object.values(scores).filter((row) => row.score !== null && row.score !== '' && row.score !== undefined).length,
    [scores]
  );

  const runningTotal = useMemo(() => {
    if (!rubric) return 0;
    const sum = rubric.criteria.reduce((acc, c) => {
      const raw = scores[c.id]?.score;
      const value = raw === '' || raw === null || raw === undefined ? 0 : Number(raw);
      return acc + value * c.weight;
    }, 0);
    return Math.round((sum / 100 + Number.EPSILON) * 100) / 100;
  }, [rubric, scores]);

  async function submit() {
    setSubmitting(true);
    setState((s) => ({ ...s, error: null, details: [] }));
    try {
      await save();
      const result = await api.submitMyEvaluation(sessionId);
      setEvaluation(result.evaluation);
      setConfirming(false);
    } catch (error) {
      setState((s) => ({ ...s, error: error.message, details: error.details ?? [] }));
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (state.loading) return <div className="content"><Loading label="Opening the marking sheet" /></div>;
  if (!rubric || !evaluation) {
    return <div className="content"><Notice tone="error">{state.error ?? 'This marking sheet could not be opened.'}</Notice></div>;
  }

  const total = rubric.criteria.length;

  return (
    <>
      <LiveSessionBar session={session} scoredCount={scoredCount} totalCount={total} />

      <div className="content">
        <div className="page-head">
          <span className="eyebrow">{evaluation.slot === 'chief' ? 'Chief examiner' : 'Support examiner'} · marking sheet</span>
          <h1>{session?.apprentice?.name}</h1>
          <p>{session?.apprentice?.projectTitle}</p>
        </div>

        {locked ? (
          <Notice tone="ok" title="Marks submitted">
            Your sheet is locked at {formatMark(evaluation.total)}. If something needs to change, ask an administrator to reopen it.
          </Notice>
        ) : null}

        {evaluation.reopenCount > 0 && !locked ? (
          <Notice tone="warn" title="This sheet was reopened">
            Reason on file: {evaluation.lastReopenReason}
          </Notice>
        ) : null}

        {state.error ? <Notice tone="error" details={state.details}>{state.error}</Notice> : null}

        {rubric.criteria.map((criterion) => {
          const current = scores[criterion.id] ?? { score: null, comment: '' };
          const hasScore = current.score !== null && current.score !== '' && current.score !== undefined;
          const selectedBand = hasScore
            ? rubric.bands.find((b) => Number(current.score) >= b.min && Number(current.score) <= b.max)
            : null;

          return (
            <section key={criterion.id} className={`criterion${hasScore ? ' is-scored' : ''}`}>
              <div className="criterion-head">
                <span className="criterion-index">{String(criterion.order).padStart(2, '0')}</span>
                <span className="criterion-title">{criterion.title}</span>
                <span className="criterion-weight">{criterion.weight}%</span>
              </div>

              <div className="bands">
                {rubric.bands.map((band) => (
                  <button
                    key={band.id}
                    type="button"
                    disabled={locked}
                    className={`band${selectedBand?.id === band.id ? ' selected' : ''}`}
                    onClick={() => setScore(criterion.id, { score: band.suggested })}
                    aria-pressed={selectedBand?.id === band.id}
                  >
                    <span className="band-name">{band.label}</span>
                    <span className="band-range mono">{band.min}–{band.max}</span>
                    <span className="band-text">{criterion.descriptors?.[band.id]}</span>
                  </button>
                ))}
              </div>

              <div className="criterion-foot">
                <div className="field score-input">
                  <label htmlFor={`score-${criterion.id}`}>Mark</label>
                  <input
                    id={`score-${criterion.id}`}
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    disabled={locked}
                    value={current.score ?? ''}
                    onChange={(e) => setScore(criterion.id, { score: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                </div>
                <div className="field comment-input">
                  <label htmlFor={`comment-${criterion.id}`}>Comment</label>
                  <input
                    id={`comment-${criterion.id}`}
                    disabled={locked}
                    value={current.comment ?? ''}
                    placeholder="Optional note for the record"
                    onChange={(e) => setScore(criterion.id, { comment: e.target.value })}
                  />
                </div>
                <span className="mono small muted" style={{ paddingBottom: 10 }}>
                  contributes {hasScore ? ((Number(current.score) * criterion.weight) / 100).toFixed(2) : '0.00'}
                </span>
              </div>
            </section>
          );
        })}

        <Field label="Overall comment" hint="Optional. Shown to the coordinator alongside your marks.">
          <textarea disabled={locked} value={generalComment} onChange={(e) => { dirtyRef.current = true; setGeneralComment(e.target.value); }} />
        </Field>

        <div className="submit-dock">
          <div>
            <span className="eyebrow">Running total</span>
            <div className="running-total">{runningTotal.toFixed(2)}</div>
          </div>

          <div>
            <span className="eyebrow">Criteria scored</span>
            <div className="mono" style={{ fontSize: '1.1rem' }}>{scoredCount} of {total}</div>
          </div>

          {locked ? (
            <button className="btn ghost" type="button" onClick={() => navigate('/')} style={{ marginLeft: 'auto' }}>
              Back to my sessions
            </button>
          ) : confirming ? (
            <div className="btn-row" style={{ marginLeft: 'auto' }}>
              <span className="small">Submit these marks? You cannot change them afterwards.</span>
              <button className="btn seal" type="button" onClick={submit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Yes, submit'}
              </button>
              <button className="btn ghost" type="button" onClick={() => setConfirming(false)}>Keep editing</button>
            </div>
          ) : (
            <div className="btn-row" style={{ marginLeft: 'auto' }}>
              <span className="small muted mono">
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Draft saved' : saveState === 'failed' ? 'Save failed' : ''}
              </span>
              <button className="btn ghost" type="button" onClick={save}>Save draft</button>
              <button
                className="btn seal"
                type="button"
                onClick={() => setConfirming(true)}
                disabled={scoredCount < total}
                title={scoredCount < total ? 'Score every criterion first' : undefined}
              >
                Submit marks
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
