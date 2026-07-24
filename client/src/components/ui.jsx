export function Notice({ tone = 'error', title, children, details }) {
  return (
    <div className={`notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {title ? <strong>{title}</strong> : null}
      {children ? <div>{children}</div> : null}
      {details?.length ? (
        <ul>
          {details.map((d, i) => (
            <li key={i}>{d.field !== '(root)' ? `${d.field}: ` : ''}{d.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p className="small">{children}</p>
    </div>
  );
}

export function Loading({ label = 'Loading' }) {
  return <div className="loading">{label}…</div>;
}

const STATUS_TONE = { in_progress: 'live', completed: 'seal', cancelled: '', scheduled: '' };
const STATUS_TEXT = { in_progress: 'Running', completed: 'Completed', cancelled: 'Cancelled', scheduled: 'Scheduled' };

export function StatusPill({ status }) {
  return <span className={`pill ${STATUS_TONE[status] ?? ''}`}>{STATUS_TEXT[status] ?? status}</span>;
}

export function Field({ label, hint, error, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}
