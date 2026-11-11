export const DAY = 86400000;

export const uid = () => Math.random().toString(36).slice(2, 10);
export const rand = n => Math.floor(Math.random() * n);
export const pick = arr => arr[rand(arr.length)];
export const digits = s => String(s ?? '').replace(/\D/g, '');
export const sameNumber = (a, b) => !!digits(a) && digits(a) === digits(b);

export const startOfDay = t => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
export const startOfMonth = t => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
};

export const money = n => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
export const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

export const fmtDur = s => (s ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : '—');
export const fmtClock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export const fmtTime = t =>
  new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fmtDate = t => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
export const fmtAgo = t => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const STRATEGIES = ['Priority', 'Round robin', 'Simultaneous'];
export const STRATEGY_HELP = {
  Priority: 'Try destinations in order; move to the next if one is paused, busy or capped.',
  'Round robin': 'Spread calls across destinations using the weights.',
  Simultaneous: 'Ring every available destination at once; first to answer wins.',
};
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const CALL_STATUSES = ['Answered', 'Missed', 'Busy', 'Blocked', 'Failed'];
export const TIMEZONES = ['UTC', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Africa/Nairobi', 'Asia/Dubai'];

export const RANGES = {
  today: { label: 'Today', from: () => startOfDay(Date.now()) },
  '7d': { label: 'Last 7 days', from: () => startOfDay(Date.now()) - 6 * DAY },
  '30d': { label: 'Last 30 days', from: () => startOfDay(Date.now()) - 29 * DAY },
  all: { label: 'All time', from: () => 0 },
};

export function downloadCsv(filename, rows) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
