import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../../core/config/supabase';

export default function ProtectedRoute({ children }) {
  const [state, setState] = useState('checking'); // 'checking' | 'allowed' | 'denied'

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (!cancelled) setState('denied');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();

        if (!cancelled) {
          setState(profile?.is_admin ? 'allowed' : 'denied');
        }
      } catch {
        if (!cancelled) setState('denied');
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  if (state === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-xs text-textLight">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (state === 'denied') {
    supabase.auth.signOut();
    return <Navigate to="/login" replace />;
  }

  return children;
}