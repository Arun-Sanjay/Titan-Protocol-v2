/**
 * delete-account — Supabase Edge Function
 *
 * Permanently deletes the CALLING user's account: the auth.users row,
 * which cascades through the FK graph (profiles.id → auth.users.id ON
 * DELETE CASCADE; every public table → profiles ON DELETE CASCADE;
 * xp_log → auth.users CASCADE). One call erases the account and all of
 * its data.
 *
 * AUTH: deployed with verify_jwt=true. The target is resolved from the
 * caller's OWN JWT via auth.getUser() — there is no user_id parameter,
 * so it is impossible to delete anyone else's account. A bare anon or
 * service key carries no user and is rejected.
 *
 * Required client-side because (by design) `profiles` has no DELETE RLS
 * policy and clients cannot touch auth.users — deletion must run with
 * the service role, server-side.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: "Server misconfiguration" }, 500);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Unauthorized" }, 401);

  // Resolve the caller from their own token.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: delErr } = await admin.auth.admin.deleteUser(
    userData.user.id,
  );
  if (delErr) {
    return json({ error: delErr.message }, 500);
  }

  return json({ deleted: true }, 200);
});

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
