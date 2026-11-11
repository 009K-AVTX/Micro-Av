import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import Logo from './Logo';
import { fmtAgo, money } from '../utils';

export const NAV = [
  {
    label: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard' },
      { path: '/live', label: 'Live Monitor', live: true },
      { path: '/reports', label: 'Reports' },
    ],
  },
  {
    label: 'Forwarding',
    items: [
      { path: '/campaigns', label: 'Campaigns' },
      { path: '/routing', label: 'Routing' },
      { path: '/numbers', label: 'Phone Numbers' },
      { path: '/destinations', label: 'Destinations' },
      { path: '/forwarding', label: 'Forwarding Rules' },
      { path: '/ivr', label: 'IVR Menus' },
    ],
  },
  {
    label: 'Protection',
    items: [{ path: '/blocked', label: 'Blocked Numbers' }],
  },
  {
    label: 'Insights',
    items: [{ path: '/logs', label: 'Call Logs' }],
  },
  {
    label: 'Account',
    items: [
      { path: '/billing', label: 'Billing' },
      { path: '/settings', label: 'Settings' },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap(g => g.items);

function Notifications() {
  const { db, update } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unread = db.notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const close = e => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const markAll = () => update(d => ({ ...d, notifications: d.notifications.map(n => ({ ...n, read: true })) }));
  const openItem = n => {
    update(d => ({ ...d, notifications: d.notifications.map(x => (x.id === n.id ? { ...x, read: true } : x)) }));
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="bell" ref={ref}>
      <button className="btn btn-ghost" aria-label="Notifications" onClick={() => setOpen(o => !o)}>
        🔔{unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="dropdown">
          <div className="dropdown-head">
            <strong>Notifications</strong>
            {unread > 0 && <button className="btn btn-sm btn-ghost" onClick={markAll}>Mark all read</button>}
          </div>
          {db.notifications.length === 0 && <div className="empty">You're all caught up.</div>}
          {db.notifications.map(n => (
            <div key={n.id} className={`dropdown-item ${n.read ? '' : 'unread'}`} onClick={() => openItem(n)}>
              <div className="inline-between">
                <strong>{n.title}</strong>
                <span className="muted small">{fmtAgo(n.time)}</span>
              </div>
              <div className="muted small">{n.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout, live, db } = useStore();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const title = ALL_ITEMS.find(n => pathname.startsWith(n.path))?.label || 'Dashboard';
  const lowBalance = db.billing.balance < db.settings.lowBalance;

  return (
    <div className="layout">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <Logo />
        <nav>
          {NAV.map(group => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map(n => (
                <NavLink key={n.path} to={n.path} onClick={() => setMenuOpen(false)}>
                  {n.label}
                  {n.live && live.length > 0 && <span className="nav-badge">{live.length}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost menu-btn" aria-label="Menu" onClick={() => setMenuOpen(o => !o)}>☰</button>
          <h1>{title}</h1>
          <div className="topbar-right">
            <Link to="/billing" className={`balance-chip ${lowBalance ? 'low' : ''}`} title="Account balance">
              {money(db.billing.balance)}
            </Link>
            <Notifications />
            <span className="muted small user-email">{user}</span>
            <button className="btn btn-ghost" onClick={logout}>Log out</button>
          </div>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
