import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** Returns the calling user if their JWT is valid AND they are an admin. */
export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return { user: null, error: "unauthenticated" as const };

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return { user: null, error: "unauthenticated" as const };

  const admin = serviceClient();
  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr || !profile?.is_admin) return { user: null, error: "forbidden" as const };
  return { user, error: null };
}