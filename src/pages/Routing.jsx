import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../store';
import { Badge, Modal, Table } from '../components/ui';
import { fmtAgo, startOfDay, uid } from '../utils';

export const PLAN_STATUSES = ['Live', 'Draft', 'Archived'];
export const ANY_TIME = { enabled: false, days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '18:00' };

export const newPath = (db, name = 'Default') => ({
  id: uid(), name, prefix: '', hours: { ...ANY_TIME }, dailyCap: 0, strategy: 'Priority', ringTimeout: 20,
  targets: db.destinations[0] ? [{ destinationId: db.destinations[0].id, weight: 1 }] : [],
});

/** Why a plan can't go Live yet, or null. */
export function publishProblem(plan) {
  if (!plan.campaignId) return 'Bind the plan to a campaign first.';
  if (!plan.paths.length) return 'Add at least one path.';
  const empty = plan.paths.find(p => !p.targets.length);
  if (empty) return `Path "${empty.name}" has no destination.`;
  return null;
}

/**
 * Sets a plan's status. Going Live puts any other Live plan on the same campaign back to Draft
 * (one Live plan per campaign). Returns false if the user cancelled or the plan isn't ready.
 */
export function setPlanStatus(db, update, toast, plan, status) {
  if (status === 'Live') {
    const problem = publishProblem(plan);
    if (problem) {
      alert(problem);
      return false;
    }
    const other = db.plans.find(p => p.id !== plan.id && p.campaignId === plan.campaignId && p.status === 'Live');
    if (other && !confirm(`"${other.name}" is Live on this campaign. It will go back to Draft. Continue?`)) return false;
  }
  update(d => ({
    ...d,
    plans: d.plans.map(p =>
      p.id === plan.id ? { ...p, status, updatedAt: Date.now() }
        : status === 'Live' && p.campaignId === plan.campaignId && p.status === 'Live' ? { ...p, status: 'Draft' } : p),
  }));
  toast(status === 'Live' ? `${plan.name} is Live` : `${plan.name} moved to ${status}`);
  return true;
}

/** Name / campaign / description form, for new plans and for editing details. */
export function PlanForm({ plan, campaignId, onClose }) {
  const { db, update, toast } = useStore();
  const navigate = useNavigate();
  const save = v => {
    const fields = { name: v.name.trim(), campaignId: v.campaignId || null, description: v.description.trim() };
    if (plan) {
      const unbound = plan.status === 'Live' && fields.campaignId !== plan.campaignId;
      update(d => ({
        ...d,
        plans: d.plans.map(p => {
          if (p.id === plan.id) return { ...p, ...fields, status: unbound ? 'Draft' : p.status, updatedAt: Date.now() };
          return p;
        }),
      }));
      toast(unbound ? 'Saved. Campaign changed, so the plan went back to Draft.' : 'Plan saved');
      onClose();
    } else {
      const id = uid();
      update(d => ({ ...d, plans: [{ id, ...fields, status: 'Draft', updatedAt: Date.now(), paths: [newPath(d)] }, ...d.plans] }));
      toast('Plan created as a Draft. Add paths, test it, then publish.');
      navigate(`/routing/${id}`);
    }
  };
  return (
    <Modal title={plan ? 'Plan details' : 'New routing plan'} onClose={onClose} onSubmit={save} submitLabel={plan ? 'Save' : 'Create plan'}>
      <label>Name
        <input name="name" required defaultValue={plan?.name} placeholder="e.g. Sales — weekday routing" />
      </label>
      <label>Campaign
        <select name="campaignId" defaultValue={plan ? plan.campaignId || '' : campaignId || ''}>
          <option value="">— Unbound (can't go Live) —</option>
          {db.campaigns.map(c => <option key={c.id} value={c.id}>{c.name}{c.status !== 'Active' ? ` (${c.status.toLowerCase()})` : ''}</option>)}
        </select>
        <span className="hint small muted">A Live plan decides where every call to the campaign's numbers goes.</span>
      </label>
      <label>Description (optional)
        <input name="description" defaultValue={plan?.description} placeholder="What does this plan do?" />
      </label>
    </Modal>
  );
}

export default function Routing() {
  const { db, update, toast } = useStore();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(params.has('new'));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const today = useMemo(() => {
    const from = startOfDay(Date.now());
    const m = {};
    db.logs.forEach(l => { if (l.time >= from && l.planId) m[l.planId] = (m[l.planId] || 0) + 1; });
    return m;
  }, [db.logs]);

  const campName = id => db.campaigns.find(c => c.id === id)?.name;
  const q = search.trim().toLowerCase();
  const plans = db.plans
    .filter(p => (!status || p.status === status) && (!q || `${p.name} ${p.description} ${campName(p.campaignId) || ''}`.toLowerCase().includes(q)))
    .sort((a, b) => PLAN_STATUSES.indexOf(a.status) - PLAN_STATUSES.indexOf(b.status) || b.updatedAt - a.updatedAt);

  const remove = p => {
    if (!confirm(`Delete "${p.name}"?${p.status === 'Live' ? ' Its campaign falls back to each number\'s forwarding rule.' : ''}`)) return;
    update(d => ({ ...d, plans: d.plans.filter(x => x.id !== p.id) }));
    toast(`${p.name} deleted`);
  };

  const closeNew = () => {
    setCreating(false);
    if (params.has('new')) setParams({});
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Routing plans <span className="muted small">({db.plans.length})</span></h2>
          <p className="muted small no-margin">
            Conditional, weighted and capped call paths for a campaign. A Live plan overrides the numbers' <Link to="/forwarding">forwarding rules</Link>.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New plan</button>
      </div>

      <div className="toolbar mb-sm">
        <input type="search" placeholder="Search plans…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="seg" role="group" aria-label="Filter by status">
          <button className={!status ? 'on' : ''} onClick={() => setStatus('')}>All</button>
          {PLAN_STATUSES.map(s => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s}</button>)}
        </div>
      </div>

      <Table columns={['Plan', 'Campaign', 'Status', 'Paths', 'Calls today', 'Updated', '']}
        empty={db.plans.length ? 'No plans match. Try relaxing the filters.' : 'No routing plans yet. Create one to decide how a campaign\'s calls flow.'}>
        {plans.map(p => (
          <tr key={p.id} className={p.status === 'Archived' ? 'dim' : ''}>
            <td>
              <Link to={`/routing/${p.id}`}><strong>{p.name}</strong></Link>
              {p.description && <div className="muted small">{p.description}</div>}
            </td>
            <td>{p.campaignId ? <Link to={`/campaigns/${p.campaignId}`}>{campName(p.campaignId)}</Link> : <span className="muted">Unbound</span>}</td>
            <td><Badge>{p.status}</Badge></td>
            <td>{p.paths.length}</td>
            <td>{today[p.id] || 0}</td>
            <td className="small muted">{fmtAgo(p.updatedAt)}</td>
            <td className="actions">
              <Link className="btn btn-sm" to={`/routing/${p.id}`}>Open</Link>{' '}
              {p.status === 'Live'
                ? <button className="btn btn-sm" onClick={() => setPlanStatus(db, update, toast, p, 'Draft')}>Unpublish</button>
                : <button className="btn btn-sm" onClick={() => setPlanStatus(db, update, toast, p, 'Live')}>Publish</button>}{' '}
              <button className="btn btn-sm btn-danger" onClick={() => remove(p)}>Delete</button>
            </td>
          </tr>
        ))}
      </Table>

      {creating && <PlanForm campaignId={params.get('new')} onClose={closeNew} />}
    </div>
  );
}
