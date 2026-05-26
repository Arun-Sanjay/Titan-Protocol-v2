/**
 * send-push — Supabase Edge Function
 *
 * Triggered server-side (pg_cron daily streak warning; future Postgres
 * triggers on achievements_unlocked). Reads the target user's Expo push
 * token from `profiles.expo_push_token` and POSTs to the Expo Push API.
 *
 * Body shape:
 *   {
 *     user_id: string,        // required
 *     title: string,          // required
 *     body: string,           // required
 *     data?: Record<string, unknown>  // optional payload routed via the notif
 *   }
 *
 * Security note: this function is deployed with `verify_jwt: false` to let
 * the in-database cron call it without managing JWTs. The function only
 * sends to a token that already lives on the user's own profile row, so
 * an anonymous caller can at worst trigger an unsolicited push to a user
 * for whom they already know the user_id. Rate limiting + a proper signed
 * secret are post-launch hardening — see `supabase/functions/send-push/
 * README.md` for the plan.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface RequestBody {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload: RequestBody;
  try {
    payload = (await req.json()) as RequestBody;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!payload.user_id || !payload.title || !payload.body) {
    return json(
      { error: "user_id, title, and body are required" },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server misconfiguration" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("expo_push_token")
    .eq("id", payload.user_id)
    .maybeSingle();

  if (error) {
    return json({ error: error.message }, 500);
  }
  if (!profile?.expo_push_token) {
    return json({ skipped: true, reason: "no_token" }, 200);
  }

  const expoRes = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      to: profile.expo_push_token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: "default",
      priority: "high",
      channelId: "default",
    }),
  });

  const expoBody = await expoRes.json();

  // Expo returns DeviceNotRegistered for a stale token; clear it so
  // future invocations skip cleanly.
  const ticketStatus =
    Array.isArray(expoBody?.data) ? expoBody.data[0]?.status : null;
  const ticketError =
    Array.isArray(expoBody?.data) ? expoBody.data[0]?.details?.error : null;
  if (ticketStatus === "error" && ticketError === "DeviceNotRegistered") {
    await supabase
      .from("profiles")
      .update({ expo_push_token: null })
      .eq("id", payload.user_id);
  }

  return json({ sent: true, expo: expoBody }, 200);
});

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
