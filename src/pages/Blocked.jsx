import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Modal, Table } from '../components/ui';
import { digits, fmtDate, fmtTime, sameNumber, uid } from '../utils';

export default function Blocked() {
  const { db, update, toast } = useStore();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    const s = {};
    db.logs.filter(l => l.status === 'Blocked').forEach(l => {
      const b = db.blocked.find(x => sameNumber(x.number, l.from));
      if (!b) return;
      s[b.id] ??= { count: 0, last: 0 };
      s[b.id].count++;
      s[b.id].last = Math.max(s[b.id].last, l.time);
    });
    return s;
  }, [db.logs, db.blocked]);

  const add = v => {
    const list = v.numbers.split(/[\n,;]+/).map(s => s.trim()).filter(s => digits(s).length >= 5);
    const fresh = list.filter((n, i) => !db.blocked.some(b => sameNumber(b.number, n)) && list.findIndex(x => sameNumber(x, n)) === i);
    if (!fresh.length) return toast('Nothing new to block');
    update(d => ({ ...d, blocked: [...fresh.map(number => ({ id: uid(), number, reason: v.reason, addedAt: Date.now() })), ...d.blocked] }));
    toast(`${fresh.length} number${fresh.length > 1 ? 's' : ''} blocked`);
    setAdding(false);
  };

  const unblock = b => {
    if (!confirm(`Unblock ${b.number}?`)) return;
    update(d => ({ ...d, blocked: d.blocked.filter(x => x.id !== b.id) }));
    toast('Number unblocked');
  };

  const q = digits(search);
  const list = db.blocked.filter(b => !q || digits(b.number).includes(q) || b.reason.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Blocked numbers <span className="muted small">({db.blocked.length})</span></h2>
          <p className="muted small no-margin">Calls from these numbers are rejected before any rule runs.</p>
        </div>
        <div className="toolbar">
          <input type="search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Block numbers</button>
        </div>
      </div>
      <Table columns={['Number', 'Reason', 'Blocked on', 'Calls stopped', 'Last attempt', '']} empty="No blocked numbers.">
        {list.map(b => (
          <tr key={b.id}>
            <td><strong>{b.number}</strong></td>
            <td>{b.reason || <span className="muted">—</span>}</td>
            <td>{fmtDate(b.addedAt)}</td>
            <td>{stats[b.id]?.count || 0}</td>
            <td>{stats[b.id] ? fmtTime(stats[b.id].last) : <span className="muted">—</span>}</td>
            <td className="actions"><button className="btn btn-sm" onClick={() => unblock(b)}>Unblock</button></td>
          </tr>
        ))}
      </Table>

      {adding && (
        <Modal title="Block numbers" onClose={() => setAdding(false)} onSubmit={add} submitLabel="Block">
          <label>Numbers
            <textarea name="numbers" rows="5" required placeholder={'+1 (555) 010-0000\n+1 (555) 010-0001'} />
            <span className="hint small muted">One per line, or separated by commas.</span>
          </label>
          <label>Reason
            <select name="reason">
              <option>Spam</option><option>Robocaller</option><option>Abusive caller</option><option>Fraud</option><option>Other</option>
            </select>
          </label>
        </Modal>
      )}
    </div>
  );
}
