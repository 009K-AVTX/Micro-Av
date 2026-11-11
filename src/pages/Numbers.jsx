import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { Badge, Modal, Table } from '../components/ui';
import { money, startOfDay, uid } from '../utils';

export default function Numbers() {
  const { db, update, toast } = useStore();
  const [editing, setEditing] = useState(null); // null | 'new' | number object
  const [search, setSearch] = useState('');

  const callsToday = useMemo(() => {
    const from = startOfDay(Date.now());
    const counts = {};
    db.logs.forEach(l => { if (l.time >= from) counts[l.numberId] = (counts[l.numberId] || 0) + 1; });
    return counts;
  }, [db.logs]);

  const save = v => {
    const fields = { number: v.number, label: v.label, country: v.country, type: v.type, monthlyCost: Number(v.monthlyCost) || 0, campaignId: v.campaignId || null };
    if (editing === 'new') {
      update(d => ({ ...d, numbers: [...d.numbers, { id: uid(), ...fields, status: 'Active' }] }));
      toast('Number added');
    } else {
      update(d => ({ ...d, numbers: d.numbers.map(n => (n.id === editing.id ? { ...n, ...fields, status: v.status } : n)) }));
      toast('Number updated');
    }
    setEditing(null);
  };

  const release = id => {
    if (!confirm('Release this number? Its forwarding rules will be removed.')) return;
    update(d => ({
      ...d,
      numbers: d.numbers.filter(n => n.id !== id),
      rules: d.rules.filter(r => r.numberId !== id),
    }));
    toast('Number released');
  };

  const q = search.trim().toLowerCase();
  const list = db.numbers.filter(n => !q || `${n.number} ${n.label} ${n.country}`.toLowerCase().includes(q));
  const current = editing === 'new' ? { type: 'Local', monthlyCost: 1.5 } : editing;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Phone numbers <span className="muted small">({db.numbers.length})</span></h2>
        <div className="toolbar">
          <input type="search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Add number</button>
        </div>
      </div>
      <Table columns={['Number', 'Label', 'Country', 'Type', 'Campaign', 'Routing', 'Calls today', 'Monthly', 'Status', '']} empty="No numbers found.">
        {list.map(n => {
          const rule = db.rules.find(r => r.numberId === n.id && r.enabled) || db.rules.find(r => r.numberId === n.id);
          const camp = db.campaigns.find(c => c.id === n.campaignId);
          const plan = camp && db.plans.find(p => p.campaignId === camp.id && p.status === 'Live');
          return (
            <tr key={n.id}>
              <td><strong>{n.number}</strong></td>
              <td>{n.label || <span className="muted">—</span>}</td>
              <td>{n.country}</td>
              <td>{n.type}</td>
              <td>{camp ? <Link to={`/campaigns/${camp.id}`}>{camp.name}</Link> : <span className="muted">—</span>}
                {camp && camp.status !== 'Active' && <span className="muted small"> ({camp.status.toLowerCase()})</span>}</td>
              <td>{plan ? <Link to={`/routing/${plan.id}`}>Plan: {plan.name}</Link>
                : rule ? <Link to="/forwarding">{rule.name}</Link> : <span className="muted">Not forwarded</span>}</td>
              <td>{callsToday[n.id] || 0}</td>
              <td>{money(n.monthlyCost || 0)}</td>
              <td><Badge>{n.status}</Badge></td>
              <td className="actions">
                <button className="btn btn-sm" onClick={() => setEditing(n)}>Edit</button>{' '}
                <button className="btn btn-sm btn-danger" onClick={() => release(n.id)}>Release</button>
              </td>
            </tr>
          );
        })}
      </Table>

      {editing && (
        <Modal title={editing === 'new' ? 'Add phone number' : 'Edit phone number'} onClose={() => setEditing(null)} onSubmit={save}>
          <div className="form-row">
            <label>Phone number
              <input name="number" required defaultValue={current.number} placeholder="+1 (555) 000-0000" />
            </label>
            <label>Label
              <input name="label" defaultValue={current.label} placeholder="e.g. Sales line" />
            </label>
          </div>
          <div className="form-row">
            <label>Country
              <input name="country" required defaultValue={current.country} placeholder="United States" />
            </label>
            <label>Type
              <select name="type" defaultValue={current.type}>
                <option>Local</option><option>Toll-free</option><option>Mobile</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>Monthly cost ($)
              <input type="number" name="monthlyCost" min="0" step="0.01" defaultValue={current.monthlyCost} />
            </label>
            <label>Campaign
              <select name="campaignId" defaultValue={current.campaignId || ''}>
                <option value="">Not in a campaign</option>
                {db.campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <div className="form-row">
            {editing !== 'new' && (
              <label>Status
                <select name="status" defaultValue={current.status}><option>Active</option><option>Suspended</option></select>
              </label>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
