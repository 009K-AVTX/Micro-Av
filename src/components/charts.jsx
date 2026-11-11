// Report charts: rounded columns with one highlighted bar, stacked columns joined by
// flow ribbons, rounded-square scatter, and a gapped donut. Plain SVG, no chart library.
import { useId, useLayoutEffect, useRef, useState } from 'react';

// Validated set for the app's dark surface (#0e0f12): all pairs pass CVD + normal-vision checks.
// Red is the app accent; blue and amber are the two partners that stay distinguishable from it.
export const SERIES_COLORS = { red: '#d92632', blue: '#3987e5', amber: '#c98500' };
const HI = { // lighter top stop for the gradient on emphasised marks
  '#3987e5': '#5f9ff0', '#c98500': '#e0a12a', '#d92632': '#ef4b55',
};
const R = 3; // mark corner radius — matches the app's sharp 2–3px corners

const useGradId = () => `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

function useWidth(initial = 520) {
  const ref = useRef(null);
  const [w, setW] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function useTip(wrapRef) {
  const [tip, setTip] = useState(null);
  const show = content => e => {
    const r = wrapRef.current.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, content });
  };
  return { tip, show, hide: () => setTip(null) };
}

function Tip({ tip }) {
  if (!tip) return null;
  return <div className="viz-tip" style={{ left: tip.x, top: tip.y }}>{tip.content}</div>;
}

function TipRows({ title, rows }) {
  return (
    <>
      <div className="viz-tip-title">{title}</div>
      {rows.map(([color, label, value]) => (
        <div className="viz-tip-row" key={label}>
          {color && <i style={{ background: color }} />}<span>{label}</span><b>{value}</b>
        </div>
      ))}
    </>
  );
}

// Inverted pill used to call out the emphasised value (light pill on the dark card).
function Pill({ x, y, text, anchor = 'middle' }) {
  const w = String(text).length * 7.4 + 18;
  const left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return (
    <g>
      <rect x={left} y={y - 12} width={w} height={24} rx={2} className="viz-pill" />
      <text x={left + w / 2} y={y + 4.5} textAnchor="middle" className="viz-pill-text">{text}</text>
    </g>
  );
}

/* ---------- Card chrome ---------- */

export function ChartCard({ icon, title, meta, children }) {
  return (
    <div className="viz-card">
      <div className="viz-head">
        <span className="viz-icon" aria-hidden="true">{icon}</span>
        <h3>{title}</h3>
        {meta && <span className="viz-meta">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

export function Hero({ label, value }) {
  return (
    <div className="viz-hero">
      <div className="viz-hero-label">{label}</div>
      <div className="viz-hero-value">{value}</div>
    </div>
  );
}

export function Legend({ items, vertical }) {
  return (
    <div className={`viz-legend ${vertical ? 'vertical' : ''}`}>
      {items.map(i => (
        <span key={i.label}><i style={{ background: i.color }} />{i.label}{i.value != null && <b>{i.value}</b>}</span>
      ))}
    </div>
  );
}

export const Icons = {
  clock: <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M10 5.5V10l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  layers: <svg viewBox="0 0 20 20"><path d="M10 3 2.5 7 10 11l7.5-4z" fill="currentColor" opacity=".9" /><path d="m2.5 10.5 7.5 4 7.5-4M2.5 13.5l7.5 4 7.5-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>,
  target: <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="10" cy="10" r="3.5" fill="currentColor" /></svg>,
  pie: <svg viewBox="0 0 20 20"><path d="M10 2.5A7.5 7.5 0 1 0 17.5 10H10z" fill="currentColor" opacity=".55" /><path d="M11.5 1.5v7h7a7 7 0 0 0-7-7z" fill="currentColor" /></svg>,
};

/* ---------- 1. Column chart, one bar emphasised ---------- */

export function ColumnChart({ data, highlight, color = '#d92632', height = 210, format = v => v }) {
  const [ref, w] = useWidth();
  const { tip, show, hide } = useTip(ref);
  const gid = useGradId();
  const top = 28, bottom = 34;
  const gap = 10;
  const n = data.length;
  const bw = Math.max(8, (w - gap * (n - 1)) / n);
  const max = Math.max(1, ...data.map(d => d.value));
  const plotH = height - top - bottom;

  return (
    <div className="viz-wrap" ref={ref} onMouseLeave={hide}>
      <svg width={w} height={height} role="img" aria-label={data.map(d => `${d.label}: ${format(d.value)}`).join(', ')}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={HI[color] || color} />
            <stop offset="1" stopColor={color} />
          </linearGradient>
        </defs>
        {data.map((d, i) => {
          const h = Math.max(d.value ? 6 : 0, (d.value / max) * plotH);
          const x = i * (bw + gap);
          const y = top + plotH - h;
          const on = i === highlight;
          return (
            <g key={d.label} onMouseMove={show(<TipRows title={d.label} rows={[[color, 'Calls', d.value], [null, 'Share', format(d.value)]]} />)}>
              <rect x={x} y={top} width={bw} height={plotH + 4} fill="transparent" />
              <rect x={x} y={y} width={bw} height={h} rx={R}
                fill={on ? `url(#${gid})` : color} fillOpacity={on ? 1 : 0.2} />
              <text x={x + bw / 2} y={y - 9} textAnchor="middle" className="viz-value">{format(d.value)}</text>
              {on
                ? <Pill x={x + bw / 2} y={height - 14} text={d.label} />
                : <text x={x + bw / 2} y={height - 10} textAnchor="middle" className="viz-axis">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

/* ---------- 2. Stacked columns joined by flow ribbons ---------- */

export function FlowStack({ periods, series, height = 250 }) {
  const [ref, w] = useWidth();
  const { tip, show, hide } = useTip(ref);
  const gid = useGradId();
  const top = 34, bottom = 36, segGap = 3;
  const n = periods.length;
  const cw = Math.min(92, Math.max(36, w / (n * 2.4)));
  const step = n > 1 ? (w - cw) / (n - 1) : 0;
  const max = Math.max(1, ...periods.map(p => p.total));
  const plotH = height - top - bottom;

  // Segment boxes per period, bottom-up in series order.
  const cols = periods.map((p, i) => {
    const x = i * step;
    let y = top + plotH;
    const segs = series.map(s => {
      const v = p.parts[s.key] || 0;
      const h = (v / max) * plotH;
      const seg = { key: s.key, color: s.color, v, x, y0: y - h, y1: y };
      y -= h;
      return seg;
    });
    return { ...p, x, segs, topY: y };
  });

  return (
    <div className="viz-wrap" ref={ref} onMouseLeave={hide}>
      <svg width={w} height={height} role="img" aria-label={periods.map(p => `${p.label}: ${p.total} calls`).join(', ')}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={HI[s.color] || s.color} />
              <stop offset="1" stopColor={s.color} />
            </linearGradient>
          ))}
        </defs>

        {/* ribbons */}
        {cols.slice(0, -1).map((c, i) => {
          const d = cols[i + 1];
          return c.segs.map((s, k) => {
            const t = d.segs[k];
            if (!s.v && !t.v) return null;
            const pts = [
              [c.x + cw, s.y0 + segGap / 2], [d.x, t.y0 + segGap / 2],
              [d.x, t.y1 - segGap / 2], [c.x + cw, s.y1 - segGap / 2],
            ].map(p => p.join(',')).join(' ');
            return <polygon key={`${i}-${s.key}`} points={pts} fill={s.color} fillOpacity={0.13} />;
          });
        })}

        {/* columns */}
        {cols.map((c, i) => {
          const last = i === cols.length - 1;
          return (
            <g key={c.label} onMouseMove={show(
              <TipRows title={c.label} rows={[...series.map(s => [s.color, s.label, c.parts[s.key] || 0]), [null, 'Total', c.total]]} />,
            )}>
              <rect x={c.x} y={top} width={cw} height={plotH} fill="transparent" />
              {c.segs.map(s => {
                const h = s.y1 - s.y0 - segGap;
                if (h <= 0.5) return null;
                return <rect key={s.key} x={c.x} y={s.y0 + segGap / 2} width={cw} height={h} rx={Math.min(R, h / 2)} fill={`url(#${gid}-${s.key})`} />;
              })}
              <text x={c.x + cw / 2} y={c.topY - 10} textAnchor="middle" className="viz-value">{c.label}</text>
              {last
                ? <Pill x={c.x + cw / 2} y={height - 14} text={c.total} />
                : <text x={c.x + cw / 2} y={height - 10} textAnchor="middle" className="viz-axis">{c.total}</text>}
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

/* ---------- 3. Ranked performance rows ---------- */
// One row per item, best first. Main bar = rate on a full 0–100% scale (no truncated baseline),
// dashed marker = overall average, thin grey bar = share of volume.
export function RankedBars({ rows, color = SERIES_COLORS.blue, minShare = 0.05, rateLabel = 'Answer rate', countLabel = 'calls' }) {
  const ref = useRef(null);
  const { tip, show, hide } = useTip(ref);
  const [hover, setHover] = useState(null);
  const total = rows.reduce((a, r) => a + r.calls, 0);
  const answered = rows.reduce((a, r) => a + r.answered, 0);
  const avg = total ? answered / total : 0;
  const maxCalls = Math.max(1, ...rows.map(r => r.calls));
  const pc = v => `${Math.round(v * 100)}%`;
  // Items with very few calls have unreliable rates: rank them last and never call them "best".
  const enough = r => r.calls >= Math.max(3, total * minShare);
  const ranked = rows
    .map(r => ({ ...r, rate: r.calls ? r.answered / r.calls : 0, ok: enough(r) }))
    .sort((a, b) => (b.ok - a.ok) || (b.rate - a.rate) || (b.calls - a.calls));
  const best = ranked[0]?.ok ? ranked[0] : null;

  return (
    <div className="rank" ref={ref} onMouseLeave={() => { hide(); setHover(null); }}>
      <div className="rank-head">
        <span>{rateLabel}</span>
        <span className="rank-avg-key"><i />Average {pc(avg)}</span>
      </div>
      {ranked.map((r, i) => {
        const avgTalk = r.answered ? Math.round(r.seconds / r.answered) : 0;
        const delta = Math.round((r.rate - avg) * 100);
        return (
          <div key={r.name} className={`rank-row ${r === best ? 'best' : ''} ${hover === i ? 'on' : ''} ${r.ok ? '' : 'thin'}`}
            onMouseMove={e => { setHover(i); show(<TipRows title={r.name} rows={[
              [color, rateLabel, pc(r.rate)],
              [null, 'vs average', `${delta > 0 ? '+' : ''}${delta} pts`],
              [null, 'Calls', `${r.calls} (${pc(r.calls / (total || 1))} of all)`],
              [null, 'Answered', r.answered],
              [null, 'Minutes talked', Math.round(r.seconds / 60)],
              [null, 'Avg talk time', `${Math.floor(avgTalk / 60)}m ${String(avgTalk % 60).padStart(2, '0')}s`],
            ]} />)(e); }}>
            <span className="rank-n">{i + 1}</span>
            <div className="rank-main">
              <div className="rank-label">
                <strong>{r.name}</strong>
                {r === best && <span className="rank-tag">Best</span>}
                {!r.ok && <span className="rank-note">few {countLabel}</span>}
              </div>
              <div className="rank-track" role="img" aria-label={`${r.name}: ${pc(r.rate)} ${rateLabel.toLowerCase()}, ${r.calls} ${countLabel}`}>
                <span className="rank-fill" style={{ width: `${r.rate * 100}%`, background: color }} />
                <span className="rank-avg" style={{ left: `${avg * 100}%` }} />
              </div>
              <div className="rank-vol"><span style={{ width: `${(r.calls / maxCalls) * 100}%` }} /></div>
            </div>
            <div className="rank-vals">
              <b>{pc(r.rate)}</b>
              <span>{r.calls} {countLabel} · {Math.round(r.seconds / 60)} min</span>
            </div>
          </div>
        );
      })}
      <Tip tip={tip} />
    </div>
  );
}

function arcPath(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
}

export function Donut({ slices, size = 220, format = v => v }) {
  const wrapRef = useRef(null);
  const { tip, show, hide } = useTip(wrapRef);
  const gid = useGradId();
  const total = slices.reduce((a, s) => a + s.value, 0);
  const cx = size / 2, cy = size / 2, r1 = size / 2 - 6, r0 = r1 * 0.58;
  const pad = slices.filter(s => s.value).length > 1 ? 0.035 : 0;
  const biggest = slices.reduce((b, s, i) => (s.value > slices[b].value ? i : b), 0);
  let a = 0;

  return (
    <div className="viz-wrap viz-donut" ref={wrapRef} onMouseLeave={hide} style={{ width: size }}>
      <svg width={size} height={size} role="img" aria-label={slices.map(s => `${s.label}: ${s.value}`).join(', ')}>
        <defs>
          {slices.map((s, i) => (
            <linearGradient key={i} id={`${gid}-${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={HI[s.color] || s.color} />
              <stop offset="1" stopColor={s.color} />
            </linearGradient>
          ))}
        </defs>
        {total === 0 && <circle cx={cx} cy={cy} r={(r0 + r1) / 2} fill="none" stroke="var(--border-strong)" strokeWidth={r1 - r0} />}
        {slices.map((s, i) => {
          if (!s.value) return null;
          const span = (s.value / total) * Math.PI * 2;
          // A lone 100% slice would start and end at the same point; stop just short of a full turn.
          const a0 = a + pad / 2, a1 = Math.min(a + span - pad / 2, a0 + Math.PI * 2 - 0.002);
          const mid = a + span / 2;
          a += span;
          const on = i === biggest;
          const lr = (r0 + r1) / 2;
          const lx = cx + lr * Math.sin(mid), ly = cy - lr * Math.cos(mid);
          return (
            <g key={s.label} onMouseMove={show(<TipRows title={s.label} rows={[[s.color, 'Calls', s.value], [null, 'Share', format(s.value / total)]]} />)}>
              <path d={arcPath(cx, cy, r0, r1, a0, Math.max(a0 + 0.001, a1))}
                fill={on ? `url(#${gid}-${i})` : s.color} fillOpacity={on ? 1 : 0.4}
                stroke="var(--surface)" strokeWidth="2" />
              {span > 0.35 && (on
                ? <Pill x={lx} y={ly} text={s.value} />
                : <text x={lx} y={ly + 4} textAnchor="middle" className="viz-in">{s.value}</text>)}
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

/* ---------- 5. Stacked columns with a value axis (dashboard trend) ---------- */

const compact = v => (v >= 10000 ? `${Math.round(v / 1000)}K` : v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(v));

// Round tick steps (1 / 2 / 2.5 / 5 × 10^k) so the axis reads 0 · 10 · 20 · 30, never 0 · 13 · 27.
function niceTicks(max, target = 3) {
  const raw = Math.max(1, max / target);
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * p).find(v => v >= raw);
  const n = Math.max(1, Math.ceil(max / step));
  return Array.from({ length: n + 1 }, (_, i) => i * step);
}

function topRoundedRect(x, y, w, h, r) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export function StackedColumns({ data, series, highlight, height = 230 }) {
  const [ref, w] = useWidth();
  const { tip, show, hide } = useTip(ref);
  const [hover, setHover] = useState(null);
  const left = 34, top = 26, bottom = 30, gap = 2;
  const plotW = Math.max(60, w - left);
  const plotH = height - top - bottom;
  const n = data.length;
  const slot = plotW / n;
  const bw = Math.min(28, slot * 0.62);
  const totals = data.map(d => series.reduce((a, s) => a + (d[s.key] || 0), 0));
  const ticks = niceTicks(Math.max(1, ...totals));
  const yMax = ticks[ticks.length - 1];
  const sy = v => top + plotH - (v / yMax) * plotH;
  const peak = totals.indexOf(Math.max(...totals));
  const everyOther = slot < 46; // thin out x labels when crowded

  return (
    <div className="viz-wrap" ref={ref} onMouseLeave={() => { hide(); setHover(null); }}>
      <svg width={w} height={height} role="img"
        aria-label={data.map((d, i) => `${d.label}: ${totals[i]} calls`).join(', ')}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={left} x2={w} y1={sy(t)} y2={sy(t)} className={t === 0 ? 'viz-base' : 'viz-gridline'} />
            <text x={left - 8} y={sy(t) + 4} textAnchor="end" className="viz-axis">{compact(Math.round(t))}</text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = left + slot * i + slot / 2;
          const x = cx - bw / 2;
          const on = i === highlight;
          const total = totals[i];
          // stack bottom-up with a 2px surface gap between segments
          let y = sy(0);
          const segs = series.map(s => {
            const v = d[s.key] || 0;
            const h = (v / yMax) * plotH;
            const seg = { ...s, v, y: y - h, h };
            y -= h;
            return seg;
          }).filter(s => s.h > 0);
          const lastIdx = segs.length - 1;
          const showTotal = total > 0 && (on || i === peak);
          return (
            <g key={d.label}
              onMouseEnter={() => setHover(i)}
              onMouseMove={show(
                <TipRows title={d.label} rows={[
                  ...series.map(s => [s.color, s.label, d[s.key] || 0]),
                  [null, 'Total', total],
                  [null, 'Answer rate', total ? `${Math.round(((d.answered || 0) / total) * 100)}%` : '—'],
                ]} />,
              )}>
              <rect x={left + slot * i} y={top - 8} width={slot} height={plotH + 8}
                className={hover === i ? 'viz-band on' : 'viz-band'} />
              {segs.map((s, k) => {
                const h = Math.max(0, s.h - (k < lastIdx ? gap : 0));
                if (h < 0.5) return null;
                return k === lastIdx
                  ? <path key={s.key} d={topRoundedRect(x, s.y, bw, h, R)} fill={s.color} fillOpacity={on || hover === i ? 1 : 0.85} />
                  : <rect key={s.key} x={x} y={s.y + gap} width={bw} height={h} fill={s.color} fillOpacity={on || hover === i ? 1 : 0.85} />;
              })}
              {showTotal && <text x={cx} y={sy(total) - 8} textAnchor="middle" className="viz-value">{total}</text>}
              {on
                ? <Pill x={cx} y={height - 12} text={d.label} />
                : (!everyOther || (n - 1 - i) % 2 === 0) &&
                  <text x={cx} y={height - 8} textAnchor="middle" className="viz-axis">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}
