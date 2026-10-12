import { supabase } from '../../../core/config/supabase';

export const authRepository = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    await supabase.auth.signOut();
  },
};