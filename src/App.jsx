import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './core/hooks/useAuth';
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

  if (loading) return <LoadingScreen />;
  if (!session) return <LoginPage />;

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