import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { Badge, Modal, Switch, Table, Trace } from '../components/ui';
import { routeCall } from '../lib/routing';
import { STRATEGIES, STRATEGY_HELP, WEEKDAYS, uid } from '../utils';

const hoursSummary = h =>
  h.enabled ? `${h.days.map(d => WEEKDAYS[d]).join(', ')} ${h.start}–${h.end}` : '24/7';

function RuleEditor({ rule, onClose, onSave }) {
  const { db } = useStore();
  const [r, setR] = useState(() => rule ? structuredClone(rule) : {
    name: '',
    numberId: db.numbers[0]?.id ?? '',
    action: 'Forward',
    strategy: 'Priority',
    targets: db.destinations[0] ? [{ destinationId: db.destinations[0].id, weight: 1 }] : [],
    ringTimeout: 20,
    hours: { enabled: false, days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', afterHoursDestinationId: '' },
    ivrId: db.ivrs[0]?.id ?? '',
    enabled: true,
  });
  const set = (k, v) => setR(p => ({ ...p, [k]: v }));
  const setHours = (k, v) => setR(p => ({ ...p, hours: { ...p.hours, [k]: v } }));
  const setTarget = (i, patch) => setR(p => ({ ...p, targets: p.targets.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  const moveTarget = (i, dir) => setR(p => {
    const t = [...p.targets];
    const j = i + dir;
    if (j < 0 || j >= t.length) return p;
    [t[i], t[j]] = [t[j], t[i]];
    return { ...p, targets: t };
  });
  const toggleDay = d => setHours('days', r.hours.days.includes(d) ? r.hours.days.filter(x => x !== d) : [...r.hours.days, d].sort());

  const submit = () => {
    if (r.action === 'Forward' && !r.targets.length) return alert('Add at least one destination.');
    if (r.action === 'IVR' && !r.ivrId) return alert('Choose an IVR menu.');
    const other = db.rules.find(x => x.numberId === r.numberId && x.id !== r.id && x.enabled);
    if (other && r.enabled && !confirm(`"${other.name}" is already active on this number. It will be paused. Continue?`)) return;
    onSave({ ...r, ringTimeout: Number(r.ringTimeout) }, other);
  };

  return (
    <Modal title={rule ? 'Edit forwarding rule' : 'New forwarding rule'} wide onClose={onClose} onSubmit={submit}>
      <div className="form-row">
        <label>Rule name
          <input required value={r.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Sales failover" />
        </label>
        <label>Incoming number
          <select value={r.numberId} onChange={e => set('numberId', e.target.value)}>
            {db.numbers.map(n => <option key={n.id} value={n.id}>{n.number}{n.label ? ` — ${n.label}` : ''}</option>)}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>When a call comes in
          <select value={r.action} onChange={e => set('action', e.target.value)}>
            <option value="Forward">Forward to destinations</option>
            <option value="IVR">Play an IVR menu</option>
          </select>
        </label>
        <label>Ring timeout (sec)
          <input type="number" min="5" max="120" value={r.ringTimeout} onChange={e => set('ringTimeout', e.target.value)} />
        </label>
      </div>

      {r.action === 'IVR' ? (
        <label>IVR menu
          <select value={r.ivrId} onChange={e => set('ivrId', e.target.value)}>
            <option value="">Choose…</option>
            {db.ivrs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          {!db.ivrs.length && <span className="hint small">No menus yet — <Link to="/ivr">create one</Link>.</span>}
        </label>
      ) : (
        <div className="fieldset">
          <div className="fieldset-title">
            Destinations
            <select className="auto" value={r.strategy} onChange={e => set('strategy', e.target.value)}>
              {STRATEGIES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <p className="muted small">{STRATEGY_HELP[r.strategy]}</p>
          {r.targets.map((t, i) => (
            <div className="target-row" key={i}>
              <span className="muted">{i + 1}.</span>
              <select value={t.destinationId} onChange={e => setTarget(i, { destinationId: e.target.value })}>
                {db.destinations.map(d => <option key={d.id} value={d.id}>{d.name} ({d.target})</option>)}
              </select>
              {r.strategy === 'Round robin'
                ? <input type="number" min="1" title="Weight" value={t.weight} onChange={e => setTarget(i, { weight: Number(e.target.value) })} />
                : <span />}
              <div className="inline">
                <button type="button" className="btn btn-sm" onClick={() => moveTarget(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                <button type="button" className="btn btn-sm" onClick={() => moveTarget(i, 1)} disabled={i === r.targets.length - 1} aria-label="Move down">↓</button>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => set('targets', r.targets.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-sm" disabled={!db.destinations.length}
            onClick={() => set('targets', [...r.targets, { destinationId: db.destinations[0].id, weight: 1 }])}>
            + Add destination
          </button>
        </div>
      )}

      <div className="fieldset">
        <div className="fieldset-title">
          Business hours
          <Switch checked={r.hours.enabled} onChange={on => setHours('enabled', on)} />
        </div>
        {r.hours.enabled ? (
          <>
            <div className="check-row">
              {WEEKDAYS.map((w, d) => (
                <label key={d}><input type="checkbox" checked={r.hours.days.includes(d)} onChange={() => toggleDay(d)} />{w}</label>
              ))}
            </div>
            <div className="form-row">
              <label>Open from<input type="time" value={r.hours.start} onChange={e => setHours('start', e.target.value)} /></label>
              <label>Until<input type="time" value={r.hours.end} onChange={e => setHours('end', e.target.value)} /></label>
            </div>
            <label>Outside these hours, forward to
              <select value={r.hours.afterHoursDestinationId} onChange={e => setHours('afterHoursDestinationId', e.target.value)}>
                <option value="">Voicemail (count as missed)</option>
                {db.destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          </>
        ) : <p className="muted small no-margin">Rule runs 24/7.</p>}
      </div>
    </Modal>
  );
}

/** Dry-runs the routing engine. Pass `db` / `numbers` to test a draft setup instead of the saved one. */
export function TestCall({ onClose, db: dbOverride, numbers: onlyNumbers, note }) {
  const store = useStore();
  const db = dbOverride || store.db;
  const { live } = store;
  const numbers = onlyNumbers || db.numbers;
  const [numberId, setNumberId] = useState(numbers[0]?.id ?? '');
  const [from, setFrom] = useState('+1 (555) 123-4567');
  const [when, setWhen] = useState('');
  const [key, setKey] = useState('1');
  const [result, setResult] = useState(null);

  const campaignId = db.numbers.find(n => n.id === numberId)?.campaignId;
  const usesPlan = db.plans?.some(p => p.campaignId && p.campaignId === campaignId && p.status === 'Live');
  const rule = !usesPlan && db.rules.find(r => r.numberId === numberId && r.enabled);
  const run = () => setResult(routeCall(db, live, { from, numberId, at: when ? new Date(when).getTime() : Date.now(), key }));

  return (
    <Modal title="Test a call" wide onClose={onClose}
      extraActions={<button type="button" className="btn btn-primary" onClick={run}>Run test</button>}>
      <p className="muted small">{note || 'See exactly where a call would go — no real call is placed and nothing is logged.'}</p>
      <div className="form-row">
        <label>Caller number<input value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>Dialed number
          <select value={numberId} onChange={e => setNumberId(e.target.value)}>
            {numbers.map(n => <option key={n.id} value={n.id}>{n.number}{n.label ? ` — ${n.label}` : ''}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>Call time<input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
          <span className="hint small muted">Leave empty for now</span>
        </label>
        {rule?.action === 'IVR' && (
          <label>Caller presses
            <select value={key} onChange={e => setKey(e.target.value)}>
              {['1', '2', '3', '4', '5', '9', '0'].map(k => <option key={k}>{k}</option>)}
              <option value="">Nothing</option>
            </select>
          </label>
        )}
      </div>
      {result && (
        <div className="fieldset">
          <div className="fieldset-title">
            Result
            <Badge>{result.status === 'Routed' ? 'Answered' : result.status}</Badge>
          </div>
          <Trace steps={result.trace} />
        </div>
      )}
    </Modal>
  );
}

export default function Forwarding() {
  const { db, update, toast } = useStore();
  const [editing, setEditing] = useState(null); // null | 'new' | rule
  const [testing, setTesting] = useState(false);

  const numberLabel = id => db.numbers.find(n => n.id === id)?.number || 'Deleted number';
  const overriddenBy = numberId => {
    const cid = db.numbers.find(n => n.id === numberId)?.campaignId;
    return cid ? db.plans.find(p => p.campaignId === cid && p.status === 'Live') : null;
  };
  const destName = id => db.destinations.find(d => d.id === id)?.name || 'Deleted';

  const openNew = () => {
    if (!db.numbers.length) return toast('Add a phone number first');
    setEditing('new');
  };

  const save = (rule, conflicting) => {
    update(d => {
      let rules = d.rules.map(x => (conflicting && x.id === conflicting.id ? { ...x, enabled: false } : x));
      rules = rule.id ? rules.map(x => (x.id === rule.id ? rule : x)) : [...rules, { ...rule, id: uid() }];
      return { ...d, rules };
    });
    toast(rule.id ? 'Rule updated' : 'Rule created');
    setEditing(null);
  };

  const toggle = (rule, enabled) => {
    update(d => ({
      ...d,
      rules: d.rules.map(r =>
        r.id === rule.id ? { ...r, enabled }
          : enabled && r.numberId === rule.numberId ? { ...r, enabled: false } : r),
    }));
    toast(enabled ? 'Rule enabled' : 'Rule paused');
  };

  const remove = id => {
    if (!confirm('Delete this forwarding rule?')) return;
    update(d => ({ ...d, rules: d.rules.filter(r => r.id !== id) }));
    toast('Rule deleted');
  };

  const routeSummary = r =>
    r.action === 'IVR'
      ? `IVR: ${db.ivrs.find(i => i.id === r.ivrId)?.name || 'missing'}`
      : r.targets.map(t => destName(t.destinationId) + (r.strategy === 'Round robin' ? ` (${t.weight})` : '')).join(r.strategy === 'Priority' ? ' → ' : ', ');

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Forwarding rules</h2>
          <p className="muted small no-margin">
            One active rule per number decides where its calls go — unless the number's campaign has a Live <Link to="/routing">routing plan</Link>.
          </p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={() => setTesting(true)}>Test a call</button>
          <button className="btn btn-primary" onClick={openNew}>+ New rule</button>
        </div>
      </div>
      <Table columns={['Rule', 'Incoming number', 'Type', 'Routes to', 'Hours', 'Enabled', '']} empty="No forwarding rules yet.">
        {db.rules.map(r => (
          <tr key={r.id}>
            <td><strong>{r.name}</strong></td>
            <td>
              {numberLabel(r.numberId)}
              {overriddenBy(r.numberId) && <div className="small"><Link to={`/routing/${overriddenBy(r.numberId).id}`}>Overridden by {overriddenBy(r.numberId).name}</Link></div>}
            </td>
            <td><Badge>{r.action}</Badge>{r.action === 'Forward' && <span className="muted small"> {r.strategy}</span>}</td>
            <td className="wrap">{routeSummary(r)}</td>
            <td className="small">{hoursSummary(r.hours)}</td>
            <td><Switch checked={r.enabled} onChange={on => toggle(r, on)} /></td>
            <td className="actions">
              <button className="btn btn-sm" onClick={() => setEditing(r)}>Edit</button>{' '}
              <button className="btn btn-sm btn-danger" onClick={() => remove(r.id)}>Delete</button>
            </td>
          </tr>
        ))}
      </Table>

      {editing && <RuleEditor rule={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={save} />}
      {testing && <TestCall onClose={() => setTesting(false)} />}
    </div>
  );
}
