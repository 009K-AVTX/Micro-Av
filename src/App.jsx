import { Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from './store';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Live from './pages/Live';
import Reports from './pages/Reports';
import Numbers from './pages/Numbers';
import Campaigns from './pages/Campaigns';
import Campaign from './pages/Campaign';
import Routing from './pages/Routing';
import RoutingPlan from './pages/RoutingPlan';
import Destinations from './pages/Destinations';
import Forwarding from './pages/Forwarding';
import Ivr from './pages/Ivr';
import Blocked from './pages/Blocked';
import Logs from './pages/Logs';
import Billing from './pages/Billing';
import Settings from './pages/Settings';

export default function App() {
  const { user } = useStore();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/live" element={<Live />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<Campaign />} />
        <Route path="/routing" element={<Routing />} />
        <Route path="/routing/:id" element={<RoutingPlan />} />
        <Route path="/numbers" element={<Numbers />} />
        <Route path="/destinations" element={<Destinations />} />
        <Route path="/forwarding" element={<Forwarding />} />
        <Route path="/ivr" element={<Ivr />} />
        <Route path="/blocked" element={<Blocked />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
