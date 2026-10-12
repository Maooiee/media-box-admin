import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppShell() {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);

  // Change key on route change → remounts content with new animation
  useEffect(() => {
    setKey(location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-bg flex">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-6">
          <div key={key} className="animate-page-enter">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}