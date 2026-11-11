import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { migrate, seed } from './lib/seed';
import { applyLogs, finishCall, spawnCall } from './lib/simulate';

const DATA_KEY = 'mav_data_v2';
const USER_KEY = 'mav_user';

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [user, setUser] = useState(() => load(USER_KEY, null));
  const [db, setDb] = useState(() => {
    const saved = load(DATA_KEY, null);
    return saved ? migrate(saved) : seed(user);
  });
  const [live, setLive] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);

  const dbRef = useRef(db);
  dbRef.current = db;
  const liveRef = useRef(live);
  const setLiveCalls = next => {
    liveRef.current = next;
    setLive(next);
  };

  useEffect(() => {
    localStorage.removeItem('mav_data'); // data from the pre-React version
  }, []);

  useEffect(() => {
    localStorage.setItem(DATA_KEY, JSON.stringify(db));
  }, [db]);

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // One step of the call simulator. spawn: 'random' | 'force' | 'none'
  const tick = useCallback((spawn = 'random', overrides) => {
    const now = Date.now();
    const d = dbRef.current;
    const current = liveRef.current;
    const finished = current.filter(c => c.endsAt <= now);
    const next = current.filter(c => c.endsAt > now);
    const logs = finished.map(c => finishCall(c, now, d.billing.ratePerMin));
    let spawned = false;
    if (spawn === 'force' || (spawn === 'random' && Math.random() < 0.035 && next.length < 8)) {
      const s = spawnCall(d, next, now, overrides);
      if (s.call) {
        next.push(s.call);
        spawned = true;
      } else logs.push(s.log);
    }
    if (finished.length || spawned) setLiveCalls(next);
    if (logs.length) setDb(prev => applyLogs(prev, logs));
  }, []);

  const simulate = !!user && db.settings.simulate;
  useEffect(() => {
    if (!simulate) {
      // Wrap up anything still in progress.
      if (liveRef.current.length) {
        setLiveCalls(liveRef.current.map(c => ({ ...c, endsAt: Date.now() })));
        tick('none');
      }
      return;
    }
    const id = setInterval(() => tick('random'), 1000);
    return () => clearInterval(id);
  }, [simulate, tick]);

  const value = {
    user,
    login: email => setUser(email),
    logout: () => setUser(null),
    db,
    update: useCallback(fn => setDb(prev => fn(prev)), []),
    reset: () => {
      setLiveCalls([]);
      setDb(seed(user));
    },
    live,
    hangup: id => {
      setLiveCalls(liveRef.current.map(c => (c.id === id ? { ...c, endsAt: Date.now() } : c)));
      tick('none');
    },
    simulateCall: overrides => tick('force', overrides),
    toast: setToastMsg,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
