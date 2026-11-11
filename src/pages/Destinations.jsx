import { useState } from 'react';
import { useStore } from '../store';
import { Modal, Progress, Switch, Table } from '../components/ui';
import { destinationLoad } from '../lib/routing';
import { uid } from '../utils';

export default function Destinations() {
  const { db, live, update, toast } = useStore();
  const [editing, setEditing] = useState(null);

  const usedBy = id => [
    ...db.rules.filter(r => r.targets.some(t => t.destinationId === id) || r.hours.afterHoursDestinationId === id).map(r => r.name),
    ...db.ivrs.filter(i => i.fallbackDestinationId === id || i.options.some(o => o.destinationId === id)).map(i => `IVR: ${i.name}`),
  ];

  const save = v => {
    const fields = { name: v.name, target: v.target, type: v.type, concurrency: Number(v.concurrency) || 0, dailyCap: Number(v.dailyCap) || 0 };
    if (editing === 'new') {
      update(d => ({ ...d, destinations: [...d.destinations, { id: uid(), ...fields, status: 'Active' }] }));
      toast('Destination added');
    } else {
      update(d => ({ ...d, destinations: d.destinations.map(x => (x.id === editing.id ? { ...x, ...fields } : x)) }));
      toast('Destination updated');
    }
    setEditing(null);
  };

  const toggle = (id, on) => {
    update(d => ({ ...d, destinations: d.destinations.map(x => (x.id === id ? { ...x, status: on ? 'Active' : 'Paused' } : x)) }));
    toast(on ? 'Destination resumed' : 'Destination paused — calls will skip it');
  };

  const remove = d => {
    const users = usedBy(d.id);
    if (users.length) return alert(`"${d.name}" is still used by: ${users.join(', ')}. Remove it there first.`);
    if (!confirm(`Delete destination "${d.name}"?`)) return;
    update(x => ({ ...x, destinations: x.destinations.filter(y => y.id !== d.id) }));
    toast('Destination deleted');
  };

  const current = editing === 'new' ? { type: 'Phone', concurrency: 1, dailyCap: 0 } : editing;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Destinations</h2>
          <p className="muted small no-margin">Where calls get forwarded to. Rules and IVR menus send calls here.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Add destination</button>
      </div>
      <Table columns={['Name', 'Forwards to', 'Live / lines', 'Answered today / cap', 'Used by', 'Active', '']} empty="No destinations yet.">
        {db.destinations.map(d => {
          const load = destinationLoad(db, live, d.id);
          const users = usedBy(d.id);
          return (
            <tr key={d.id}>
              <td><strong>{d.name}</strong></td>
              <td><span className="badge badge-gray">{d.type}</span> {d.target}</td>
              <td>{load.active} / {d.concurrency || '∞'}</td>
              <td>
                <div className="inline">
                  {load.today}{d.dailyCap ? ` / ${d.dailyCap}` : ''}
                  {d.dailyCap > 0 && <Progress value={load.today} max={d.dailyCap} />}
                </div>
              </td>
              <td className="muted small">{users.length ? users.join(', ') : 'Not used'}</td>
              <td><Switch checked={d.status === 'Active'} onChange={on => toggle(d.id, on)} /></td>
              <td className="actions">
                <button className="btn btn-sm" onClick={() => setEditing(d)}>Edit</button>{' '}
                <button className="btn btn-sm btn-danger" onClick={() => remove(d)}>Delete</button>
              </td>
            </tr>
          );
        })}
      </Table>

      {editing && (
        <Modal title={editing === 'new' ? 'Add destination' : 'Edit destination'} onClose={() => setEditing(null)} onSubmit={save}>
          <label>Name
            <input name="name" required defaultValue={current.name} placeholder="e.g. Sales desk" />
          </label>
          <div className="form-row">
            <label>Type
              <select name="type" defaultValue={current.type}><option>Phone</option><option>SIP</option></select>
            </label>
            <label>Phone number or SIP address
              <input name="target" required defaultValue={current.target} placeholder="+1 (555) 000-0000" />
            </label>
          </div>
          <div className="form-row">
            <label>Max simultaneous calls
              <input type="number" name="concurrency" min="0" defaultValue={current.concurrency} />
              <span className="muted small hint">0 = unlimited</span>
            </label>
            <label>Daily cap (answered calls)
              <input type="number" name="dailyCap" min="0" defaultValue={current.dailyCap} />
              <span className="muted small hint">0 = no cap</span>
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
