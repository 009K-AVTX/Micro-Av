import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Modal, Stat, Table } from '../components/ui';
import { DAY, fmtDate, fmtTime, money, startOfDay, startOfMonth, uid } from '../utils';

export default function Billing() {
  const { db, update, toast } = useStore();
  const [adding, setAdding] = useState(false);
  const { billing } = db;

  const usage = useMemo(() => {
    const monthStart = startOfMonth(Date.now());
    const today = startOfDay(Date.now());
    const days = Array.from({ length: 7 }, (_, i) => ({ start: today - i * DAY, calls: 0, minutes: 0, cost: 0 }));
    let month = 0;
    db.logs.forEach(l => {
      if (l.time >= monthStart) month += l.cost;
      const d = days.find(x => l.time >= x.start && l.time < x.start + DAY);
      if (d && l.duration) {
        d.calls++;
        d.minutes += Math.ceil(l.duration / 60);
        d.cost += l.cost;
      }
    });
    return { month, days };
  }, [db.logs]);

  const rental = db.numbers.filter(n => n.status === 'Active').reduce((a, n) => a + (n.monthlyCost || 0), 0);

  const addFunds = v => {
    const amount = Number(v.amount);
    if (!(amount >= 5)) return alert('Minimum top-up is $5.');
    update(d => ({
      ...d,
      billing: {
        ...d.billing,
        balance: +(d.billing.balance + amount).toFixed(2),
        transactions: [{ id: uid(), time: Date.now(), type: 'Top-up', note: v.method, amount }, ...d.billing.transactions],
      },
      notifications: [{ id: uid(), time: Date.now(), title: 'Funds added', body: `${money(amount)} added to your balance`, link: '/billing', read: false }, ...d.notifications],
    }));
    toast(`${money(amount)} added`);
    setAdding(false);
  };

  return (
    <>
      {billing.balance < db.settings.lowBalance && (
        <div className="alert">Your balance is below your {money(db.settings.lowBalance)} alert level. Add funds to avoid interruptions.</div>
      )}
      <div className="grid">
        <Stat label="Balance" value={money(billing.balance)} hint={<button className="btn btn-sm btn-primary" onClick={() => setAdding(true)}>Add funds</button>} />
        <Stat label="Usage this month" value={money(usage.month)} hint={`Forwarded minutes at ${money(billing.ratePerMin)}/min`} />
        <Stat label="Number rental" value={`${money(rental)}/mo`} hint={`${db.numbers.filter(n => n.status === 'Active').length} active numbers`} />
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-head"><h2>Transactions</h2></div>
          <Table columns={['Date', 'Type', 'Details', 'Amount']} empty="No transactions yet.">
            {billing.transactions.map(t => (
              <tr key={t.id}>
                <td>{fmtTime(t.time)}</td>
                <td>{t.type}</td>
                <td className="muted">{t.note}</td>
                <td className={t.amount < 0 ? 'neg' : 'pos'}>{t.amount > 0 ? '+' : ''}{money(t.amount)}</td>
              </tr>
            ))}
          </Table>
        </div>
        <div className="card">
          <div className="card-head"><h2>Usage — last 7 days</h2></div>
          <Table columns={['Day', 'Calls', 'Min', 'Cost']}>
            {usage.days.map(d => (
              <tr key={d.start}>
                <td>{fmtDate(d.start)}</td>
                <td>{d.calls}</td>
                <td>{d.minutes}</td>
                <td>{money(d.cost)}</td>
              </tr>
            ))}
          </Table>
        </div>
      </div>

      {adding && (
        <Modal title="Add funds" onClose={() => setAdding(false)} onSubmit={addFunds} submitLabel="Add funds">
          <label>Amount ($)
            <input type="number" name="amount" min="5" step="1" defaultValue="50" required />
          </label>
          <label>Payment method
            <select name="method">
              <option>Card ending 4242</option>
              <option>Bank transfer</option>
            </select>
          </label>
          <p className="muted small">Demo only — no payment is taken.</p>
        </Modal>
      )}
    </>
  );
}
