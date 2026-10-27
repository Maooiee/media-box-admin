import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './core/hooks/useAuth';
import { supabase } from './core/config/supabase';
import LoginPage from './features/auth/presentation/LoginPage';
import ResetPasswordPage from './features/auth/presentation/ResetPasswordPage';
import AppShell from './shared/components/AppShell';
import ErrorBoundary from './shared/components/ErrorBoundary';
import DashboardPage from './features/dashboard/presentation/DashboardPage';
import QrCodePage from './features/qr/presentation/QrCodePage';
import SelfieReviewPage from './features/attendance/presentation/SelfieReviewPage';
import AttendanceAllPage from './features/attendance/presentation/AttendanceAllPage';
import TasksPage from './features/tasks/presentation/TasksPage';
import ShiftsAdminPage from './features/shifts/presentation/ShiftsAdminPage';
import EmployeesPage from './features/employees/presentation/EmployeesPage';
import EmployeeDetailPage from './features/employees/presentation/EmployeeDetailPage';
import PayrollAdminPage from './features/payroll/presentation/PayrollAdminPage';
import PasswordResetsPage from './features/passwordResets/presentation/PasswordResetsPage';

// 👈 Import changed from './shared/widgets/PageLoader' to './shared/components/PageLoader'
import PageLoader from './shared/components/PageLoader';

export default function App() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [adminCheck, setAdminCheck] = useState('idle');

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

  useEffect(() => {
    if (adminCheck !== 'denied') return;

    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore
      }
    })();

    return () => { cancelled = true; };
  }, [adminCheck]);

  // Password recovery has to be reachable without an admin session: the
  // recovery link itself creates a short-lived session when it is opened.
  if (location.pathname === '/reset-password') {
    return (
      <ErrorBoundary key={location.pathname}>
        <ResetPasswordPage />
      </ErrorBoundary>
    );
  }

  // 👈 Using PageLoader with fullScreen and custom text
  let content;
  if (loading) content = <PageLoader text="Connecting to Media Box" fullScreen />;
  else if (!session) content = <LoginPage />;
  else if (adminCheck === 'checking' || adminCheck === 'idle')
    content = <PageLoader text="Verifying admin access" fullScreen />;
  else if (adminCheck === 'denied') content = <LoginPage />;
  else
    content = (
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"  element={<DashboardPage />} />
          <Route path="/qr"         element={<QrCodePage />} />
          <Route path="/attendance" element={<SelfieReviewPage />} />
          <Route path="/records"    element={<AttendanceAllPage />} />
          <Route path="/tasks"      element={<TasksPage />} />
          <Route path="/shifts"     element={<ShiftsAdminPage />} />
          <Route path="/leave"      element={<ShiftsAdminPage />} />
          <Route path="/employees"  element={<EmployeesPage />} />
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/payroll"    element={<PayrollAdminPage />} />
          <Route path="/password-resets" element={<PasswordResetsPage />} />
        </Route>
      </Routes>
    );

  // ErrorBoundary wraps EVERY render path (login, loaders, routes) so a
  // component crash shows a recovery UI instead of white-screening the
  // whole admin panel. key = pathname → navigating remounts it, clearing
  // the error automatically.
  return <ErrorBoundary key={location.pathname}>{content}</ErrorBoundary>;
}