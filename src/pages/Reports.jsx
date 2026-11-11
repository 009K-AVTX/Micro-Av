import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Table } from '../components/ui';
import { ChartCard, ColumnChart, Donut, FlowStack, Hero, Icons, Legend, RankedBars, SERIES_COLORS } from '../components/charts';
import { bucketStatus } from '../lib/stats';
import { DAY, RANGES, downloadCsv, fmtDate, fmtDur, money, pct, startOfDay } from '../utils';

const GROUPS = {
  Day: { key: l => startOfDay(l.time), label: k => fmtDate(k), sort: 'key' },
  'Hour of day': { key: l => new Date(l.time).getHours(), label: k => `${String(k).padStart(2, '0')}:00`, sort: 'key' },
  'Phone number': { key: l => l.to, label: k => k },
  Destination: { key: l => l.destination, label: k => k },
  Campaign: { key: l => l.campaign || '—', label: k => k },
  'Rule / routing path': { key: l => l.ruleName, label: k => k },
  Status: { key: l => l.status, label: k => k },
};

// Call outcomes, in stacking order (bottom → top).
const OUTCOMES = [
  { key: 'answered', label: 'Answered', color: SERIES_COLORS.blue },
  { key: 'missed', label: 'Missed / busy', color: SERIES_COLORS.red },
  { key: 'blocked', label: 'Blocked / failed', color: SERIES_COLORS.amber },
];

const TIME_BLOCKS = [0, 4, 8, 12, 16, 20].map(h => ({ from: h, label: `${String(h).padStart(2, '0')}–${String(h + 4).padStart(2, '0')}` }));
const share = (a, b) => (b ? `${((a / b) * 100).toFixed(1).replace(/\.0$/, '')}%` : '0%');

