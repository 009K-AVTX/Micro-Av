import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Switch } from '../components/ui';
import { TIMEZONES, uid } from '../utils';

export default function Settings() {
  const { db, update, reset, toast } = useStore();
  const [form, setForm] = useState(db.settings);
  const [showKey, setShowKey] = useState(false);
  useEffect(() => setForm(db.settings), [db.settings]);
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = e => {
    e.preventDefault();
    update(d => ({ ...d, settings: { ...d.settings, ...form, lowBalance: Number(form.lowBalance) || 0 } }));
    toast('Settings saved');
  };

  // Toggles save straight away.
  const toggle = key => on => {
    update(d => ({ ...d, settings: { ...d.settings, [key]: on } }));
  };

  const regenerate = () => {
    if (!confirm('Generate a new API key? The old key stops working immediately.')) return;
    update(d => ({ ...d, settings: { ...d.settings, apiKey: `mav_live_${uid()}${uid()}${uid()}` } }));
    toast('New API key generated');
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(db.settings.apiKey);
      toast('API key copied');
    } catch {
      toast('Could not copy — select it manually');
    }
  };

  const resetDemo = () => {
    if (!confirm('Reset all data to the demo defaults?')) return;
    reset();
    toast('Demo data restored');
  };

  const key = db.settings.apiKey;

  return (
    <div className="settings">
      <div className="card">
        <div className="card-head"><h2>Account</h2></div>
        <form onSubmit={submit}>
          <label>Company name
            <input value={form.company} onChange={set('company')} />
          </label>
          <div className="form-row">
            <label>Timezone
              <select value={form.timezone} onChange={set('timezone')}>
                {TIMEZONES.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Notification email
              <input type="email" value={form.notifyEmail} onChange={set('notifyEmail')} />
            </label>
          </div>
          <label>Low balance alert ($)
            <input type="number" min="0" value={form.lowBalance} onChange={set('lowBalance')} />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Save changes</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-head"><h2>Notifications & demo</h2></div>
        <div className="switch-row">
          <Switch checked={db.settings.notifyMissed} onChange={toggle('notifyMissed')} />
          Notify me about missed calls
        </div>
        <div className="switch-row">
          <Switch checked={db.settings.simulate} onChange={toggle('simulate')} />
          Simulate call traffic (demo calls appear in Live Monitor and Call Logs)
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>API access</h2></div>
        <p className="muted small">Use this key to manage numbers and rules from your own systems.</p>
        <div className="inline">
          <code className="api-key">{showKey ? key : `${key.slice(0, 12)}${'•'.repeat(16)}`}</code>
          <button type="button" className="btn btn-sm" onClick={() => setShowKey(s => !s)}>{showKey ? 'Hide' : 'Show'}</button>
          <button type="button" className="btn btn-sm" onClick={copyKey}>Copy</button>
          <button type="button" className="btn btn-sm btn-danger" onClick={regenerate}>Regenerate</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Danger zone</h2></div>
        <div className="inline-between">
          <span className="muted">Restore all numbers, rules, calls and billing to the demo defaults.</span>
          <button type="button" className="btn btn-danger" onClick={resetDemo}>Reset demo data</button>
        </div>
      </div>
    </div>
  );
}
