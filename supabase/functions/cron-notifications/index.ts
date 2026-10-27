// supabase/functions/cron-notifications/index.ts
//
// Notification engine. Runs every 15 min via pg_cron.
// Handles: missing time-in, late, missing timeout, absent, rest day, admin alerts.
//
// Deduplication: notification_log ensures one notification of each type per user per day.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const FCM_PROJECT_ID = 'mediabox-attendance';
const CHANNEL_ID = 'attendance_channel';
const GRACE_MINUTES = 15;      // late after start + 15 min
const MISSING_TIMEIN_MIN = 30; // missed time-in after start + 30 min
const MISSING_TIMEOUT_HOURS = 8;
const REST_DAY_HOUR = 6;        // rest day notification fires after 6 AM
const ABSENT_AFTER_HOURS = 12;  // mark absent 12 h after shift start if no scan

// ─── Store business clock (Asia/Manila) ───
// Supabase Edge Functions run in UTC. Using `new Date().getHours()` or the UTC
// date here fired reminders 8 hours late and could write an `absent` row on
// the wrong day. Every date/time decision below goes through these helpers so
// it matches `attendance_today()` in the database.
const MANILA_TZ = 'Asia/Manila';

function manilaClock(d: Date): { today: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return {
    today: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function manilaTimeLabel(d: Date): string {
  return d.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MANILA_TZ,
  });
}

// ─── FCM helpers ───
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
    btoa(JSON.stringify(o))
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
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${sigB64}`,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`FCM auth failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function sendFcmPush(opts: {
  accessToken: string;
  token: string;
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
        token: opts.token,
        notification: { title: opts.title, body: opts.body },
        android: {
          priority: 'high',
          notification: { channel_id: CHANNEL_ID, sound: 'default' },
        },
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`FCM send failed: ${JSON.stringify(data)}`);
  return data;
}

// ─── Notification dispatch with dedup ───
type NotifyArgs = {
  admin: ReturnType<typeof createClient>;
  userId: string;
  type: string;
  refDate: string;
  title: string;
  body: string;
  fcmToken: string | null;
  accessToken: string;
};

async function tryNotify(args: NotifyArgs): Promise<string> {
  const { admin, userId, type, refDate, title, body, fcmToken, accessToken } = args;

  if (!fcmToken) return 'no_fcm_token';

  // Check if already sent today
  const { data: existing } = await admin
    .from('notification_log')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('ref_date', refDate)
    .maybeSingle();

  if (existing) return 'already_sent';

  // Log first (prevents races), then send
  const { error: logErr } = await admin
    .from('notification_log')
    .insert({ user_id: userId, type, ref_date: refDate });
  if (logErr) return `log_failed:${logErr.message}`;

  try {
    await sendFcmPush({ accessToken, token: fcmToken, title, body });
    return 'sent';
  } catch (e) {
    return `fcm_failed:${String(e)}`;
  }
}

