// supabase/functions/notify-leave-decision/index.ts
//
// Called by the trg_notify_leave_decision SQL trigger when admin
// approves or rejects a leave. Sends a push to the employee.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FCM_PROJECT_ID = 'mediabox-attendance';
const CHANNEL_ID = 'attendance_channel';

async function getFcmAccessToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const enc = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsigned = `${enc(header)}.${enc(payload)}`;
  const pem = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${sigB64}`,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('FCM auth failed');
  return data.access_token;
}

async function sendFcmPush(token: string, title: string, body: string, accessToken: string) {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          android: {
            priority: 'high',
            notification: { channel_id: CHANNEL_ID, sound: 'default' },
          },
        },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`FCM send failed: ${JSON.stringify(data)}`);
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const saJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!saJson) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');

    const { user_id, status, leave_type, start_date, end_date, note } = await req.json();
    if (!user_id || !status) throw new Error('user_id and status required');

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, fcm_token')
      .eq('id', user_id)
      .maybeSingle();

    if (!profile?.fcm_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'No FCM token' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const approved = status === 'approved';
    const title = approved ? 'Leave approved' : 'Leave rejected';
    const dateRange = start_date === end_date
      ? start_date
      : `${start_date} → ${end_date}`;
    const body = approved
      ? `Your ${leave_type} leave (${dateRange}) was approved.`
      : `Your ${leave_type} leave (${dateRange}) was rejected.${note ? ' Note: ' + note : ''}`;

    const accessToken = await getFcmAccessToken(saJson);
    const result = await sendFcmPush(profile.fcm_token, title, body, accessToken);

    // Also log it so it shows in the app's Notifications screen
    await admin.from('notification_log').insert({
      user_id,
      type: 'leave_decision',
      ref_date: new Date().toISOString().slice(0, 10),
    }).catch(() => {}); // ignore duplicate

    return new Response(
      JSON.stringify({ success: true, message_id: result.name }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});