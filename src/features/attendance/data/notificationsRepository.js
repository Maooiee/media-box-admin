// admin-panel/src/features/attendance/data/notificationsRepository.js
//
// Tiny wrapper around the `send-push` Supabase Edge Function.

import { callFunction } from '../../../core/api/edgeFunctions';

const DEFAULT_CHANNEL_ID = 'attendance_channel';

/**
 * Send a push notification to a specific user.
 *
 * @param {object} opts
 * @param {string} opts.userId      - target profile id (auth user id)
 * @param {string} opts.title       - notification title
 * @param {string} opts.body        - notification body
 * @param {string} [opts.kind]      - notification kind for the app icon/grouping
 * @param {object} [opts.data]      - extra data stored with the notification
 * @param {string} [opts.channelId] - android channel id (defaults to attendance_channel)
 */
export async function sendPush({
  userId,
  title,
  body,
  kind = 'admin_reminder',
  data,
  channelId = DEFAULT_CHANNEL_ID,
}) {
  if (!userId) throw new Error('sendPush: userId is required');
  if (!title) throw new Error('sendPush: title is required');
  if (!body) throw new Error('sendPush: body is required');

  return callFunction('send-push', {
    user_id: userId,
    title,
    body,
    kind,
    data,
    channelId,
  });
}

export const notificationsRepository = { sendPush };
export default notificationsRepository;