// ─── Main ───
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const saJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');

    if (!saJson) {
      return new Response(
        JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const accessToken = await getFcmAccessToken(saJson);

    const now = new Date();
    // Business date + wall-clock minutes in Asia/Manila (not UTC).
    const { today, minutes: currentMinutes } = manilaClock(now);
    const results: Record<string, number> = {
      missing_timein: 0,
      late: 0,
      missing_timeout: 0,
      absent: 0,
      rest_day: 0,
      admin_alerts: 0,
    };

    // ─────────────────────────────────────────
    // 1. Load employees + their shifts + attendance today
    // ─────────────────────────────────────────
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, fcm_token, is_admin, is_active, notify_late, notify_missing_timein, notify_missing_timeout, notify_absent, notify_rest_day, is_on_leave')
      .eq('is_active', true);

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'no active profiles' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: shifts } = await admin
      .from('shifts')
      .select('user_id, start_hour, end_hour, kind')
      .eq('shift_date', today);

    const { data: attendance } = await admin
      .from('attendance_records')
      .select('user_id, time_in, time_out, status')
      .eq('date', today);

    const { data: approvedLeaves } = await admin
      .from('leave_requests')
      .select('user_id')
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);

    const shiftMap = Object.fromEntries((shifts ?? []).map((s) => [s.user_id, s]));
    const attMap = Object.fromEntries((attendance ?? []).map((a) => [a.user_id, a]));
    const leaveSet = new Set((approvedLeaves ?? []).map((l) => l.user_id));

    // Collect admin tokens for later use
    const adminTokens = profiles
      .filter((p) => p.is_admin && p.fcm_token)
      .map((p) => p.fcm_token!);

    // ─────────────────────────────────────────
    // 2. Iterate employees
    // ─────────────────────────────────────────
    for (const p of profiles) {
      if (leaveSet.has(p.id)) continue; // on approved leave — no reminders
      if (p.is_on_leave) continue;

      const shift = shiftMap[p.id];
      const att = attMap[p.id];

      // ── REST DAY (fires once, after 6 AM, only if no shift today) ──
      if (!shift && currentMinutes >= REST_DAY_HOUR * 60 && p.notify_rest_day) {
        const r = await tryNotify({
          admin, userId: p.id, type: 'rest_day', refDate: today,
          title: 'Enjoy your rest day ☀️',
          body: 'You have no shift today. Rest up!',
          fcmToken: p.fcm_token, accessToken,
        });
        if (r === 'sent') results.rest_day++;
        continue;
      }

      if (!shift) continue; // no shift, nothing to check

      const startHour = (shift.start_hour as number) ?? 9;
      const startMin = startHour * 60;
      const minutesSinceStart = currentMinutes - startMin;

      // ── MISSING TIME-IN (30+ min after start, no time_in) ──
      if (!att?.time_in && minutesSinceStart > MISSING_TIMEIN_MIN && p.notify_missing_timein) {
        const r = await tryNotify({
          admin, userId: p.id, type: 'missing_timein', refDate: today,
          title: 'Missing time-in',
          body: `Your shift started at ${String(startHour).padStart(2, '0')}:00. Please time in.`,
          fcmToken: p.fcm_token, accessToken,
        });
        if (r === 'sent') results.missing_timein++;
      }

      // ── LATE (already has time_in, past grace) ──
      if (att?.time_in && att.status === 'late' && p.notify_late) {
        const timeIn = new Date(att.time_in);
        const actualMin = manilaClock(timeIn).minutes;
        const lateMin = actualMin - startMin;

        if (lateMin > GRACE_MINUTES) {
          const r = await tryNotify({
            admin, userId: p.id, type: 'late', refDate: today,
            title: `You're ${lateMin} min late`,
            body: `You timed in at ${manilaTimeLabel(timeIn)}. Scheduled start was ${String(startHour).padStart(2, '0')}:00.`,
            fcmToken: p.fcm_token, accessToken,
          });
          if (r === 'sent') results.late++;

          // ── ADMIN ALERT (same event) ──
          for (const adminToken of adminTokens) {
            try {
              await sendFcmPush({
                accessToken, token: adminToken,
                title: `Admin alert: ${p.full_name} is late`,
                body: `Timed in at ${manilaTimeLabel(timeIn)} (${lateMin} min late).`,
              });
              results.admin_alerts++;
            } catch (_) { /* ignore individual admin failures */ }
          }
        }
      }

      // ── MISSING TIMEOUT (8h after time_in, no time_out) ──
      if (att?.time_in && !att?.time_out && p.notify_missing_timeout) {
        const timeIn = new Date(att.time_in);
        const hoursSince = (Date.now() - timeIn.getTime()) / 3_600_000;
        if (hoursSince >= MISSING_TIMEOUT_HOURS) {
          const r = await tryNotify({
            admin, userId: p.id, type: 'missing_timeout', refDate: today,
            title: 'Remember to time out',
            body: `You've been on shift for ${Math.floor(hoursSince)}h. Don't forget to time out.`,
            fcmToken: p.fcm_token, accessToken,
          });
          if (r === 'sent') results.missing_timeout++;
        }
      }

      // ── ABSENT (12h after start, still no time_in) ──
      if (!att?.time_in && minutesSinceStart > ABSENT_AFTER_HOURS * 60 && p.notify_absent) {
        // Mark attendance row as absent if it exists and isn't set
        if (att && att.status !== 'absent') {
          await admin
            .from('attendance_records')
            .update({ status: 'absent' })
            .eq('user_id', p.id)
            .eq('date', today);
        } else if (!att) {
          await admin.from('attendance_records').insert({
            user_id: p.id,
            date: today,
            status: 'absent',
          });
        }

        const r = await tryNotify({
          admin, userId: p.id, type: 'absent', refDate: today,
          title: 'Marked absent today',
          body: 'You had no time-in for your scheduled shift. Contact your supervisor if this is wrong.',
          fcmToken: p.fcm_token, accessToken,
        });
        if (r === 'sent') results.absent++;

        // Admin alert
        for (const adminToken of adminTokens) {
          try {
            await sendFcmPush({
              accessToken, token: adminToken,
              title: `Admin alert: ${p.full_name} absent`,
              body: `No time-in today for the ${startHour}:00 shift.`,
            });
            results.admin_alerts++;
          } catch (_) {}
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});