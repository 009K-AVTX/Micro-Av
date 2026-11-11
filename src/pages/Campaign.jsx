import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store';
import { Badge, LogsTable, Modal, Progress, Switch, Table } from '../components/ui';
import { Legend, StackedColumns } from '../components/charts';
import CallDetails from '../components/CallDetails';
import { CHART_SERIES, Delta } from './Dashboard';
import { CampaignForm, cloneCampaign, deleteCampaigns, setCampaignStatus } from './Campaigns';
import { campaignToday } from '../lib/routing';
import { dailyTrend } from '../lib/stats';
import { DAY, fmtDate, fmtDur, money, pct, startOfDay } from '../utils';

function AttachNumbers({ campaign, onClose }) {
  const { db, update, toast } = useStore();
  const others = db.numbers.filter(n => n.campaignId !== campaign.id);
  const campName = id => db.campaigns.find(c => c.id === id)?.name;

  const save = v => {
    const ids = new Set(Object.keys(v).map(k => k.slice(2)));
    if (!ids.size) return onClose();
    update(d => ({ ...d, numbers: d.numbers.map(n => (ids.has(n.id) ? { ...n, campaignId: campaign.id } : n)) }));
    toast(`Attached ${ids.size} number${ids.size > 1 ? 's' : ''}`);
    onClose();
  };

  return (
    <Modal title={`Attach numbers to ${campaign.name}`} onClose={onClose} onSubmit={save} submitLabel="Attach">
      <p className="muted small">A number belongs to one campaign. Numbers already in another campaign move to this one.</p>
      {others.length === 0 && <div className="empty">Every number is already in this campaign.</div>}
      <div className="pick-list">
        {others.map(n => (
          <label key={n.id} className="pick-row">
            <input type="checkbox" name={`n_${n.id}`} />
            <span><strong>{n.number}</strong> <span className="muted small">{n.label}</span></span>
            <span className="muted small">{n.campaignId ? `moves from ${campName(n.campaignId)}` : 'Not in a campaign'}</span>
            <Badge>{n.status}</Badge>
          </label>
        ))}
      </div>
    </Modal>
  );
}

