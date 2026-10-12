// supabase/functions/notify-late/index.ts
//
// Sends a "you're late" push to the employee who just scanned in late.
// Called from the Flutter app immediately after a late attendance insert.
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const FCM_PROJECT_ID = 'mediabox-attendance';
const ATTENDANCE_CHANNEL_ID = 'attendance_channel';

// ─── Get an OAuth2 access token from the service account JSON ───
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

  // Import the private key
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

  // Exchange for an access token
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

// ─── Send a push via FCM v1 ───
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
        notification: {
          title: opts.title,
          body: opts.body,
        },
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
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { attendance_id } = await req.json();
    if (!attendance_id) {
      return new Response(
        JSON.stringify({ error: 'attendance_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Load the attendance row
    const { data: att, error: attErr } = await admin
      .from('attendance_records')
      .select('id, user_id, date, time_in, status')
      .eq('id', attendance_id)
      .maybeSingle();

    if (attErr || !att) {
      return new Response(
        JSON.stringify({ error: 'Attendance row not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

        // 2. Only notify if status is 'late'
    if (att.status !== 'late') {
      return new Response(
        JSON.stringify({ success: true, skipped: 'not late' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2a. Verify the employee actually had a shift scheduled today.
    // This is the belt-and-braces check: even if the client mislabels a
    // scan as 'late', we don't push unless a shift exists for that date.
    const { data: shift } = await admin
      .from('shifts')
      .select('start_hour, end_hour')
      .eq('user_id', att.user_id)
      .eq('shift_date', att.date)
      .maybeSingle();

    if (!shift) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: 'no shift scheduled for this date',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Load the user's profile for fcm_token + name
    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('full_name, fcm_token')
      .eq('id', att.user_id)
      .maybeSingle();

    if (profErr || !profile?.fcm_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'No FCM token for this user' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Load the shift for that date to include the scheduled start
    const startHour = (shift?.start_hour as number | undefined) ?? null;

    // 5. Compose the message
    const title = 'Marked late today';
    const timeIn = new Date(att.time_in);
    const actual = timeIn.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const body = startHour != null
      ? `You scanned in at ${actual}. Scheduled start was ${String(
          startHour
        ).padStart(2, '0')}:00.`
      : `You scanned in at ${actual} and were marked late.`;

    // 6. Send the push
    const accessToken = await getFcmAccessToken(serviceAccountJson);
    const fcmResult = await sendFcmPush({
      accessToken,
      fcmToken: profile.fcm_token,
      title,
      body,
    });

    return new Response(
      JSON.stringify({ success: true, message_id: fcmResult.name }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});