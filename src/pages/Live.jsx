import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { Badge, LogsTable, Modal, Stat, Table, Trace } from '../components/ui';
import CallDetails from '../components/CallDetails';
import { callState, routeLabel } from '../lib/simulate';
import { fmtClock, startOfDay } from '../utils';

export default function Live() {
  const { db, live, hangup, simulateCall } = useStore();
  const [now, setNow] = useState(Date.now());
  const [traceOf, setTraceOf] = useState(null);
  const [selected, setSelected] = useState(null);
  const [testNumber, setTestNumber] = useState('');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const states = live.map(c => callState(c, now));
  const connected = states.filter(s => s === 'Connected').length;
  const today = db.logs.filter(l => l.time >= startOfDay(now)).length;

  return (
    <>
      {!db.settings.simulate && (
        <div className="alert alert-info">
          Demo call traffic is off. Turn on <strong>Simulate call traffic</strong> in <Link to="/settings">Settings</Link> to see live calls.
        </div>
      )}
      <div className="grid">
        <Stat label="Active calls" value={live.length} />
        <Stat label="Ringing" value={live.length - connected} />
        <Stat label="Connected" value={connected} />
        <Stat label="Calls today" value={today} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2><span className="pulse" />Live calls</h2>
          <div className="toolbar">
            <select value={testNumber} onChange={e => setTestNumber(e.target.value)} aria-label="Number to call">
              <option value="">Random number</option>
              {db.numbers.map(n => <option key={n.id} value={n.id}>{n.number}</option>)}
            </select>
            <button className="btn btn-primary" disabled={!db.settings.simulate}
              onClick={() => simulateCall(testNumber ? { numberId: testNumber } : undefined)}>
              Simulate incoming call
            </button>
          </div>
        </div>
        <Table columns={['Caller', 'Dialed', 'Rule', 'Ringing', 'State', 'Duration', '']} empty="No calls in progress.">
          {live.map((c, i) => {
            const state = states[i];
            const secs = Math.max(0, Math.floor((now - (state === 'Connected' ? c.answerAt : c.startedAt)) / 1000));
            return (
              <tr key={c.id}>
                <td><strong>{c.from}</strong></td>
                <td>{c.number.number}</td>
                <td>{routeLabel(c.route)}</td>
                <td>{c.route.destination.name}</td>
                <td><Badge>{state}</Badge></td>
                <td className="mono">{fmtClock(secs)}</td>
                <td className="actions">
                  <button className="btn btn-sm" onClick={() => setTraceOf(c)}>Route</button>{' '}
                  <button className="btn btn-sm btn-danger" onClick={() => hangup(c.id)}>Hang up</button>
                </td>
              </tr>
            );
          })}
        </Table>
      </div>

      <div className="card">
        <div className="card-head"><h2>Just finished</h2><Link className="btn btn-sm" to="/logs">Call logs</Link></div>
        <LogsTable logs={db.logs.slice(0, 6)} onSelect={setSelected} />
      </div>

      {traceOf && (
        <Modal title={`Route for ${traceOf.from}`} onClose={() => setTraceOf(null)}>
          <Trace steps={traceOf.route.trace} />
        </Modal>
      )}
      {selected && <CallDetails log={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
