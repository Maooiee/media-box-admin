import {
  LayoutDashboard, QrCode, Camera, ClipboardList, CheckSquare,
  Users, Calendar, Wallet,
} from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',  shortLabel: 'Home',       primary: true },
  { to: '/records',    icon: ClipboardList,   label: 'Attendance', shortLabel: 'Attendance', primary: true },
  { to: '/employees',  icon: Users,           label: 'Employees',  shortLabel: 'Team',       primary: true },
  { to: '/shifts',     icon: Calendar,        label: 'Shifts',     shortLabel: 'Shifts',     primary: true },
  { to: '/tasks',      icon: CheckSquare,     label: 'Tasks',      shortLabel: 'Tasks',      primary: false },
  { to: '/attendance', icon: Camera,          label: 'Selfies',    shortLabel: 'Selfies',    primary: false },
  { to: '/qr',         icon: QrCode,          label: 'QR Code',    shortLabel: 'QR',         primary: false },
  { to: '/payroll',    icon: Wallet,          label: 'Payroll',    shortLabel: 'Payroll',    primary: false },
];

// The 4 items shown in the mobile bottom bar (plus a "More" button)
export const MOBILE_PRIMARY_ITEMS = NAV_ITEMS.filter((i) => i.primary);