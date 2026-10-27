import { NavLink } from 'react-router-dom';

export default function TabButton({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold transition duration-200 md:px-5 md:text-sm ${
          isActive
            ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/25'
            : 'border border-border bg-white text-textMedium hover:border-primary/40 hover:bg-primary-light/20 hover:text-textDark'
        }`
      }
    >
      {label}
    </NavLink>
  );
}
