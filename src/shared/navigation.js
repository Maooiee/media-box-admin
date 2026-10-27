import {
  LayoutDashboard, QrCode, Camera, ClipboardList, CheckSquare,
  Users, Calendar, CalendarDays, Wallet, KeyRound,
} from 'lucide-react';

// Sidebar information architecture: a short "Workspace" list for daily pages,
// then collapsible groups so secondary screens don't compete for attention.
export const NAV_ITEMS = [
  { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard',       shortLabel: 'Home',       primary: true,  group: 'main' },
  { to: '/records',         icon: ClipboardList,   label: 'Attendance',      shortLabel: 'Attendance', primary: true,  group: 'main' },
  { to: '/employees',       icon: Users,           label: 'Employees',       shortLabel: 'Team',       primary: true,  group: 'main' },
  { to: '/payroll',         icon: Wallet,          label: 'Payroll',         shortLabel: 'Payroll',    primary: false, group: 'main' },

  { to: '/shifts',          icon: Calendar,        label: 'Shifts',          shortLabel: 'Shifts',     primary: true,  group: 'scheduling' },
  { to: '/leave',           icon: CalendarDays,    label: 'Leave',           shortLabel: 'Leave',      primary: false, group: 'scheduling' },
  { to: '/tasks',           icon: CheckSquare,     label: 'Tasks',           shortLabel: 'Tasks',      primary: false, group: 'scheduling' },

  { to: '/attendance',      icon: Camera,          label: 'Selfies',         shortLabel: 'Selfies',    primary: false, group: 'tools' },
  { to: '/qr',              icon: QrCode,          label: 'QR Code',         shortLabel: 'QR',         primary: false, group: 'tools' },
  { to: '/password-resets', icon: KeyRound,        label: 'Password Resets', shortLabel: 'Resets',     primary: false, group: 'tools' },
];

export const NAV_GROUPS = [
  { id: 'main',       label: 'Workspace' },
  { id: 'scheduling', label: 'Scheduling', collapsible: true },
  { id: 'tools',      label: 'Tools',      collapsible: true },
];

// The 4 items shown in the mobile bottom bar (plus a "More" button)
export const MOBILE_PRIMARY_ITEMS = NAV_ITEMS.filter((i) => i.primary);
