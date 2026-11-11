// Shared call statistics for the Dashboard, Reports and campaign pages.
import { DAY, fmtDate } from '../utils';

/** Adds one call to a row's answered / missed / blocked buckets. */
export function bucketStatus(row, status) {
  if (status === 'Answered') row.answered++;
  else if (status === 'Missed' || status === 'Busy') row.missed++;
  else row.blocked++;
}

/** Calls per day for the last 14 days (oldest first) plus totals for this and the previous 14 days. */
export function dailyTrend(logs, today) {
  const first = today - 13 * DAY;
  const days = Array.from({ length: 14 }, (_, i) => {
    const start = first + i * DAY;
    return { start, label: i === 13 ? 'Today' : fmtDate(start), answered: 0, missed: 0, blocked: 0 };
  });
  const cur = { calls: 0, answered: 0, missed: 0, blocked: 0, seconds: 0, cost: 0 };
  const prev = { calls: 0, answered: 0, missed: 0, blocked: 0, seconds: 0, cost: 0 };
  logs.forEach(l => {
    let into;
    if (l.time >= first) {
      const row = days[Math.floor((l.time - first) / DAY)];
      if (!row) return;
      bucketStatus(row, l.status);
      into = cur;
    } else if (l.time >= first - 14 * DAY) into = prev;
    else return;
    into.calls++;
    into.seconds += l.duration;
    into.cost += l.cost;
    bucketStatus(into, l.status);
  });
  const totals = days.map(d => d.answered + d.missed + d.blocked);
  const busiest = totals.indexOf(Math.max(...totals));
  return { days, cur, prev, busiest, busiestTotal: totals[busiest] };
}
