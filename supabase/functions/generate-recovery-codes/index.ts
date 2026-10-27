import { hash, genSalt } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { CORS, json, requireAdmin, serviceClient } from "../_shared/auth.ts";

function makeCode() {
  // 10 chars from an unambiguous alphabet, grouped XXXX-XXXX-XX
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const raw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const { user, error } = await requireAdmin(req);
  if (error === "unauthenticated") return json({ error }, 401);
  if (error === "forbidden") return json({ error }, 403);

  const body = await req.json().catch(() => ({}));
  const count = Math.min(Math.max(Number(body.count) || 10, 5), 20);
  const label = typeof body.label === "string" ? body.label.slice(0, 120) : null;

  const admin = serviceClient();

  // Invalidate unused codes for this admin.
  const { error: delErr } = await admin
    .from("admin_recovery_codes")
    .delete()
    .eq("user_id", user!.id)
    .is("used_at", null);
  if (delErr) return json({ error: "could not clear old codes" }, 500);

  const plaintext: string[] = [];
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const code = makeCode();
    const salt = await genSalt(10);
    const code_hash = await hash(code, salt);
    plaintext.push(code);
    rows.push({ user_id: user!.id, code_hash, label });
  }

  const { error: insErr } = await admin.from("admin_recovery_codes").insert(rows);
  if (insErr) return json({ error: "could not save codes" }, 500);

  // Plaintext returned ONCE, never stored.
  return json({ codes: plaintext });
});