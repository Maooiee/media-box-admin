import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './core/hooks/useAuth';
import { supabase } from './core/config/supabase';
import LoginPage from './features/auth/presentation/LoginPage';
import AppShell from './shared/components/AppShell';
import DashboardPage from './features/dashboard/presentation/DashboardPage';
import QrCodePage from './features/qr/presentation/QrCodePage';
import SelfieReviewPage from './features/attendance/presentation/SelfieReviewPage';
import AttendanceAllPage from './features/attendance/presentation/AttendanceAllPage';
import TasksPage from './features/tasks/presentation/TasksPage';
import ShiftsAdminPage from './features/shifts/presentation/ShiftsAdminPage';
import EmployeesPage from './features/employees/presentation/EmployeesPage';
import EmployeeDetailPage from './features/employees/presentation/EmployeeDetailPage';
import PayrollAdminPage from './features/payroll/presentation/PayrollAdminPage';
import LoadingScreen from './shared/widgets/LoadingScreen';

export default function App() {
  const { session, loading } = useAuth();
  const [adminCheck, setAdminCheck] = useState('idle'); // 'idle' | 'checking' | 'allowed' | 'denied'

  useEffect(() => {
    if (loading || !session) {
      setAdminCheck('idle');
      return;
    }

    let cancelled = false;
    setAdminCheck('checking');

    (async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();

        if (cancelled) return;

        if (error || !profile?.is_admin) {
          setAdminCheck('denied');
        } else {
          setAdminCheck('allowed');
        }
      } catch {
        if (!cancelled) setAdminCheck('denied');
      }
    })();

    return () => { cancelled = true; };
  }, [loading, session]);

  // Sign out non-admins who somehow got a session — safely, only if signed in
  useEffect(() => {
    if (adminCheck !== 'denied') return;

    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore — session is already gone
      }
    })();

    return () => { cancelled = true; };
  }, [adminCheck]);

  if (loading) return <LoadingScreen />;
  if (!session) return <LoginPage />;
  if (adminCheck === 'checking' || adminCheck === 'idle') return <LoadingScreen />;
  if (adminCheck === 'denied') return <LoginPage />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"  element={<DashboardPage />} />
          <Route path="/qr"         element={<QrCodePage />} />
          <Route path="/attendance" element={<SelfieReviewPage />} />
          <Route path="/records"    element={<AttendanceAllPage />} />
          <Route path="/tasks"      element={<TasksPage />} />
          <Route path="/shifts"     element={<ShiftsAdminPage />} />
          <Route path="/employees"  element={<EmployeesPage />} />
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/payroll"    element={<PayrollAdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}