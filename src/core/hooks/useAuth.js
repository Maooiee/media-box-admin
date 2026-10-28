import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Restoring the session can fail when the saved refresh token is stale
    // (revoked, expired, user deleted, project reset). supabase-js discards
    // the dead session itself, but getSession() can reject — without the
    // catch/finally below the app would stay on the loader forever.
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('Saved session is no longer valid:', error.message);
        }
        setSession(error ? null : data.session);
      })
      .catch((error) => {
        if (!active) return;
        console.warn(
          'Could not restore the saved session:',
          error?.message ?? error,
        );
        setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        setSession(null);
        return;
      }
      setSession(nextSession);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
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