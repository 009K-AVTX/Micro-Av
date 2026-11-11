import { useState } from 'react';
import { useStore } from '../store';
import { Modal, Table } from '../components/ui';
import { uid } from '../utils';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '*', '#'];

function IvrEditor({ ivr, onClose, onSave }) {
  const { db } = useStore();
  const [m, setM] = useState(() => ivr ? structuredClone(ivr) : {
    name: '',
    greeting: '',
    timeout: 8,
    options: db.destinations[0] ? [{ key: '1', label: '', destinationId: db.destinations[0].id }] : [],
    fallbackDestinationId: '',
  });
  const set = (k, v) => setM(p => ({ ...p, [k]: v }));
  const setOpt = (i, patch) => setM(p => ({ ...p, options: p.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) }));
  const nextKey = () => KEYS.find(k => !m.options.some(o => o.key === k));

  const submit = () => {
    const keys = m.options.map(o => o.key);
    if (new Set(keys).size !== keys.length) return alert('Each option needs a different key.');
    onSave({ ...m, timeout: Number(m.timeout) });
  };

  return (
    <Modal title={ivr ? 'Edit IVR menu' : 'New IVR menu'} wide onClose={onClose} onSubmit={submit}>
      <div className="form-row">
        <label>Menu name<input required value={m.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Main menu" /></label>
        <label>Wait for key press (sec)<input type="number" min="3" max="30" value={m.timeout} onChange={e => set('timeout', e.target.value)} /></label>
      </div>
      <label>Greeting (read to the caller)
        <textarea rows="3" required value={m.greeting} onChange={e => set('greeting', e.target.value)}
          placeholder="Thanks for calling. Press 1 for sales, 2 for support." />
      </label>

      <div className="fieldset">
        <div className="fieldset-title">Menu options</div>
        {m.options.map((o, i) => (
          <div className="option-row" key={i}>
            <select value={o.key} onChange={e => setOpt(i, { key: e.target.value })} aria-label="Key">
              {KEYS.map(k => <option key={k}>{k}</option>)}
            </select>
            <input required placeholder="Label, e.g. Sales" value={o.label} onChange={e => setOpt(i, { label: e.target.value })} />
            <select value={o.destinationId} onChange={e => setOpt(i, { destinationId: e.target.value })}>
              {db.destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="button" className="btn btn-sm btn-danger" aria-label="Remove"
              onClick={() => set('options', m.options.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn btn-sm" disabled={!db.destinations.length || !nextKey()}
          onClick={() => set('options', [...m.options, { key: nextKey(), label: '', destinationId: db.destinations[0].id }])}>
          + Add option
        </button>
      </div>

      <label>If the caller presses nothing or a wrong key
        <select value={m.fallbackDestinationId} onChange={e => set('fallbackDestinationId', e.target.value)}>
          <option value="">Hang up (count as missed)</option>
          {db.destinations.map(d => <option key={d.id} value={d.id}>Forward to {d.name}</option>)}
        </select>
      </label>
    </Modal>
  );
}

export default function Ivr() {
  const { db, update, toast } = useStore();
  const [editing, setEditing] = useState(null);
  const destName = id => db.destinations.find(d => d.id === id)?.name || '—';

  const save = m => {
    update(d => ({ ...d, ivrs: m.id ? d.ivrs.map(x => (x.id === m.id ? m : x)) : [...d.ivrs, { ...m, id: uid() }] }));
    toast(m.id ? 'Menu updated' : 'Menu created');
    setEditing(null);
  };

  const remove = m => {
    const used = db.rules.filter(r => r.action === 'IVR' && r.ivrId === m.id);
    if (used.length) return alert(`"${m.name}" is used by rule(s): ${used.map(r => r.name).join(', ')}.`);
    if (!confirm(`Delete IVR menu "${m.name}"?`)) return;
    update(d => ({ ...d, ivrs: d.ivrs.filter(x => x.id !== m.id) }));
    toast('Menu deleted');
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>IVR menus</h2>
          <p className="muted small no-margin">"Press 1 for…" menus. Attach a menu to a number from Forwarding Rules.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>+ New menu</button>
      </div>
      <Table columns={['Menu', 'Greeting', 'Options', 'Fallback', 'Used by', '']} empty="No IVR menus yet.">
        {db.ivrs.map(m => (
          <tr key={m.id}>
            <td><strong>{m.name}</strong></td>
            <td className="wrap muted small">{m.greeting}</td>
            <td className="small">{m.options.map(o => <div key={o.key}><span className="kbd">{o.key}</span> {o.label} → {destName(o.destinationId)}</div>)}</td>
            <td>{m.fallbackDestinationId ? destName(m.fallbackDestinationId) : 'Hang up'}</td>
            <td className="small">{db.rules.filter(r => r.action === 'IVR' && r.ivrId === m.id).map(r => r.name).join(', ') || <span className="muted">Not used</span>}</td>
            <td className="actions">
              <button className="btn btn-sm" onClick={() => setEditing(m)}>Edit</button>{' '}
              <button className="btn btn-sm btn-danger" onClick={() => remove(m)}>Delete</button>
            </td>
          </tr>
        ))}
      </Table>
      {editing && <IvrEditor ivr={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
