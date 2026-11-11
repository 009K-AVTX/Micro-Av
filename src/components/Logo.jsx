// Micro AV mark: an "M" whose centre point is a routing node, on the red tile.
// Keep in sync with public/favicon.svg.
export function LogoMark({ size = 34 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="3" style={{ fill: 'var(--accent)' }} />
      <path d="M8.5 24V8l7.5 10L23.5 8v16" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinejoin="miter" strokeMiterlimit="10" />
      <circle cx="16" cy="18" r="4.2" style={{ fill: 'var(--accent)' }} />
      <circle cx="16" cy="18" r="2.4" fill="#fff" />
    </svg>
  );
}

export default function Logo({ size }) {
  return (
    <div className="brand" aria-label="Micro AV">
      <LogoMark size={size} />
      <span>Micro <span className="accent">AV</span></span>
    </div>
  );
}