export default function Reports() {
  const { db } = useStore();
  const [range, setRange] = useState('7d');
  const [groupBy, setGroupBy] = useState('Day');

  const inRange = useMemo(() => {
    const from = RANGES[range].from();
    return db.logs.filter(l => l.time >= from);
  }, [db.logs, range]);

  // Table + summary
  const { rows, totals } = useMemo(() => {
    const g = GROUPS[groupBy];
    const map = new Map();
    const totals = { calls: 0, answered: 0, missed: 0, blocked: 0, seconds: 0, cost: 0 };
    inRange.forEach(l => {
      const k = g.key(l);
      if (!map.has(k)) map.set(k, { key: k, label: g.label(k), calls: 0, answered: 0, missed: 0, blocked: 0, seconds: 0, cost: 0 });
      for (const row of [map.get(k), totals]) {
        row.calls++;
        bucketStatus(row, l.status);
        row.seconds += l.duration;
        row.cost += l.cost;
      }
    });
    const rows = [...map.values()].sort(g.sort === 'key' ? (a, b) => a.key - b.key : (a, b) => b.calls - a.calls);
    return { rows, totals };
  }, [inRange, groupBy]);

  // 1. When do calls come in? (4-hour blocks)
  const timeOfDay = useMemo(() => {
    const data = TIME_BLOCKS.map(b => ({ label: b.label, value: 0 }));
    inRange.forEach(l => { data[Math.floor(new Date(l.time).getHours() / 4)].value++; });
    const peak = data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0);
    return { data, peak };
  }, [inRange]);

  // 2. Outcomes over the period, split into 4 equal slices
  const periods = useMemo(() => {
    const now = Date.now();
    const start = range === 'all'
      ? Math.min(now - DAY, ...inRange.map(l => l.time))
      : RANGES[range].from();
    const n = 4;
    const span = (now - start) / n;
    const out = Array.from({ length: n }, (_, i) => {
      const a = start + i * span, b = a + span;
      const label = range === 'today'
        ? new Date(a).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : fmtDate(a);
      return { a, b, label, total: 0, parts: { answered: 0, missed: 0, blocked: 0 } };
    });
    inRange.forEach(l => {
      const p = out[Math.min(n - 1, Math.floor((l.time - start) / span))];
      if (!p) return;
      p.total++;
      bucketStatus(p.parts, l.status);
    });
    return out;
  }, [inRange, range]);

  // 3. Destination performance
  const destRows = useMemo(() => {
    const m = new Map();
    inRange.forEach(l => {
      if (!l.destinationId) return;
      const r = m.get(l.destinationId) || { name: l.destination, calls: 0, answered: 0, seconds: 0 };
      r.calls++;
      if (l.status === 'Answered') r.answered++;
      r.seconds += l.duration;
      m.set(l.destinationId, r);
    });
    return [...m.values()];
  }, [inRange]);

  // 4. How calls end
  const outcomeSlices = OUTCOMES.map(o => ({ label: o.label, color: o.color, value: totals[o.key] }));

  const exportCsv = () =>
    downloadCsv(`report-${groupBy.toLowerCase().replace(/\s/g, '-')}-${range}.csv`, [
      [groupBy, 'Calls', 'Answered', 'Missed/busy', 'Blocked/failed', 'Answer rate', 'Minutes', 'Avg talk time (s)', 'Cost'],
      ...rows.map(r => [r.label, r.calls, r.answered, r.missed, r.blocked, pct(r.answered, r.calls), Math.round(r.seconds / 60),
        r.answered ? Math.round(r.seconds / r.answered) : 0, r.cost.toFixed(2)]),
    ]);

  const rangeLabel = RANGES[range].label;
  const peakBlock = timeOfDay.data[timeOfDay.peak];

  return (
    <>
      <div className="card mb">
        <div className="card-head">
          <h2>Call report</h2>
          <div className="toolbar">
            <select value={range} onChange={e => setRange(e.target.value)}>
              {Object.entries(RANGES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
            </select>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value)}>
              {Object.keys(GROUPS).map(g => <option key={g} value={g}>Group by {g.toLowerCase()}</option>)}
            </select>
            <button className="btn" onClick={exportCsv}>Export CSV</button>
          </div>
        </div>
        <div className="grid compact no-mb">
          <div><div className="stat-label">Calls</div><div className="stat-value">{totals.calls}</div></div>
          <div><div className="stat-label">Answer rate</div><div className="stat-value">{pct(totals.answered, totals.calls)}</div></div>
          <div><div className="stat-label">Minutes</div><div className="stat-value">{Math.round(totals.seconds / 60)}</div></div>
          <div><div className="stat-label">Avg talk time</div><div className="stat-value">{fmtDur(totals.answered ? Math.round(totals.seconds / totals.answered) : 0)}</div></div>
          <div><div className="stat-label">Cost</div><div className="stat-value">{money(totals.cost)}</div></div>
        </div>
      </div>

      {totals.calls === 0 ? (
        <div className="card mb empty">No calls in this period.</div>
      ) : (
        <div className="viz-grid">
          <ChartCard icon={Icons.clock} title="When do callers ring?" meta={rangeLabel}>
            <Hero label="Busiest time of day" value={`${peakBlock.label.replace('–', ':00 – ')}:00`} />
            <ColumnChart data={timeOfDay.data} highlight={timeOfDay.peak} color={SERIES_COLORS.red}
              format={v => share(v, totals.calls)} />
          </ChartCard>

          <ChartCard icon={Icons.layers} title="How are calls ending over time?" meta="Calls">
            <Legend items={OUTCOMES} />
            <FlowStack periods={periods} series={OUTCOMES} />
          </ChartCard>

          <ChartCard icon={Icons.target} title="Which destinations perform best?" meta="Answer rate">
            <p className="viz-sub">Ranked by answer rate. Grey bar = share of calls. Hover a row for details.</p>
            {destRows.length
              ? <RankedBars rows={destRows} color={SERIES_COLORS.blue} />
              : <div className="empty">No calls reached a destination.</div>}
          </ChartCard>

          <ChartCard icon={Icons.pie} title="How do calls end?" meta="Calls">
            <div className="viz-split">
              <div>
                <Hero label="Total calls" value={totals.calls} />
                <Legend vertical items={outcomeSlices.map(s => ({ ...s, value: share(s.value, totals.calls) }))} />
              </div>
              <Donut slices={outcomeSlices} format={v => share(v, 1)} />
            </div>
          </ChartCard>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h2>Breakdown by {groupBy.toLowerCase()}</h2></div>
        <Table columns={[groupBy, 'Calls', 'Answered', 'Missed / busy', 'Blocked / failed', 'Answer rate', 'Minutes', 'Avg talk', 'Cost']} empty="No calls in this period.">
          {rows.map(r => (
            <tr key={r.key}>
              <td><strong>{r.label}</strong></td>
              <td>{r.calls}</td>
              <td>{r.answered}</td>
              <td>{r.missed}</td>
              <td>{r.blocked}</td>
              <td>{pct(r.answered, r.calls)}</td>
              <td>{Math.round(r.seconds / 60)}</td>
              <td>{fmtDur(r.answered ? Math.round(r.seconds / r.answered) : 0)}</td>
              <td>{money(r.cost)}</td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}
