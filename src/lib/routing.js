// Decides where an incoming call goes. Pure function: used by the live
// simulator, the seed data generator and the "Test call" tool.
import { digits, sameNumber, startOfDay } from '../utils';

export function isWithinHours(hours, at) {
  if (!hours?.enabled) return true;
  const d = new Date(at);
  if (!hours.days.includes(d.getDay())) return false;
  const toMin = s => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  const mins = d.getHours() * 60 + d.getMinutes();
  return mins >= toMin(hours.start) && mins < toMin(hours.end);
}

export function destinationLoad(db, live, destId, at = Date.now()) {
  const dayStart = startOfDay(at);
  return {
    today: db.logs.filter(l => l.destinationId === destId && l.status === 'Answered' && l.time >= dayStart && l.time <= at).length,
    active: live.filter(c => c.route.destination?.id === destId).length,
  };
}

const TOOK_CALL = new Set(['Answered', 'Missed', 'Busy']);

/** Calls a campaign has taken today (forwarded, whatever the outcome) plus calls in progress. */
export function campaignToday(db, live, campaignId, at = Date.now()) {
  const dayStart = startOfDay(at);
  return db.logs.filter(l => l.campaignId === campaignId && TOOK_CALL.has(l.status) && l.time >= dayStart && l.time <= at).length
    + live.filter(c => c.route.campaign?.id === campaignId).length;
}

/** Calls a routing-plan path has taken today, plus calls in progress on it. */
export function pathToday(db, live, pathId, at = Date.now()) {
  const dayStart = startOfDay(at);
  return db.logs.filter(l => l.pathId === pathId && TOOK_CALL.has(l.status) && l.time >= dayStart && l.time <= at).length
    + live.filter(c => c.route.path?.id === pathId).length;
}

function choose(pool, strategy, trace) {
  if (strategy === 'Round robin') {
    const total = pool.reduce((a, t) => a + (Number(t.weight) || 1), 0);
    let r = Math.random() * total;
    const chosen = pool.find(t => (r -= Number(t.weight) || 1) < 0) || pool[0];
    trace.push(`Round robin (weighted) → ${chosen.dest.name}`);
    return chosen;
  }
  if (strategy === 'Simultaneous') {
    trace.push(`Ringing ${pool.map(t => t.dest.name).join(', ')} at once`);
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    trace.push(`${chosen.dest.name} picked up first`);
    return chosen;
  }
  trace.push(`Forwarding → ${pool[0].dest.name} (${pool[0].dest.target})`);
  return pool[0];
}

/** Why a path doesn't apply to this call, or null when it does. */
export function pathMismatch(path, from, at) {
  if (path.hours?.enabled && !isWithinHours(path.hours, at)) return `outside ${path.hours.start}–${path.hours.end}`;
  if (path.prefix && !digits(from).startsWith(digits(path.prefix))) return `caller doesn't start with ${path.prefix}`;
  return null;
}

function isAvailable(db, live, dest, at, trace) {
  if (!dest) return false;
  if (dest.status !== 'Active') {
    trace.push(`${dest.name} is paused — skipped`);
    return false;
  }
  const load = destinationLoad(db, live, dest.id, at);
  if (dest.dailyCap && load.today >= dest.dailyCap) {
    trace.push(`${dest.name} reached its daily cap (${dest.dailyCap}) — skipped`);
    return false;
  }
  if (dest.concurrency && load.active >= dest.concurrency) {
    trace.push(`${dest.name} has all ${dest.concurrency} lines busy — skipped`);
    return false;
  }
  return true;
}

/**
 * Order: block list → number → campaign (status, daily cap) → the campaign's Live routing plan,
 * or else the number's forwarding rule.
 * @returns {{status: 'Routed'|'Blocked'|'Failed'|'Missed', trace: string[], campaign, rule?, plan?, path?, destination?}}
 */
