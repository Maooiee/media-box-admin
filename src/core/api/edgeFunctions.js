// admin-panel/src/core/api/edgeFunctions.js
//
// Every Supabase Edge Function call goes through here.
//
// Why: the functions endpoint needs BOTH headers.
//   • `apikey`     — lets the Edge Functions gateway accept the request.
//   • `Authorization: Bearer <user JWT>` — identifies the signed-in admin.
// Sending only the Authorization header is rejected with a bare 401 before the
// function runs, which is easy to misdiagnose as a bad token.

import { supabase } from '../config/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Calls a Supabase Edge Function as the signed-in admin.
 *
 * @param {string} name  Function slug, e.g. 'send-push'
 * @param {object} body  JSON body
 * @returns {Promise<any>} Parsed JSON response
 */
export async function callFunction(name, body = {}) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw new Error(`Auth error: ${error.message}`);
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new Error(
      payload?.error || `${name} failed (HTTP ${res.status})`,
    );
  }

  return payload;
}
