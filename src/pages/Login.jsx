import { useState } from 'react';
import { useStore } from '../store';
import Logo from '../components/Logo';

// Local demo account — no backend, credentials are checked in the browser.
export const LOCAL_ACCOUNT = { email: 'admin@microav.local', password: 'admin123' };

export default function Login() {
  const { login } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        <div>
          <h2>Route<br />every call<span>.</span></h2>
          <p>Numbers, rules, menus and live traffic — one simple forwarding panel.</p>
        </div>
        <span className="hero-word" aria-hidden="true">Forward</span>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <span className="section-title">Welcome back</span>
          <h1>Sign in</h1>
          <form onSubmit={submit}>
            <label>Email
              <input type="text" required placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            <label>Password
              <input type="password" required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-block" type="submit">Sign in →</button>
            <p className="muted small">
              Local login: <strong>{LOCAL_ACCOUNT.email}</strong> / <strong>{LOCAL_ACCOUNT.password}</strong>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
