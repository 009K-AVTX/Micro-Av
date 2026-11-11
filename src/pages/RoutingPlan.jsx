import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store';
import { Badge, Modal, Progress, Switch } from '../components/ui';
import { TestCall } from './Forwarding';
import { PlanForm, newPath, publishProblem, setPlanStatus } from './Routing';
import { pathToday } from '../lib/routing';
import { STRATEGIES, STRATEGY_HELP, WEEKDAYS, fmtAgo } from '../utils';

const daysLabel = days =>
  days.length === 7 ? 'Every day'
    : days.join() === '1,2,3,4,5' ? 'Mon–Fri'
      : days.join() === '0,6' ? 'Weekends' : days.map(d => WEEKDAYS[d]).join(', ');

/** The conditions a path checks, as short chips. Empty = matches every call. */
const conditions = p => [
  p.hours?.enabled && `${daysLabel(p.hours.days)} ${p.hours.start}–${p.hours.end}`,
  p.prefix && `Caller starts ${p.prefix}`,
  p.dailyCap > 0 && `Max ${p.dailyCap} calls/day`,
].filter(Boolean);

function PathEditor({ path, onClose, onSave }) {
  const { db } = useStore();
  const [p, setP] = useState(() => structuredClone(path));
  const set = (k, v) => setP(x => ({ ...x, [k]: v }));
  const setHours = (k, v) => setP(x => ({ ...x, hours: { ...x.hours, [k]: v } }));
  const setTarget = (i, patch) => setP(x => ({ ...x, targets: x.targets.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  const moveTarget = (i, dir) => setP(x => {
    const t = [...x.targets];
    const j = i + dir;
    if (j < 0 || j >= t.length) return x;
    [t[i], t[j]] = [t[j], t[i]];
    return { ...x, targets: t };
  });
  const toggleDay = d => setHours('days', p.hours.days.includes(d) ? p.hours.days.filter(x => x !== d) : [...p.hours.days, d].sort());

  const submit = () => {
    if (!p.targets.length) return alert('Add at least one destination.');
    if (p.hours.enabled && !p.hours.days.length) return alert('Pick at least one day, or switch the time window off.');
    onSave({ ...p, name: p.name.trim() || 'Path', dailyCap: Math.max(0, Number(p.dailyCap) || 0), ringTimeout: Number(p.ringTimeout) || 20 });
  };

  return (
    <Modal title={path.name ? `Edit path: ${path.name}` : 'New path'} wide onClose={onClose} onSubmit={submit}>
      <div className="form-row">
        <label>Path name
          <input required value={p.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Office hours" />
        </label>
        <label>Ring timeout (sec)
          <input type="number" min="5" max="120" value={p.ringTimeout} onChange={e => set('ringTimeout', e.target.value)} />
        </label>
      </div>

      <div className="fieldset">
        <div className="fieldset-title">Conditions <span className="muted small">all must match · leave empty to catch every call</span></div>
        <div className="form-row">
          <label>Caller number starts with
            <input value={p.prefix} onChange={e => set('prefix', e.target.value)} placeholder="e.g. +1 212 or +44" />
          </label>
          <label>Daily cap for this path
            <input type="number" min="0" value={p.dailyCap} onChange={e => set('dailyCap', e.target.value)} />
            <span className="hint small muted">When full, calls move to the next path. 0 = no cap.</span>
          </label>
        </div>
        <div className="inline-between mb-sm">
          <span className="small">Only during a time window</span>
          <Switch checked={p.hours.enabled} onChange={on => setHours('enabled', on)} />
        </div>
        {p.hours.enabled && (
          <>
            <div className="check-row">
              {WEEKDAYS.map((w, d) => (
                <label key={d}><input type="checkbox" checked={p.hours.days.includes(d)} onChange={() => toggleDay(d)} />{w}</label>
              ))}
            </div>
            <div className="form-row">
              <label>From<input type="time" value={p.hours.start} onChange={e => setHours('start', e.target.value)} /></label>
              <label>Until<input type="time" value={p.hours.end} onChange={e => setHours('end', e.target.value)} /></label>
            </div>
          </>
        )}
      </div>

      <div className="fieldset">
        <div className="fieldset-title">
          Send to
          <select className="auto" value={p.strategy} onChange={e => set('strategy', e.target.value)}>
            {STRATEGIES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <p className="muted small">{STRATEGY_HELP[p.strategy]} If none of them is free, the call tries the next path.</p>
        {p.targets.map((t, i) => (
          <div className="target-row" key={i}>
            <span className="muted">{i + 1}.</span>
            <select value={t.destinationId} onChange={e => setTarget(i, { destinationId: e.target.value })}>
              {db.destinations.map(d => <option key={d.id} value={d.id}>{d.name} ({d.target})</option>)}
            </select>
            {p.strategy === 'Round robin'
              ? <input type="number" min="1" title="Weight" value={t.weight} onChange={e => setTarget(i, { weight: Number(e.target.value) })} />
              : <span />}
            <div className="inline">
              <button type="button" className="btn btn-sm" onClick={() => moveTarget(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button type="button" className="btn btn-sm" onClick={() => moveTarget(i, 1)} disabled={i === p.targets.length - 1} aria-label="Move down">↓</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => set('targets', p.targets.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-sm" disabled={!db.destinations.length}
          onClick={() => set('targets', [...p.targets, { destinationId: db.destinations[0].id, weight: 1 }])}>
          + Add destination
        </button>
      </div>
    </Modal>
  );
}

export default function RoutingPlan() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { db, live, update, toast } = useStore();
  const [editingPath, setEditingPath] = useState(null); // null | path (new paths have no name yet)
  const [editingDetails, setEditingDetails] = useState(false);
  const [testing, setTesting] = useState(false);
  const plan = db.plans.find(p => p.id === id);

  if (!plan) {
    return (
      <div className="card empty">
        <p>Routing plan not found. It may have been deleted.</p>
        <Link className="btn" to="/routing">Back to routing plans</Link>
      </div>
    );
  }

  const campaign = db.campaigns.find(c => c.id === plan.campaignId);
  const numbers = db.numbers.filter(n => n.campaignId && n.campaignId === plan.campaignId);
  const dest = did => db.destinations.find(d => d.id === did);
  const problem = publishProblem(plan);

  const setPaths = fn => update(d => ({
    ...d,
    plans: d.plans.map(p => (p.id === plan.id ? { ...p, paths: fn(p.paths), updatedAt: Date.now() } : p)),
  }));
  const savePath = path => {
    setPaths(paths => (paths.some(x => x.id === path.id) ? paths.map(x => (x.id === path.id ? path : x)) : [...paths, path]));
    toast(plan.status === 'Live' ? 'Path saved — live now' : 'Path saved');
    setEditingPath(null);
  };
  const movePath = (i, dir) => setPaths(paths => {
    const t = [...paths];
    const j = i + dir;
    if (j < 0 || j >= t.length) return paths;
    [t[i], t[j]] = [t[j], t[i]];
    return t;
  });
  const removePath = path => {
    if (plan.status === 'Live' && plan.paths.length === 1) return alert('A Live plan needs at least one path. Unpublish it first.');
    if (!confirm(`Remove path "${path.name}"?`)) return;
    setPaths(paths => paths.filter(x => x.id !== path.id));
  };
  const remove = () => {
    if (!confirm(`Delete "${plan.name}"?`)) return;
    update(d => ({ ...d, plans: d.plans.filter(p => p.id !== plan.id) }));
    toast(`${plan.name} deleted`);
    navigate('/routing');
  };

  // Test as if this plan were Live on its campaign (and the campaign were taking calls).
  const testDb = {
    ...db,
    campaigns: db.campaigns.map(c => (c.id === plan.campaignId ? { ...c, status: 'Active' } : c)),
    plans: db.plans.map(p =>
      p.id === plan.id ? { ...p, status: 'Live' }
        : p.campaignId === plan.campaignId && p.status === 'Live' ? { ...p, status: 'Draft' } : p),
  };

  const share = (path, t) => {
    if (path.strategy !== 'Round robin') return null;
    const total = path.targets.reduce((a, x) => a + (Number(x.weight) || 1), 0);
    return `${Math.round(((Number(t.weight) || 1) / total) * 100)}%`;
  };

  return (
    <>
      <div className="crumbs"><Link to="/routing">Routing plans</Link> <span className="muted">/</span> {plan.name}</div>

      {plan.status === 'Live' && campaign && campaign.status !== 'Active' && (
        <div className="alert">The campaign {campaign.name} is {campaign.status.toLowerCase()}, so this plan isn't receiving calls. <Link to={`/campaigns/${campaign.id}`}>Open campaign</Link></div>
      )}

      <div className="card mb">
        <div className="card-head">
          <div>
            <h2>{plan.name} <Badge>{plan.status}</Badge></h2>
            <p className="muted small no-margin">
              {campaign ? <>Campaign <Link to={`/campaigns/${campaign.id}`}>{campaign.name}</Link></> : 'Not bound to a campaign'}
              {' · '}updated {fmtAgo(plan.updatedAt)}{plan.description ? ` · ${plan.description}` : ''}
            </p>
          </div>
          <div className="toolbar">
            <button className="btn" disabled={!campaign || !numbers.length} title={!campaign ? 'Bind to a campaign to test' : !numbers.length ? 'The campaign has no numbers' : ''}
              onClick={() => setTesting(true)}>Test a call</button>
            <button className="btn" onClick={() => setEditingDetails(true)}>Details</button>
            {plan.status === 'Live'
              ? <button className="btn" onClick={() => setPlanStatus(db, update, toast, plan, 'Draft')}>Unpublish</button>
              : <button className="btn btn-primary" disabled={!!problem} title={problem || ''} onClick={() => setPlanStatus(db, update, toast, plan, 'Live')}>Publish</button>}
            {plan.status !== 'Archived' && plan.status !== 'Live' && <button className="btn" onClick={() => setPlanStatus(db, update, toast, plan, 'Archived')}>Archive</button>}
            <button className="btn btn-danger" onClick={remove}>Delete</button>
          </div>
        </div>
        {problem && plan.status !== 'Live' && <p className="muted small">Before publishing: {problem}</p>}

        <div className="flow">
          <div className="flow-source">
            <span className="flow-kicker">Incoming call</span>
            <strong>{campaign?.name || 'No campaign'}</strong>
            <span className="muted small">
              {numbers.length ? numbers.map(n => n.number).join(' · ') : 'No tracking numbers'}
            </span>
          </div>

          {plan.paths.map((path, i) => {
            const conds = conditions(path);
            const used = pathToday(db, live, path.id);
            return (
              <div className="flow-row" key={path.id}>
                <span className="flow-step">{i + 1}</span>
                <div className="flow-path">
                  <div className="inline-between">
                    <strong>{path.name}</strong>
                    <div className="inline">
                      <button className="btn btn-sm" onClick={() => movePath(i, -1)} disabled={i === 0} aria-label="Move path up">↑</button>
                      <button className="btn btn-sm" onClick={() => movePath(i, 1)} disabled={i === plan.paths.length - 1} aria-label="Move path down">↓</button>
                      <button className="btn btn-sm" onClick={() => setEditingPath(path)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => removePath(path)} aria-label="Remove path">✕</button>
                    </div>
                  </div>
                  <div className="flow-conds">
                    {conds.length ? conds.map(c => <span key={c} className="cond">{c}</span>) : <span className="cond cond-any">Any call</span>}
                  </div>
                  <span className="muted small">
                    {used} today{path.dailyCap ? ` of ${path.dailyCap}` : ''}{' '}
                    {path.dailyCap > 0 && <Progress value={used} max={path.dailyCap} />}
                  </span>
                </div>
                <div className="flow-arrow" aria-hidden="true"><span>{path.strategy}</span></div>
                <div className="flow-targets">
                  {path.targets.length === 0 && <span className="muted small">No destination</span>}
                  {path.targets.map((t, j) => {
                    const d = dest(t.destinationId);
                    return (
                      <div key={j} className={`flow-dest ${d?.status !== 'Active' ? 'off' : ''}`}>
                        <span className="muted small">{path.strategy === 'Priority' ? `${j + 1}.` : share(path, t) || '•'}</span>
                        <span>{d?.name || 'Deleted destination'}</span>
                        {d && d.status !== 'Active' && <Badge>{d.status}</Badge>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flow-row flow-end">
            <span className="flow-step">✕</span>
            <div className="flow-path"><span className="muted small">No path can take the call → counted as missed</span></div>
          </div>

          <button className="btn btn-sm" onClick={() => setEditingPath({ ...newPath(db, ''), name: '' })}>+ Add path</button>
        </div>
        <p className="muted small">Paths are checked top to bottom. The first one whose conditions match and has a free destination takes the call.</p>
      </div>

      {editingPath && <PathEditor path={editingPath} onClose={() => setEditingPath(null)} onSave={savePath} />}
      {editingDetails && <PlanForm plan={plan} onClose={() => setEditingDetails(false)} />}
      {testing && (
        <TestCall onClose={() => setTesting(false)} db={testDb} numbers={numbers}
          note={`Runs this plan as if it were Live${campaign?.status !== 'Active' ? ' and the campaign were active' : ''}. No call is placed and nothing is logged.`} />
      )}
    </>
  );
}