export function routeCall(db, live, { from, numberId, at = Date.now(), key = null }) {
  const trace = [`Incoming call from ${from}`];
  const number = db.numbers.find(n => n.id === numberId);
  // Known up front so blocked and rejected calls still count toward their campaign's reports.
  const campaign = (number?.campaignId && db.campaigns?.find(c => c.id === number.campaignId)) || null;
  const done = (status, extra = {}) => ({ status, trace, campaign, ...extra });
  const destById = id => db.destinations.find(d => d.id === id);

  const blocked = db.blocked.find(b => sameNumber(b.number, from));
  if (blocked) {
    trace.push(`Caller is on the block list (${blocked.reason || 'no reason'}) — rejected`);
    return done('Blocked');
  }

  if (!number) {
    trace.push('Dialed number not found — dropped');
    return done('Failed');
  }
  trace.push(`Dialed ${number.number}${number.label ? ` (${number.label})` : ''}`);
  if (number.status !== 'Active') {
    trace.push('Number is suspended — rejected');
    return done('Failed');
  }

  if (campaign) {
    trace.push(`Campaign "${campaign.name}"`);
    if (campaign.status !== 'Active') {
      trace.push(`Campaign is ${campaign.status.toLowerCase()} — rejected`);
      return done('Failed');
    }
    if (campaign.dailyCap && campaignToday(db, live, campaign.id, at) >= campaign.dailyCap) {
      trace.push(`Campaign reached its daily cap (${campaign.dailyCap}) — rejected`);
      return done('Failed', { capHit: true });
    }
  }

  const plan = campaign && db.plans?.find(p => p.campaignId === campaign.id && p.status === 'Live');
  if (plan) {
    trace.push(`Routing plan "${plan.name}" (overrides the number's forwarding rule)`);
    for (const path of plan.paths) {
      const why = pathMismatch(path, from, at);
      if (why) {
        trace.push(`Path "${path.name}": ${why} — skipped`);
        continue;
      }
      if (path.dailyCap && pathToday(db, live, path.id, at) >= path.dailyCap) {
        trace.push(`Path "${path.name}" reached its daily cap (${path.dailyCap}) — skipped`);
        continue;
      }
      trace.push(`Path "${path.name}" matched`);
      const pool = path.targets
        .map(t => ({ ...t, dest: destById(t.destinationId) }))
        .filter(t => isAvailable(db, live, t.dest, at, trace));
      if (!pool.length) {
        trace.push('No destination free on this path — trying the next path');
        continue;
      }
      const chosen = choose(pool, path.strategy, trace);
      return done('Routed', { plan, path, destination: chosen.dest, ringTimeout: path.ringTimeout });
    }
    trace.push('No path could take the call — call missed');
    return done('Missed', { plan });
  }

  const rule = db.rules.find(r => r.numberId === numberId && r.enabled);
  if (!rule) {
    trace.push('No active forwarding rule on this number — dropped');
    return done('Failed');
  }
  trace.push(`Matched rule "${rule.name}"`);

  if (!isWithinHours(rule.hours, at)) {
    trace.push(`Outside business hours (${rule.hours.start}–${rule.hours.end})`);
    const d = destById(rule.hours.afterHoursDestinationId);
    if (d && isAvailable(db, live, d, at, trace)) {
      trace.push(`After-hours destination → ${d.name}`);
      return done('Routed', { rule, destination: d });
    }
    trace.push('No after-hours destination available — sent to voicemail');
    return done('Missed', { rule });
  }

  let targets = rule.targets;
  let strategy = rule.strategy;
  if (rule.action === 'IVR') {
    const ivr = db.ivrs.find(i => i.id === rule.ivrId);
    if (!ivr) {
      trace.push('IVR menu missing — dropped');
      return done('Failed', { rule });
    }
    trace.push(`Played IVR menu "${ivr.name}"`);
    const opt = ivr.options.find(o => o.key === key);
    let destId;
    if (opt) {
      trace.push(`Caller pressed ${key} (${opt.label})`);
      destId = opt.destinationId;
    } else {
      trace.push(key ? `Caller pressed ${key} — not a menu option` : 'Caller pressed nothing');
      destId = ivr.fallbackDestinationId;
      if (destId) trace.push(`Using fallback destination`);
    }
    targets = destId ? [{ destinationId: destId, weight: 1 }] : [];
    strategy = 'Priority';
  }

  const pool = targets
    .map(t => ({ ...t, dest: destById(t.destinationId) }))
    .filter(t => isAvailable(db, live, t.dest, at, trace));

  if (!pool.length) {
    trace.push('No destination available — call missed');
    return done('Missed', { rule });
  }

  const chosen = choose(pool, strategy, trace);
  return done('Routed', { rule, destination: chosen.dest, ringTimeout: rule.ringTimeout });
}
