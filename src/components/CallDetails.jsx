import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { Badge, Modal, Trace } from './ui';
import { fmtDur, money, sameNumber, uid } from '../utils';

export default function CallDetails({ log, onClose }) {
  const { db, update, toast } = useStore();
  const isBlocked = db.blocked.some(b => sameNumber(b.number, log.from));

  const block = () => {
    update(d => ({ ...d, blocked: [{ id: uid(), number: log.from, reason: 'Blocked from call log', addedAt: Date.now() }, ...d.blocked] }));
    toast(`${log.from} blocked`);
  };

  return (
    <Modal
      title="Call details"
      onClose={onClose}
      wide
      extraActions={!isBlocked && (
        <button type="button" className="btn btn-danger" onClick={block}>Block caller</button>
      )}
    >
      <dl className="kv">
        <dt>Status</dt><dd><Badge>{log.status}</Badge></dd>
        <dt>Time</dt><dd>{new Date(log.time).toLocaleString()}</dd>
        <dt>Caller</dt><dd>{log.from}{isBlocked && <span className="muted small"> (blocked)</span>}</dd>
        <dt>Dialed</dt><dd>{log.to}</dd>
        <dt>Campaign</dt><dd>{log.campaignId && db.campaigns.some(c => c.id === log.campaignId)
          ? <Link to={`/campaigns/${log.campaignId}`} onClick={onClose}>{log.campaign}</Link> : (log.campaign || '—')}</dd>
        <dt>{log.planId ? 'Routing path' : 'Rule'}</dt><dd>{log.ruleName}</dd>
        <dt>Forwarded to</dt><dd>{log.destination}</dd>
        <dt>Duration</dt><dd>{fmtDur(log.duration)}</dd>
        <dt>Cost</dt><dd>{money(log.cost || 0)}</dd>
      </dl>
      <h3 className="section-title">Routing trace</h3>
      <Trace steps={log.trace || []} />
    </Modal>
  );
}
