import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { Badge, Modal, Progress, Switch, Table } from '../components/ui';
import { campaignToday } from '../lib/routing';
import { DAY, money, pct, uid } from '../utils';

export const CAMPAIGN_STATUSES = ['Active', 'Paused', 'Archived'];

/** Create / edit form. Shared with the campaign detail page. */
export function CampaignForm({ campaign, onClose }) {
  const { update, toast } = useStore();
  const navigate = useNavigate();
  const save = v => {
    const fields = { name: v.name.trim(), note: v.note.trim(), dailyCap: Math.max(0, Number(v.dailyCap) || 0) };
    if (campaign) {
      update(d => ({ ...d, campaigns: d.campaigns.map(c => (c.id === campaign.id ? { ...c, ...fields, status: v.status } : c)) }));
      toast('Campaign saved');
      onClose();
    } else {
      const id = uid();
      update(d => ({ ...d, campaigns: [{ id, ...fields, status: 'Active', createdAt: Date.now() }, ...d.campaigns] }));
      toast('Campaign created. Attach tracking numbers to start receiving calls.');
      navigate(`/campaigns/${id}`);
    }
  };
  return (
    <Modal title={campaign ? `Edit ${campaign.name}` : 'New campaign'} onClose={onClose} onSubmit={save}
      submitLabel={campaign ? 'Save' : 'Create campaign'}>
      <label>Campaign name
        <input name="name" required defaultValue={campaign?.name} placeholder="e.g. Search ads — Sales" />
      </label>
      <div className="form-row">
        <label>Daily cap
          <input type="number" name="dailyCap" min="0" defaultValue={campaign?.dailyCap ?? 0} />
          <span className="hint small muted">Calls per day. 0 = unlimited.</span>
        </label>
        {campaign && (
          <label>Status
            <select name="status" defaultValue={campaign.status}>
              {CAMPAIGN_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
        )}
      </div>
      <label>Note (optional)
        <input name="note" defaultValue={campaign?.note} placeholder="Where this traffic comes from" />
      </label>
    </Modal>
  );
}

/** Copies a campaign. The copy starts paused with no numbers (a number belongs to one campaign). */
export function cloneCampaign(c) {
  return { ...c, id: uid(), name: `${c.name} (copy)`, status: 'Paused', createdAt: Date.now() };
}

export function setCampaignStatus(update, ids, status) {
  const set = new Set(ids);
  update(d => ({ ...d, campaigns: d.campaigns.map(c => (set.has(c.id) ? { ...c, status } : c)) }));
}

/** Deletes campaigns: their numbers are detached and routing plans unbound. Call history is kept. */
export function deleteCampaigns(update, ids) {
  const set = new Set(ids);
  update(d => ({
    ...d,
    campaigns: d.campaigns.filter(c => !set.has(c.id)),
    numbers: d.numbers.map(n => (set.has(n.campaignId) ? { ...n, campaignId: null } : n)),
    plans: d.plans.map(p => (set.has(p.campaignId) ? { ...p, campaignId: null, status: p.status === 'Live' ? 'Draft' : p.status } : p)),
  }));
}

const SORTS = {
  recent: { label: 'Most recent', fn: (a, b) => b.createdAt - a.createdAt },
  name: { label: 'Name (A–Z)', fn: (a, b) => a.name.localeCompare(b.name) },
  today: { label: 'Calls today', fn: (a, b) => b.today - a.today },
};

export default function Campaigns() {
  const { db, live, update, toast } = useStore();
  const [editing, setEditing] = useState(null); // null | 'new' | campaign
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('recent');
  const [selected, setSelected] = useState(new Set());

  // Last-7-day numbers per campaign, one pass over the logs.
  const week = useMemo(() => {
    const from = Date.now() - 7 * DAY;
    const m = {};
    db.logs.forEach(l => {
      if (l.time < from || !l.campaignId) return;
      const r = (m[l.campaignId] ||= { calls: 0, answered: 0, seconds: 0, cost: 0 });
      r.calls++;
      if (l.status === 'Answered') r.answered++;
      r.seconds += l.duration;
      r.cost += l.cost;
    });
    return m;
  }, [db.logs]);

  const q = search.trim().toLowerCase();
  const rows = db.campaigns
    .filter(c => (!status || c.status === status) && (!q || `${c.name} ${c.note}`.toLowerCase().includes(q)))
    .map(c => ({
      ...c,
      today: campaignToday(db, live, c.id),
      numbers: db.numbers.filter(n => n.campaignId === c.id),
      plan: db.plans.find(p => p.campaignId === c.id && p.status === 'Live'),
      w: week[c.id] || { calls: 0, answered: 0, seconds: 0, cost: 0 },
    }))
    .sort(SORTS[sort].fn);

  const ids = [...selected].filter(id => db.campaigns.some(c => c.id === id));
  const toggleOne = (id, on) => setSelected(s => {
    const n = new Set(s);
    on ? n.add(id) : n.delete(id);
    return n;
  });
  const allOn = rows.length > 0 && rows.every(r => selected.has(r.id));

  const bulk = st => {
    setCampaignStatus(update, ids, st);
    toast(`${ids.length} campaign${ids.length > 1 ? 's' : ''} set to ${st.toLowerCase()}`);
    setSelected(new Set());
  };
  const bulkDelete = () => {
    if (!confirm(`Delete ${ids.length} campaign${ids.length > 1 ? 's' : ''}? Their numbers are detached; call history is kept.`)) return;
    deleteCampaigns(update, ids);
    toast('Deleted');
    setSelected(new Set());
  };
  const clone = c => {
    update(d => ({ ...d, campaigns: [cloneCampaign(c), ...d.campaigns] }));
    toast(`Cloned as "${c.name} (copy)". It starts paused — attach a number, then switch it on.`);
  };

  const counts = Object.fromEntries(CAMPAIGN_STATUSES.map(s => [s, db.campaigns.filter(c => c.status === s).length]));

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Campaigns <span className="muted small">({db.campaigns.length})</span></h2>
          <p className="muted small no-margin">Group tracking numbers by traffic source. Pause, cap and route them together.</p>
        </div>
        <div className="toolbar">
          <Link className="btn" to="/routing">Routing plans</Link>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ New campaign</button>
        </div>
      </div>

      <div className="toolbar mb-sm">
        <input type="search" placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="seg" role="group" aria-label="Filter by status">
          <button className={!status ? 'on' : ''} onClick={() => setStatus('')}>All {db.campaigns.length}</button>
          {CAMPAIGN_STATUSES.map(s => (
            <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s} {counts[s]}</button>
          ))}
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort by">
          {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>Sort: {s.label}</option>)}
        </select>
      </div>

      {ids.length > 0 && (
        <div className="bulk-bar">
          <strong>{ids.length} selected</strong>
          <button className="btn btn-sm" onClick={() => bulk('Active')}>Activate</button>
          <button className="btn btn-sm" onClick={() => bulk('Paused')}>Pause</button>
          <button className="btn btn-sm" onClick={() => bulk('Archived')}>Archive</button>
          <button className="btn btn-sm btn-danger" onClick={bulkDelete}>Delete</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <Table
        columns={[
          <input key="all" type="checkbox" className="row-check" aria-label="Select all campaigns" checked={allOn}
            onChange={e => setSelected(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())} />,
          'Campaign', 'Status', 'Numbers', 'Routing', 'Today / cap', 'Calls 7d', 'Answered 7d', 'Minutes 7d', 'Cost 7d', 'On', '',
        ]}
        empty={db.campaigns.length ? 'No campaigns match. Try clearing the search or status filter.' : 'No campaigns yet. Create your first one to start grouping numbers.'}
      >
        {rows.map(c => (
          <tr key={c.id} className={c.status === 'Archived' ? 'dim' : ''}>
            <td><input type="checkbox" className="row-check" aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={e => toggleOne(c.id, e.target.checked)} /></td>
            <td>
              <Link to={`/campaigns/${c.id}`}><strong>{c.name}</strong></Link>
              {c.note && <div className="muted small">{c.note}</div>}
            </td>
            <td><Badge>{c.status}</Badge></td>
            <td>{c.numbers.length || <span className="muted">None</span>}</td>
            <td className="small">{c.plan ? <Link to={`/routing/${c.plan.id}`}>{c.plan.name}</Link> : <span className="muted">Number rules</span>}</td>
            <td>
              {c.today}{c.dailyCap ? ` / ${c.dailyCap}` : ''}{' '}
              {c.dailyCap > 0 && <Progress value={c.today} max={c.dailyCap} />}
            </td>
            <td>{c.w.calls}</td>
            <td>{pct(c.w.answered, c.w.calls)}</td>
            <td>{Math.round(c.w.seconds / 60)}</td>
            <td>{money(c.w.cost)}</td>
            <td>
              <Switch checked={c.status === 'Active'} onChange={on => {
                setCampaignStatus(update, [c.id], on ? 'Active' : 'Paused');
                toast(on ? `${c.name} activated` : `${c.name} paused — its numbers reject calls`);
              }} />
            </td>
            <td className="actions">
              <button className="btn btn-sm" onClick={() => setEditing(c)}>Edit</button>{' '}
              <button className="btn btn-sm" onClick={() => clone(c)}>Clone</button>
            </td>
          </tr>
        ))}
      </Table>

      {editing && <CampaignForm campaign={editing === 'new' ? null : db.campaigns.find(c => c.id === editing.id)} onClose={() => setEditing(null)} />}
    </div>
  );
}
