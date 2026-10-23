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
    signOut: async () => {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        // Ignore 403 errors (session is already invalid/expired on the server)
        // This happens if the user was deleted or the DB was cleared
        if (error?.status !== 403) {
          console.error('Sign out error:', error);
        }
      }
    },
  };
}