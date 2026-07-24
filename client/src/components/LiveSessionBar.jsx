import { api } from '../api/client.js';
import { useCountdown, formatClock } from '../hooks/useCountdown.js';

/**
 * The signature element. Present only while a session is running, it answers
 * the two questions an examiner has mid-evaluation: how long is left, and how
 * many criteria are still blank. The tick strip is one segment per criterion.
 */
export function LiveSessionBar({ session, scoredCount, totalCount }) {
  const active = session?.status === 'in_progress';
  const { remainingMs } = useCountdown(session?.id ?? session?._id, {
    active,
    onFetch: api.getTimer,
  });

  if (!active) return null;

  const ended = remainingMs <= 0;
  const urgent = !ended && remainingMs <= 5 * 60 * 1000;

  return (
    <div className={`live-bar${ended ? ' is-ended' : ''}${urgent ? ' is-urgent' : ''}`}>
      <div className="live-clock" aria-live="off">{formatClock(remainingMs)}</div>

      <div className="live-meta">
        <span className="eyebrow">{ended ? 'Time is up' : 'Time remaining'}</span>
        <strong>{session.apprentice?.name}</strong>
        <span className="small" style={{ color: 'rgba(255,255,255,0.6)' }}>{session.venue}</span>
      </div>

      {typeof scoredCount === 'number' ? (
        <>
          <div className="tick-strip" role="img" aria-label={`${scoredCount} of ${totalCount} criteria scored`}>
            {Array.from({ length: totalCount }, (_, i) => (
              <span key={i} className={`tick${i < scoredCount ? ' filled' : ''}`} />
            ))}
          </div>
          <span className="tick-label">
            {scoredCount}/{totalCount} scored
          </span>
        </>
      ) : null}
    </div>
  );
}
