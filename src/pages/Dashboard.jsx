import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { LogsTable, Progress, Stat } from '../components/ui';
import { Legend, SERIES_COLORS, StackedColumns } from '../components/charts';
import CallDetails from '../components/CallDetails';
import { destinationLoad } from '../lib/routing';
import { dailyTrend } from '../lib/stats';
import { money, pct, startOfDay, startOfMonth } from '../utils';

// Same outcome colours as Reports (validated set: blue / red / amber).
export const CHART_SERIES = [
  { key: 'answered', label: 'Answered', color: SERIES_COLORS.blue },
  { key: 'missed', label: 'Missed / busy', color: SERIES_COLORS.red },
  { key: 'blocked', label: 'Blocked / failed', color: SERIES_COLORS.amber },
];

export function Delta({ now, prev, unit = '%', invert }) {
  if (prev == null || !isFinite(prev) || prev === 0) return <span className="muted small">no earlier data</span>;
  const diff = unit === 'pt' ? Math.round((now - prev) * 100) : Math.round(((now - prev) / prev) * 100);
  if (diff === 0) return <span className="muted small">same as previous 14 days</span>;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <span className={`delta ${good ? 'up' : 'down'}`}>
      {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}{unit === 'pt' ? ' pts' : '%'} <span className="muted">vs previous 14 days</span>
    </span>
  );
}

export default function Dashboard() {
  const { db, live } = useStore();
  const [selected, setSelected] = useState(null);
  const today = startOfDay(Date.now());

  const stats = useMemo(() => {
    const todays = db.logs.filter(l => l.time >= today);
    const monthStart = startOfMonth(Date.now());
    const month = db.logs.filter(l => l.time >= monthStart);
    return {
      calls: todays.length,
      answered: todays.filter(l => l.status === 'Answered').length,
      minutes: Math.round(month.reduce((a, l) => a + l.duration, 0) / 60),
      spend: month.reduce((a, l) => a + l.cost, 0),
    };
  }, [db.logs, today]);

  const trend = useMemo(() => dailyTrend(db.logs, today), [db.logs, today]);
  const rate = c => (c.calls ? c.answered / c.calls : null);

  const activeNumbers = db.numbers.filter(n => n.status === 'Active').length;
  const countries = new Set(db.numbers.map(n => n.country)).size;
  const ticker = [
    [live.length, 'live now'],
    [stats.calls, 'calls today'],
    [pct(stats.answered, stats.calls), 'answered'],
    [db.rules.filter(r => r.enabled).length, 'active rules'],
    [stats.minutes, 'minutes this month'],
    [money(db.billing.balance), 'balance'],
  ];

  return (
    <>
      {db.billing.balance < db.settings.lowBalance && (
        <div className="alert">
          Your balance is low ({money(db.billing.balance)}). <Link to="/billing">Add funds</Link> to keep calls forwarding.
        </div>
      )}
      <section className="hero">
        <span className="hero-word" aria-hidden="true">Calls</span>
        <div className="hero-inner">
          <div>
            <span className="hero-eyebrow">{db.settings.company}</span>
            <h2>Route every<br />call<span className="accent">.</span> Anywhere<span className="accent">.</span></h2>
            <p>
              {activeNumbers} numbers in {countries} countries, routing to{' '}
              {db.destinations.filter(d => d.status === 'Active').length} destinations.
            </p>
          </div>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/live">Live monitor →</Link>
            <Link className="btn" to="/forwarding">Manage rules</Link>
          </div>
        </div>
        <div className="ticker" aria-label="Today at a glance">
          <div className="ticker-track">
            {[0, 1].map(copy => (
              <div key={copy} className="inline" aria-hidden={copy === 1}>
                {ticker.map(([value, label]) => (
                  <span key={label} className="ticker-item"><b>{value}</b> {label}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid">
        <Stat label="Live calls" value={live.length} hint={<Link to="/live">Open live monitor</Link>} />
        <Stat label="Calls today" value={stats.calls} hint={`${pct(stats.answered, stats.calls)} answered`} />
        <Stat label="Active rules" value={db.rules.filter(r => r.enabled).length} hint={`${db.numbers.filter(n => n.status === 'Active').length} active numbers`} />
        <Stat label="Minutes this month" value={stats.minutes} hint={`${money(stats.spend)} spent`} />
        <Stat label="Balance" value={money(db.billing.balance)} hint={<Link to="/billing">Billing</Link>} />
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-head"><h2>Calls — last 14 days</h2><Link className="btn btn-sm" to="/reports">Reports</Link></div>
          <div className="viz-stats">
            <div>
              <div className="stat-label">Total calls</div>
              <div className="stat-value">{trend.cur.calls}</div>
              <Delta now={trend.cur.calls} prev={trend.prev.calls} />
            </div>
            <div>
              <div className="stat-label">Answer rate</div>
              <div className="stat-value">{pct(trend.cur.answered, trend.cur.calls)}</div>
              <Delta now={rate(trend.cur)} prev={rate(trend.prev)} unit="pt" />
            </div>
            <div>
              <div className="stat-label">Busiest day</div>
              <div className="stat-value">{trend.days[trend.busiest].label}</div>
              <span className="muted small">{trend.busiestTotal} calls</span>
            </div>
          </div>
          <Legend items={CHART_SERIES.map(s => ({ ...s, value: trend.cur[s.key] }))} />
          <StackedColumns data={trend.days} series={CHART_SERIES} highlight={13} />
        </div>
        <div className="card">
          <div className="card-head"><h2>Destinations today</h2></div>
          {db.destinations.map(d => {
            const load = destinationLoad(db, live, d.id);
            return (
              <div key={d.id} className="dest-row">
                <div>
                  <strong>{d.name}</strong>
                  <div className="muted small">{load.active} live · {load.today}{d.dailyCap ? ` / ${d.dailyCap}` : ''} answered</div>
                </div>
                {d.dailyCap ? <Progress value={load.today} max={d.dailyCap} /> : <span className="muted small">No cap</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Recent calls</h2><Link className="btn btn-sm" to="/logs">View all</Link></div>
        <LogsTable logs={db.logs.slice(0, 8)} onSelect={setSelected} />
      </div>
      {selected && <CallDetails log={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
