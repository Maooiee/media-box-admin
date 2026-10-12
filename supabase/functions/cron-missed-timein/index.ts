// supabase/functions/cron-missed-timein/index.ts
//
// Runs on a schedule. Finds employees whose shift started more than
// GRACE_MINUTES ago and who never scanned in. Marks them absent and
// pushes a "Missed time-in" notification.
//
// Trigger from a Supabase cron job (see SQL in the deployment notes).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const FCM_PROJECT_ID = 'mediabox-attendance';
const ATTENDANCE_CHANNEL_ID = 'attendance_channel';
const GRACE_MINUTES = 60; // how long after shift start before we mark absent

// ─── FCM helpers (same as notify-late) ───
async function getFcmAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const unsigned = `${enc(header)}.${enc(payload)}`;
  const pem = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${unsigned}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`FCM token exchange failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function sendFcmPush(opts: {
  accessToken: string;
  fcmToken: string;
  title: string;
  body: string;
}) {
  const url = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: opts.fcmToken,
        notification: { title: opts.title, body: opts.body },
        android: {
          priority: 'high',
          notification: {
            channel_id: ATTENDANCE_CHANNEL_ID,
            sound: 'default',
          },
        },
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`FCM send failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

// ─── Main ───
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');

    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    // 1. Find shifts today whose start_hour + grace has passed
    const { data: shifts, error: shiftErr } = await admin
      .from('shifts')
      .select('user_id, shift_date, start_hour, end_hour, name')
      .eq('shift_date', todayStr);

    if (shiftErr || !shifts) {
      return new Response(
        JSON.stringify({ error: 'Failed to load shifts', detail: shiftErr }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter to shifts that are past grace and haven't ended
    const eligible = shifts.filter((s) => {
      const start = (s.start_hour as number) ?? 0;
      const end = (s.end_hour as number) ?? 23;
      const minutesSinceStart = (currentHour - start) * 60 + currentMin;
      // started + grace has passed, but shift hasn't ended yet
      return minutesSinceStart > GRACE_MINUTES && currentHour < end;
    });

    if (eligible.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, reason: 'no eligible shifts' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Load today's attendance rows for those users
    const userIds = eligible.map((s) => s.user_id);
    const { data: attendance } = await admin
      .from('attendance_records')
      .select('id, user_id, time_in, status')
      .in('user_id', userIds)
      .eq('date', todayStr);

    const attByUser = Object.fromEntries(
      (attendance ?? []).map((a) => [a.user_id, a])
    );

    // 3. Load profiles for fcm_token
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, fcm_token')
      .in('id', userIds);

    const profileByUser = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p])
    );

    // 4. Process each eligible shift
    const results: Array<{ user_id: string; action: string }> = [];
    const accessToken = await getFcmAccessToken(serviceAccountJson);

    for (const shift of eligible) {
      const att = attByUser[shift.user_id];
      const profile = profileByUser[shift.user_id];

      // Already scanned in — skip
      if (att?.time_in) {
        results.push({ user_id: shift.user_id, action: 'already clocked in' });
        continue;
      }

      // Already marked absent — skip (idempotent)
      if (att?.status === 'absent') {
        results.push({ user_id: shift.user_id, action: 'already absent' });
        continue;
      }

      // Mark absent (insert or update)
      if (att) {
        await admin
          .from('attendance_records')
          .update({ status: 'absent' })
          .eq('id', att.id);
      } else {
        await admin.from('attendance_records').insert({
          user_id: shift.user_id,
          date: todayStr,
          status: 'absent',
        });
      }

      // Send push (if we have a token)
      if (profile?.fcm_token) {
        const startLabel = `${String(shift.start_hour).padStart(2, '0')}:00`;
        try {
          await sendFcmPush({
            accessToken,
            fcmToken: profile.fcm_token,
            title: 'Missed time-in',
            body: `Your shift started at ${startLabel}. Please contact your supervisor.`,
          });
          results.push({ user_id: shift.user_id, action: 'absent + pushed' });
        } catch (e) {
          results.push({
            user_id: shift.user_id,
            action: `absent, push failed: ${String(e)}`,
          });
        }
      } else {
        results.push({
          user_id: shift.user_id,
          action: 'absent, no fcm token',
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});