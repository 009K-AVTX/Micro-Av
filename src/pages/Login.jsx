import { useState } from 'react';
import { useStore } from '../store';
import Logo from '../components/Logo';

// Local demo account — no backend, credentials are checked in the browser.
export const LOCAL_ACCOUNT = { email: 'admin@microav.local', password: 'admin123' };

const FEATURES = [
  ['Campaigns', 'Group numbers and set daily caps.'],
  ['Routing', 'Time, caller and failover rules.'],
  ['Live & reports', 'See every call as it happens.'],
];

export default function Login() {
  const { login } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  const submit = e => {
    e.preventDefault();
    if (email.trim().toLowerCase() === LOCAL_ACCOUNT.email && password === LOCAL_ACCOUNT.password) {
      login(LOCAL_ACCOUNT.email);
    } else {
      setError('Invalid email or password.');
    }
  };

  return (
    <div className="auth-page">
      <aside className="auth-side">
        <Logo />
        <div className="auth-pitch">
          <span className="section-title">Call forwarding panel</span>
          <h2>Route<br />every call<span>.</span></h2>
          <p>Numbers, rules, menus and live traffic — one simple forwarding panel.</p>
          <ul className="auth-features">
            {FEATURES.map(([t, d]) => (
              <li key={t}><strong>{t}</strong><span>{d}</span></li>
            ))}
          </ul>
        </div>
        <span className="hero-word" aria-hidden="true">Forward</span>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <span className="section-title">Welcome back</span>
          <h1>Sign in</h1>
          <form onSubmit={submit} noValidate>
            <label>Email
              <input type="email" autoComplete="username" required placeholder="you@company.com" value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }} />
            </label>
            <label>Password
              <span className="auth-pass">
                <input type={show ? 'text' : 'password'} autoComplete="current-password" required placeholder="Your password" value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }} />
                <button type="button" className="auth-eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-block" type="submit">Sign in →</button>
          </form>
          <button type="button" className="auth-demo" onClick={() => login(LOCAL_ACCOUNT.email)}>
            <span>
              <strong>Use demo account</strong>
              <small>{LOCAL_ACCOUNT.email} · {LOCAL_ACCOUNT.password}</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </main>
    </div>
  );
}
