import { compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { CORS, json, serviceClient } from "../_shared/auth.ts";

const MAX_FAILS = 5;
const WINDOW_MIN = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const { email, code } = await req.json().catch(() => ({}));
  if (!email || !code) return json({ error: "email and code required" }, 400);

  const admin = serviceClient();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const normalized = String(code).toUpperCase().replace(/\s+/g, "");
  const emailNorm = String(email).trim().toLowerCase();

  // Resolve user by email (paged listUsers)
  let target: { id: string; email?: string } | null = null;
  let page = 1;
  while (!target) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return json({ error: "internal" }, 500);
    target = data.users.find((u) => u.email?.toLowerCase() === emailNorm) ?? null;
    if (data.users.length < 200) break;
    page++;
  }

  const logAttempt = (success: boolean) =>
    admin.from("admin_recovery_attempts").insert({
      user_id: target?.id ?? null,
      email: emailNorm,
      ip,
      success,
    });

  if (!target) {
    await logAttempt(false);
    return json({ error: "invalid code or email" }, 400);
  }

  // Rate limit per user
  const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000).toISOString();
  const { count } = await admin
    .from("admin_recovery_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", target.id)
    .eq("success", false)
    .gte("created_at", since);

  if ((count ?? 0) >= MAX_FAILS) {
    return json({ error: "too many attempts, try again later" }, 429);
  }

  // Fetch unused codes
  const { data: rows, error: rowsErr } = await admin
    .from("admin_recovery_codes")
    .select("id, code_hash")
    .eq("user_id", target.id)
    .is("used_at", null);

  if (rowsErr) return json({ error: "internal" }, 500);

  let matchedId: string | null = null;
  for (const row of rows ?? []) {
    if (await compare(normalized, row.code_hash)) { matchedId = row.id; break; }
  }

  if (!matchedId) {
    await logAttempt(false);
    return json({ error: "invalid code or email" }, 400);
  }

  // Mark used
  const { error: updErr } = await admin
    .from("admin_recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", matchedId)
    .is("used_at", null); // guard against double-redeem race
  if (updErr) return json({ error: "internal" }, 500);

  // Mint a one-time recovery link
  const redirectTo = Deno.env.get("RECOVERY_REDIRECT_URL")!;
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: target.email!,
    options: { redirectTo },
  });
  if (linkErr || !link?.properties?.action_link) {
    return json({ error: "could not create reset link" }, 500);
  }

  await logAttempt(true);
  return json({ action_link: link.properties.action_link });
});