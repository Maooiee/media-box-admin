import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return {
    session,
    loading,
    signOut: () => supabase.auth.signOut(),
  };
}
