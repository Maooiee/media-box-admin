// admin-panel/src/features/attendance/data/notificationsRepository.js
//
// Tiny wrapper around the `send-push` Supabase Edge Function.

import { supabase } from '../../../core/config/supabase';

const SUPABASE_URL = 'https://qbefrttyhmhssdolbfhi.supabase.co';
const EDGE_FUNCTION = 'send-push';
const DEFAULT_CHANNEL_ID = 'attendance_channel';

/**
 * Send a push notification to a specific user.
 *
 * @param {object} opts
 * @param {string} opts.userId      - target profile id (auth user id)
 * @param {string} opts.title       - notification title
 * @param {string} opts.body        - notification body
 * @param {string} [opts.channelId] - android channel id (defaults to attendance_channel)
 */
export async function sendPush({
  userId,
  title,
  body,
  channelId = DEFAULT_CHANNEL_ID,
}) {
  if (!userId) throw new Error('sendPush: userId is required');
  if (!title) throw new Error('sendPush: title is required');
  if (!body) throw new Error('sendPush: body is required');

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw new Error(`Auth error: ${error.message}`);
  if (!session?.access_token) throw new Error('Not signed in');

  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/${EDGE_FUNCTION}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        user_id: userId,
        title,
        body,
        channelId,
      }),
    }
  );

  let payload;
  try {
    payload = await res.json();
  } catch {
    payload = { success: false, error: `HTTP ${res.status}` };
  }

  if (!res.ok) {
    throw new Error(payload?.error || `send-push failed (HTTP ${res.status})`);
  }
  return payload;
}

export const notificationsRepository = { sendPush };
export default notificationsRepository;