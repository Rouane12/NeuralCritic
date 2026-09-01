import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigins = new Set([
  "https://www.neuralcritic.net",
  "https://neuralcritic.net"
]);

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
const resendNewsletterSegmentId = Deno.env.get("RESEND_NEWSLETTER_SEGMENT_ID") || "";

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(status: number, payload: unknown, origin: string) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cors(origin)
    }
  });
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      "apikey": serviceRoleKey,
      "authorization": `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = text; }
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}).`);
  return data;
}

async function resend(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      "authorization": `Bearer ${resendApiKey}`,
      "content-type": "application/json",
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = text; }
  return { response, data };
}

async function requireAdmin(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) throw new Error("AUTH");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error("SERVICE");

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { "apikey": anonKey, "authorization": authorization }
  });
  if (!userResponse.ok) throw new Error("AUTH");
  const user = await userResponse.json();
  const userId = String(user?.id || "");
  if (!userId) throw new Error("AUTH");

  const profiles = await rest(`editor_profiles?user_id=eq.${encodeURIComponent(userId)}&select=role&limit=1`);
  const role = Array.isArray(profiles) ? String(profiles[0]?.role || "") : "";
  if (role !== "admin") throw new Error("FORBIDDEN");
  return { userId };
}

function providerConfigured() {
  return Boolean(resendApiKey && resendNewsletterSegmentId);
}

async function ensureProviderContact(email: string, unsubscribed: boolean) {
  if (!providerConfigured()) return false;
  const create = await resend("/contacts", {
    method: "POST",
    body: JSON.stringify({ email, unsubscribed, segments: [{ id: resendNewsletterSegmentId }] })
  });
  if (create.response.ok) return true;
  if (create.response.status !== 409) throw new Error(`Resend contact create failed (${create.response.status}).`);

  const contactPath = `/contacts/${encodeURIComponent(email)}`;
  const update = await resend(contactPath, { method: "PATCH", body: JSON.stringify({ unsubscribed }) });
  if (!update.response.ok) throw new Error(`Resend contact update failed (${update.response.status}).`);

  const segment = await resend(`${contactPath}/segments/${encodeURIComponent(resendNewsletterSegmentId)}`, {
    method: "POST",
    body: "{}"
  });
  if (!segment.response.ok && segment.response.status !== 409) {
    throw new Error(`Resend segment assignment failed (${segment.response.status}).`);
  }
  return true;
}

async function listProviderContacts() {
  const contacts: Array<Record<string, unknown>> = [];
  let after = "";
  for (let page = 0; page < 100; page += 1) {
    const query = new URLSearchParams({ limit: "100" });
    if (after) query.set("after", after);
    const { response, data } = await resend(`/segments/${encodeURIComponent(resendNewsletterSegmentId)}/contacts?${query}`);
    if (!response.ok) throw new Error(`Resend segment read failed (${response.status}).`);
    const payload = data as { data?: Array<Record<string, unknown>>; has_more?: boolean } | null;
    const rows = Array.isArray(payload?.data) ? payload!.data! : [];
    contacts.push(...rows);
    if (!payload?.has_more || rows.length === 0) break;
    after = String(rows[rows.length - 1]?.id || "");
    if (!after) break;
  }
  return contacts;
}

async function updateLocalStatusByEmail(email: string, status: "active" | "unsubscribed") {
  const body = status === "unsubscribed"
    ? { status, unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    : { status, unsubscribed_at: null, updated_at: new Date().toISOString() };
  await rest(`newsletter_subscribers?email=eq.${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify(body)
  });
}

async function localSubscribers() {
  const data = await rest("newsletter_subscribers?select=id,email,status,source,joined_at,updated_at&order=joined_at.desc");
  return Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
}

async function providerStatus() {
  if (!providerConfigured()) return { configured: false, ready: false };
  const { response } = await resend(`/segments/${encodeURIComponent(resendNewsletterSegmentId)}/contacts?limit=1`);
  return { configured: true, ready: response.ok, http_status: response.status };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (!allowedOrigins.has(origin)) {
    return new Response(JSON.stringify({ ok: false, error: "Origin not allowed." }), {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed." }, origin);

  try {
    await requireAdmin(req);
    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action || "status");

    if (action === "status") {
      return json(200, { ok: true, provider: "resend", ...(await providerStatus()) }, origin);
    }

    if (action === "set_status") {
      const id = String(payload?.id || "");
      const status = String(payload?.status || "");
      if (!id || !["active", "unsubscribed"].includes(status)) return json(400, { ok: false, error: "Invalid subscriber status." }, origin);
      const rows = await rest(`newsletter_subscribers?id=eq.${encodeURIComponent(id)}&select=id,email,status&limit=1`);
      const row = Array.isArray(rows) ? rows[0] as Record<string, unknown> | undefined : undefined;
      const email = String(row?.email || "");
      if (!email) return json(404, { ok: false, error: "Subscriber not found." }, origin);

      await updateLocalStatusByEmail(email, status as "active" | "unsubscribed");
      let providerSynced = false;
      if (providerConfigured()) providerSynced = await ensureProviderContact(email, status === "unsubscribed");
      return json(200, { ok: true, status, provider_synced: providerSynced }, origin);
    }

    if (action === "sync") {
      if (!providerConfigured()) return json(503, { ok: false, error: "Newsletter delivery provider is not configured." }, origin);
      const status = await providerStatus();
      if (!status.ready) return json(503, { ok: false, error: "Newsletter delivery provider is not ready.", provider: status }, origin);

      let local = await localSubscribers();
      const providerContacts = await listProviderContacts();
      const localByEmail = new Map(local.map(row => [String(row.email || "").toLowerCase(), row]));
      let providerUnsubscribesApplied = 0;
      let providerOnlyRemoved = 0;

      for (const contact of providerContacts) {
        const email = String(contact.email || "").toLowerCase();
        const localRow = localByEmail.get(email);
        if (!localRow) {
          const remove = await resend(`/contacts/${encodeURIComponent(email)}/segments/${encodeURIComponent(resendNewsletterSegmentId)}`, { method: "DELETE" });
          if (remove.response.ok || remove.response.status === 404) providerOnlyRemoved += 1;
          continue;
        }
        if (contact.unsubscribed === true && String(localRow.status || "") !== "unsubscribed") {
          await updateLocalStatusByEmail(email, "unsubscribed");
          providerUnsubscribesApplied += 1;
        }
      }

      local = await localSubscribers();
      let synced = 0;
      for (const row of local) {
        const email = String(row.email || "").toLowerCase();
        if (!email) continue;
        await ensureProviderContact(email, String(row.status || "") === "unsubscribed");
        synced += 1;
      }

      return json(200, {
        ok: true,
        provider: "resend",
        synced,
        active: local.filter(row => row.status === "active").length,
        unsubscribed: local.filter(row => row.status === "unsubscribed").length,
        provider_unsubscribes_applied: providerUnsubscribesApplied,
        provider_only_removed: providerOnlyRemoved
      }, origin);
    }

    return json(400, { ok: false, error: "Unknown action." }, origin);
  } catch (error) {
    const code = String((error as Error)?.message || "");
    if (code === "AUTH") return json(401, { ok: false, error: "Sign in required." }, origin);
    if (code === "FORBIDDEN") return json(403, { ok: false, error: "Admin access required." }, origin);
    if (code === "SERVICE") return json(503, { ok: false, error: "Service unavailable." }, origin);
    console.error("newsletter-admin", error);
    return json(500, { ok: false, error: "Newsletter provider operation failed." }, origin);
  }
});
