import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store';
import { LogsTable, Pagination } from '../components/ui';
import CallDetails from '../components/CallDetails';
import { CALL_STATUSES, RANGES, digits, downloadCsv, money } from '../utils';

const PAGE_SIZE = 25;

export default function Logs() {
  const { db } = useStore();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [numberId, setNumberId] = useState('');
  const [params] = useSearchParams();
  const [campaignId, setCampaignId] = useState(params.get('campaign') || '');
  const [range, setRange] = useState('7d');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);

  const logs = useMemo(() => {
    const q = digits(search);
    const from = RANGES[range].from();
    return db.logs.filter(l =>
      l.time >= from &&
      (!status || l.status === status) &&
      (!numberId || l.numberId === numberId) &&
      (!campaignId || l.campaignId === campaignId) &&
      (!q || digits(l.from + l.to).includes(q)));
  }, [db.logs, search, status, numberId, campaignId, range]);

  const filter = setter => e => {
    setter(e.target.value);
    setPage(0);
  };

  const exportCsv = () =>
    downloadCsv('call-logs.csv', [
      ['Time', 'Caller', 'Dialed', 'Campaign', 'Rule / routing path', 'Forwarded to', 'Duration (s)', 'Cost', 'Status'],
      ...logs.map(l => [new Date(l.time).toISOString(), l.from, l.to, l.campaign || '—', l.ruleName, l.destination, l.duration, l.cost, l.status]),
    ]);

  const totalCost = logs.reduce((a, l) => a + l.cost, 0);

  return (
    <div className="card">
      <div className="card-head">
        <h2>Call logs <span className="muted small">({logs.length} calls · {money(totalCost)})</span></h2>
        <button className="btn" onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="toolbar mb-sm">
        <input type="search" placeholder="Search caller or number…" value={search} onChange={filter(setSearch)} />
        <select value={range} onChange={filter(setRange)}>
          {Object.entries(RANGES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
        </select>
        <select value={campaignId} onChange={filter(setCampaignId)}>
          <option value="">All campaigns</option>
          {db.campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={numberId} onChange={filter(setNumberId)}>
          <option value="">All numbers</option>
          {db.numbers.map(n => <option key={n.id} value={n.id}>{n.number}</option>)}
        </select>
        <select value={status} onChange={filter(setStatus)}>
          <option value="">All statuses</option>
          {CALL_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <LogsTable logs={logs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)} onSelect={setSelected} />
      <Pagination page={page} pageSize={PAGE_SIZE} total={logs.length} onChange={setPage} />
      <p className="muted small">Click a call to see how it was routed.</p>
      {selected && <CallDetails log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
