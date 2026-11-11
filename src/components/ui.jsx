import { fmtDur, fmtTime, money } from '../utils';

const BADGE_COLORS = {
  Active: 'green', Live: 'green', Answered: 'green', Connected: 'green', Enabled: 'green',
  Missed: 'red', Suspended: 'red', Blocked: 'red',
  Busy: 'amber', Ringing: 'amber', Draft: 'amber',
  Paused: 'gray', Failed: 'gray', Archived: 'gray',
  Forward: 'blue', IVR: 'blue',
};

export function Badge({ children }) {
  return <span className={`badge badge-${BADGE_COLORS[children] || 'gray'}`}>{children}</span>;
}

export function Switch({ checked, onChange, name }) {
  return (
    <label className="switch">
      <input type="checkbox" name={name} checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="slider" />
    </label>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  );
}

/**
 * With onSubmit: a form with Cancel/Save. Without it: a read-only dialog with Close.
 * onSubmit receives the form's named fields.
 */
export function Modal({ title, onClose, onSubmit, submitLabel = 'Save', wide, children, extraActions }) {
  const submit = e => {
    e.preventDefault();
    onSubmit(Object.fromEntries(new FormData(e.target)));
  };
  const actions = (
    <div className="form-actions">
      {extraActions}
      <button type="button" className="btn" onClick={onClose}>{onSubmit ? 'Cancel' : 'Close'}</button>
      {onSubmit && <button type="submit" className="btn btn-primary">{submitLabel}</button>}
    </div>
  );
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-lg' : ''}`} role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {onSubmit ? (
          <form onSubmit={submit}>{children}{actions}</form>
        ) : (
          <>{children}{actions}</>
        )}
      </div>
    </div>
  );
}

export function Table({ columns, empty, children }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {hasRows ? children : (
            <tr><td colSpan={columns.length} className="empty">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function LogsTable({ logs, onSelect }) {
  return (
    <Table columns={['Time', 'Caller', 'Dialed', 'Rule', 'Forwarded to', 'Duration', 'Cost', 'Status']} empty="No calls found.">
      {logs.map(l => (
        <tr key={l.id} className={onSelect ? 'clickable' : ''} onClick={() => onSelect?.(l)}>
          <td>{fmtTime(l.time)}</td>
          <td>{l.from}</td>
          <td>{l.to}</td>
          <td>{l.ruleName}</td>
          <td>{l.destination}</td>
          <td>{fmtDur(l.duration)}</td>
          <td>{l.cost ? money(l.cost) : '—'}</td>
          <td><Badge>{l.status}</Badge></td>
        </tr>
      ))}
    </Table>
  );
}

export function Trace({ steps }) {
  return (
    <ol className="trace">
      {steps.map((s, i) => <li key={i}>{s}</li>)}
    </ol>
  );
}

export function Progress({ value, max }) {
  const p = max ? Math.min(100, (value / max) * 100) : 0;
  return <span className={`progress ${p >= 100 ? 'full' : ''}`}><span style={{ width: `${p}%` }} /></span>;
}

export function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages === 1) return null;
  return (
    <div className="pagination">
      <span className="muted small">
        {page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} of {total}
      </span>
      <div className="inline">
        <button className="btn btn-sm" disabled={page === 0} onClick={() => onChange(page - 1)}>Previous</button>
        <span className="small">Page {page + 1} / {pages}</span>
        <button className="btn btn-sm" disabled={page >= pages - 1} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}
