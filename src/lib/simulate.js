// Demo call traffic: creates live calls, turns finished calls into log entries.
import { routeCall } from './routing';
import { money, pick, rand, startOfDay, uid } from '../utils';

export const MAX_LOGS = 2000;

export function randomCaller(db) {
  if (db.blocked.length && Math.random() < 0.05) return pick(db.blocked).number;
  return `+1 (${200 + rand(700)}) 555-${String(rand(10000)).padStart(4, '0')}`;
}

/** Mostly active numbers; suspended ones only get the odd stray call. */
export function pickNumber(db) {
  const active = db.numbers.filter(n => n.status === 'Active');
  return active.length && Math.random() < 0.97 ? pick(active) : pick(db.numbers);
}

export function pickOutcome() {
  const r = Math.random();
  return r < 0.8 ? 'Answered' : r < 0.9 ? 'Busy' : 'Missed';
}

const OUTCOME_LINE = {
  Answered: d => `Answered — talked ${Math.floor(d / 60)}m ${d % 60}s`,
  Busy: () => 'Destination was busy',
  Missed: () => 'Nobody answered',
  Blocked: () => 'Call rejected',
  Failed: () => 'Call failed',
};

/** The rule or routing-plan path that handled a call. */
export const routeLabel = route =>
  route.rule?.name ?? (route.plan ? `${route.plan.name}${route.path ? ` › ${route.path.name}` : ''}` : '—');

export function makeLog({ time, from, number, route, status, duration, rate }) {
  return {
    id: uid(),
    time,
    from,
    numberId: number?.id ?? null,
    to: number?.number ?? '—',
    campaignId: route.campaign?.id ?? null,
    campaign: route.campaign?.name ?? '—',
    planId: route.plan?.id ?? null,
    pathId: route.path?.id ?? null,
    ruleName: routeLabel(route),
    destinationId: route.destination?.id ?? null,
    destination: route.destination?.name ?? '—',
    duration,
    status,
    cost: +(Math.ceil(duration / 60) * rate).toFixed(2),
    trace: [...route.trace, OUTCOME_LINE[status](duration)],
    ...(route.capHit && { capHit: true }),
  };
}

/** Returns { call } for a call that starts ringing, or { log } if it ended immediately. */
export function spawnCall(db, live, now, overrides = {}) {
  const number = overrides.numberId ? db.numbers.find(n => n.id === overrides.numberId) : pickNumber(db);
  const from = overrides.from || randomCaller(db);
  const route = routeCall(db, live, { from, numberId: number?.id, at: now, key: String(1 + rand(4)) });
  const rate = db.billing.ratePerMin;

  if (route.status !== 'Routed') {
    return { log: makeLog({ time: now, from, number, route, status: route.status, duration: 0, rate }) };
  }
  const outcome = pickOutcome();
  const answerAt = now + (3 + rand(5)) * 1000;
  const endsAt =
    outcome === 'Answered' ? answerAt + (15 + rand(90)) * 1000
      : outcome === 'Busy' ? now + 2000
        : now + Math.min(route.ringTimeout || 20, 15) * 1000;
  return { call: { id: uid(), from, number, route, outcome, startedAt: now, answerAt, endsAt } };
}

export const callState = (call, now) =>
  call.outcome === 'Answered' && now >= call.answerAt ? 'Connected' : 'Ringing';

export function finishCall(call, now, rate) {
  const connected = callState(call, now) === 'Connected';
  const status = connected ? 'Answered' : call.outcome === 'Answered' ? 'Missed' : call.outcome;
  const duration = connected ? Math.max(1, Math.round((Math.min(now, call.endsAt) - call.answerAt) / 1000)) : 0;
  return makeLog({ time: call.startedAt, from: call.from, number: call.number, route: call.route, status, duration, rate });
}

/** Adds new log entries to the db: charges the balance and raises notifications. */
export function applyLogs(db, logs) {
  const cost = logs.reduce((a, l) => a + l.cost, 0);
  const balance = +(db.billing.balance - cost).toFixed(2);
  const notes = [];
  if (db.settings.notifyMissed) {
    logs.filter(l => l.status === 'Missed').forEach(l =>
      notes.push({ id: uid(), time: l.time, title: 'Missed call', body: `${l.from} → ${l.to}`, link: '/logs', read: false }));
  }
  const dayStart = startOfDay(Date.now());
  logs.filter(l => l.capHit).forEach(l => {
    const key = `cap-${l.campaignId}-${dayStart}`;
    if (db.notifications.some(n => n.key === key) || notes.some(n => n.key === key)) return;
    notes.push({ id: uid(), key, time: l.time, title: 'Campaign cap reached', body: `${l.campaign} stopped taking calls for today`, link: `/campaigns/${l.campaignId}`, read: false });
  });
  if (db.billing.balance >= db.settings.lowBalance && balance < db.settings.lowBalance) {
    notes.push({ id: uid(), time: Date.now(), title: 'Low balance', body: `Balance dropped to ${money(balance)}`, link: '/billing', read: false });
  }
  return {
    ...db,
    logs: [...[...logs].sort((a, b) => b.time - a.time), ...db.logs].slice(0, MAX_LOGS),
    billing: { ...db.billing, balance },
    notifications: [...notes, ...db.notifications].slice(0, 50),
  };
}
