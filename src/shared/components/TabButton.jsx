import { NavLink } from 'react-router-dom';

export default function TabButton({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-5 py-2 rounded-full text-sm font-semibold transition ${
          isActive
            ? 'bg-primary text-white shadow-sm'
            : 'text-textLight hover:text-textDark'
        }`
      }
    >
      {label}
    </NavLink>
  );
}
