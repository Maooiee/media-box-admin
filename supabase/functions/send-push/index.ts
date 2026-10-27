import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { initializeApp, cert } from 'npm:firebase-admin@12/app';
import { getMessaging } from 'npm:firebase-admin@12/messaging';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

let firebaseInitialized = false;
function ensureFirebase() {
  if (firebaseInitialized) return;

  const saJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!saJson) throw new Error('FIREBASE_SERVICE_ACCOUNT secret not set');

  const serviceAccount = JSON.parse(saJson);
  initializeApp({
    credential: cert(serviceAccount),
  });

  firebaseInitialized = true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const jwt = authHeader.slice('Bearer '.length);

    // verify_jwt is disabled for this function, so validate the caller's token
    // explicitly. `getUser()` must receive the JWT — reading it from a client
    // built with the service-role key without an argument always returns
    // "no session" and 401s.
    const authClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userErr } = await authClient.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid auth token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      return new Response(
        JSON.stringify({ error: `Profile lookup failed: ${profileErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Not an admin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, title, body, data, kind, channelId } = await req.json();

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id, title, or body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: target, error: targetErr } = await admin
      .from('profiles')
      .select('fcm_token, full_name')
      .eq('id', user_id)
      .maybeSingle();

    if (targetErr) {
      return new Response(
        JSON.stringify({ error: `Target lookup failed: ${targetErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!target) {
      return new Response(
        JSON.stringify({ error: 'Target user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save the reminder in the app's inbox first. The push is best-effort:
    // Android may drop it (permission, stale token, missing channel, …), but
    // the employee must still see the request when they open Notifications.
    const kindValue =
      (typeof kind === 'string' && kind.trim()) ||
      (data && typeof data.kind === 'string' && data.kind.trim()) ||
      'admin_reminder';

    const payloadData: Record<string, unknown> =
      data && typeof data === 'object' && !Array.isArray(data) ? { ...data } : {};
    payloadData.kind = kindValue;
    payloadData.source = 'admin_reminder';

    const { data: notif, error: notifErr } = await admin
      .from('notifications')
      .insert({
        user_id,
        title,
        body,
        kind: kindValue,
        data: payloadData,
      })
      .select('id')
      .maybeSingle();

    const savedInApp = !notifErr && !!notif?.id;

    if (!target.fcm_token) {
      if (!savedInApp) {
        return new Response(
          JSON.stringify({
            error: `No FCM token and in-app save failed: ${
              notifErr?.message ?? 'unknown'
            }`,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          in_app: true,
          push: false,
          notification_id: notif?.id,
          warning:
            'No FCM token for this user — reminder saved in the app only.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FCM requires every data value to be a string.
    const fcmData: Record<string, string> = {};
    for (const [key, value] of Object.entries(payloadData)) {
      if (value === null || value === undefined) continue;
      fcmData[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    if (notif?.id) fcmData.notification_id = notif.id;

    try {
      ensureFirebase();
      const messaging = getMessaging();

      const result = await messaging.send({
        token: target.fcm_token,
        notification: { title, body },
        data: fcmData,
        android: {
          priority: 'high',
          notification: {
            channelId: channelId || 'attendance_channel',
            priority: 'high',
            sound: 'default',
          },
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          in_app: savedInApp,
          push: true,
          notification_id: notif?.id,
          message_id: result,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (pushError) {
      const message = String(pushError);

      // A stale token fails forever. Clear it so the app can register a fresh
      // one the next time it opens.
      if (
        message.includes('registration-token-not-registered') ||
        message.includes('invalid-registration-token') ||
        message.includes('invalid-argument')
      ) {
        await admin.from('profiles').update({ fcm_token: null }).eq('id', user_id);
      }

      if (savedInApp) {
        return new Response(
          JSON.stringify({
            success: true,
            in_app: true,
            push: false,
            notification_id: notif?.id,
            warning: `Reminder saved in the app, but push failed: ${message}`,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});