export default function Campaign() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { db, live, update, toast } = useStore();
  const [editing, setEditing] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [selected, setSelected] = useState(null);
  const c = db.campaigns.find(x => x.id === id);
  const today = startOfDay(Date.now());

  const logs = useMemo(() => db.logs.filter(l => l.campaignId === id), [db.logs, id]);
  const trend = useMemo(() => dailyTrend(logs, today), [logs, today]);

  const destRows = useMemo(() => {
    const m = new Map();
    logs.forEach(l => {
      if (l.time < today - 13 * DAY || !l.destinationId) return;
      const r = m.get(l.destinationId) || { name: l.destination, calls: 0, answered: 0, seconds: 0 };
      r.calls++;
      if (l.status === 'Answered') r.answered++;
      r.seconds += l.duration;
      m.set(l.destinationId, r);
    });
    return [...m.values()].sort((a, b) => b.calls - a.calls);
  }, [logs, today]);

  if (!c) {
    return (
      <div className="card empty">
        <p>Campaign not found. It may have been deleted.</p>
        <Link className="btn" to="/campaigns">Back to campaigns</Link>
      </div>
    );
  }

  const numbers = db.numbers.filter(n => n.campaignId === c.id);
  const plans = db.plans.filter(p => p.campaignId === c.id);
  const livePlan = plans.find(p => p.status === 'Live');
  const used = campaignToday(db, live, c.id);
  const callsToday = numbers.length ? Object.fromEntries(numbers.map(n => [n.id, logs.filter(l => l.numberId === n.id && l.time >= today).length])) : {};
  const rate = r => (r.calls ? r.answered / r.calls : null);

  const setStatus = st => {
    setCampaignStatus(update, [c.id], st);
    toast(st === 'Active' ? `${c.name} activated` : `${c.name} ${st.toLowerCase()} — its numbers reject calls`);
  };
  const detach = n => {
    update(d => ({ ...d, numbers: d.numbers.map(x => (x.id === n.id ? { ...x, campaignId: null } : x)) }));
    toast(`${n.number} detached`);
  };
  const clone = () => {
    const copy = cloneCampaign(c);
    update(d => ({ ...d, campaigns: [copy, ...d.campaigns] }));
    toast('Cloned. The copy starts paused — attach a number, then switch it on.');
    navigate(`/campaigns/${copy.id}`);
  };
  const remove = () => {
    if (!confirm(`Delete "${c.name}"? Its numbers are detached and its routing plans unbound. Call history is kept.`)) return;
    deleteCampaigns(update, [c.id]);
    toast(`${c.name} deleted`);
    navigate('/campaigns');
  };

  return (
    <>
      <div className="crumbs"><Link to="/campaigns">Campaigns</Link> <span className="muted">/</span> {c.name}</div>

      {c.status !== 'Active' && (
        <div className="alert">
          This campaign is {c.status.toLowerCase()}: calls to its {numbers.length} number{numbers.length === 1 ? '' : 's'} are rejected.
          {c.status === 'Paused' && <> <button className="btn btn-sm" onClick={() => setStatus('Active')}>Activate</button></>}
        </div>
      )}
      {c.status === 'Active' && c.dailyCap > 0 && used >= c.dailyCap && (
        <div className="alert">Daily cap reached: no more calls today. <button className="btn btn-sm" onClick={() => setEditing(true)}>Raise the cap</button></div>
      )}

      <div className="card mb">
        <div className="card-head">
          <div>
            <h2>{c.name} <Badge>{c.status}</Badge></h2>
            <p className="muted small no-margin">{c.note || 'No note'} · created {fmtDate(c.createdAt)}</p>
          </div>
          <div className="toolbar">
            {c.status !== 'Archived' && (
              <label className="inline small switch-label">
                <Switch checked={c.status === 'Active'} onChange={on => setStatus(on ? 'Active' : 'Paused')} /> Taking calls
              </label>
            )}
            <button className="btn" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn" onClick={clone}>Clone</button>
            {c.status !== 'Archived'
              ? <button className="btn" onClick={() => setStatus('Archived')}>Archive</button>
              : <button className="btn" onClick={() => setStatus('Paused')}>Unarchive</button>}
            <button className="btn btn-danger" onClick={remove}>Delete</button>
          </div>
        </div>
        <div className="viz-stats">
          <div>
            <div className="stat-label">Today / daily cap</div>
            <div className="stat-value">{used}{c.dailyCap ? <span className="muted"> / {c.dailyCap}</span> : ''}</div>
            {c.dailyCap ? <Progress value={used} max={c.dailyCap} /> : <span className="muted small">No cap</span>}
          </div>
          <div>
            <div className="stat-label">Calls, 14 days</div>
            <div className="stat-value">{trend.cur.calls}</div>
            <Delta now={trend.cur.calls} prev={trend.prev.calls} />
          </div>
          <div>
            <div className="stat-label">Answer rate</div>
            <div className="stat-value">{pct(trend.cur.answered, trend.cur.calls)}</div>
            <Delta now={rate(trend.cur)} prev={rate(trend.prev)} unit="pt" />
          </div>
          <div>
            <div className="stat-label">Minutes · cost</div>
            <div className="stat-value">{Math.round(trend.cur.seconds / 60)}</div>
            <span className="muted small">{money(trend.cur.cost)}</span>
          </div>
        </div>
        <Legend items={CHART_SERIES.map(s => ({ ...s, value: trend.cur[s.key] }))} />
        <StackedColumns data={trend.days} series={CHART_SERIES} highlight={13} />
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-head">
            <h2>Tracking numbers <span className="muted small">({numbers.length})</span></h2>
            <button className="btn btn-sm btn-primary" onClick={() => setAttaching(true)}>+ Attach numbers</button>
          </div>
          <Table columns={['Number', 'Label', 'Calls today', 'Status', '']} empty="No numbers yet. Attach one so this campaign can take calls.">
            {numbers.map(n => (
              <tr key={n.id}>
                <td><strong>{n.number}</strong></td>
                <td>{n.label || <span className="muted">—</span>}</td>
                <td>{callsToday[n.id] || 0}</td>
                <td><Badge>{n.status}</Badge></td>
                <td className="actions"><button className="btn btn-sm" onClick={() => detach(n)}>Detach</button></td>
              </tr>
            ))}
          </Table>
        </div>

        <div className="card">
          <div className="card-head"><h2>Routing</h2><Link className="btn btn-sm" to="/routing">All plans</Link></div>
          {livePlan ? (
            <p className="no-margin">Calls follow the Live plan <Link to={`/routing/${livePlan.id}`}><strong>{livePlan.name}</strong></Link> ({livePlan.paths.length} paths).</p>
          ) : (
            <p className="no-margin muted">No Live plan. Each number uses its own <Link to="/forwarding">forwarding rule</Link>.</p>
          )}
          {plans.filter(p => p !== livePlan).map(p => (
            <div key={p.id} className="dest-row">
              <Link to={`/routing/${p.id}`}>{p.name}</Link><Badge>{p.status}</Badge>
            </div>
          ))}
          <Link className="btn btn-sm mt" to={`/routing?new=${c.id}`}>+ New plan for this campaign</Link>
        </div>
      </div>

      <div className="card mb">
        <div className="card-head"><h2>Where calls went <span className="muted small">(14 days)</span></h2></div>
        <Table columns={['Destination', 'Calls', 'Answered', 'Answer rate', 'Avg talk']} empty="No calls reached a destination.">
          {destRows.map(r => (
            <tr key={r.name}>
              <td><strong>{r.name}</strong></td>
              <td>{r.calls}</td>
              <td>{r.answered}</td>
              <td>{pct(r.answered, r.calls)}</td>
              <td>{fmtDur(r.answered ? Math.round(r.seconds / r.answered) : 0)}</td>
            </tr>
          ))}
        </Table>
      </div>

      <div className="card">
        <div className="card-head"><h2>Recent calls</h2><Link className="btn btn-sm" to={`/logs?campaign=${c.id}`}>View all</Link></div>
        <LogsTable logs={logs.slice(0, 10)} onSelect={setSelected} />
      </div>

      {editing && <CampaignForm campaign={c} onClose={() => setEditing(false)} />}
      {attaching && <AttachNumbers campaign={c} onClose={() => setAttaching(false)} />}
      {selected && <CallDetails log={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
