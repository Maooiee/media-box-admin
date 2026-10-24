// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Generates a strong random password, e.g. "kR7-mQp2-Xwv9".
// Ambiguous characters (0/O, 1/l/I) are excluded so it is easy to read aloud.
function generateTemporaryPassword() {
  const lowers = 'abcdefghijkmnpqrstuvwxyz';
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const specials = '!@#$%&*?';

  const all = lowers + uppers + digits + specials;
  const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];

  // Guarantee at least one character from every class
  let chars = [pick(lowers), pick(uppers), pick(digits), pick(specials)];
  while (chars.length < 14) chars.push(pick(all));

  // Fisher–Yates shuffle so the mandatory characters are not positionally fixed
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  // Group into readable blocks of 4: aB3x-k9Qm-Zt7R
  return chars
    .join('')
    .replace(/(.{4})/g, '$1-')
    .replace(/-$/, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !user) {
      return json({ error: 'Invalid auth token' }, 401);
    }

    const { data: profile } = await userClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      return json({ error: 'Not an admin' }, 403);
    }

    const { user_id, password } = await req.json();

    if (!user_id) {
      return json({ error: 'Missing required field: user_id' }, 400);
    }

    const temporary = !password;
    const newPassword = password || generateTemporaryPassword();

    if (!temporary && newPassword.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(
      user_id,
      { password: newPassword }
    );

    if (updateErr) {
      return json({ error: updateErr.message }, 400);
    }

    // The password is returned exactly once so the admin can share it securely.
    return json({ success: true, password: newPassword, temporary });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
