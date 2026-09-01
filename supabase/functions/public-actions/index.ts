import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigins = new Set([
  "https://www.neuralcritic.net",
  "https://neuralcritic.net"
]);

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
const resendNewsletterSegmentId = Deno.env.get("RESEND_NEWSLETTER_SEGMENT_ID") || "";

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey",
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

function errorPayload(message: string, code = "NC_PUBLIC_ACTION") {
  return { error: message, message, code, details: null, hint: null };
}

async function rpc(name: string, body: Record<string, unknown>) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "apikey": serviceRoleKey,
      "authorization": `Bearer ${serviceRoleKey}`
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = text; }

  if (!response.ok) {
    const message = typeof data === "object" && data && "message" in data
      ? String((data as { message?: unknown }).message || "Request failed")
      : "Request failed";
    const error = new Error(message) as Error & { status?: number };
    error.status = message.toLowerCase().includes("rate limit") ? 429 : response.status;
    throw error;
  }
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

async function syncResendSubscriber(email: string) {
  if (!resendApiKey || !resendNewsletterSegmentId) return false;

  const create = await resend("/contacts", {
    method: "POST",
    body: JSON.stringify({
      email,
      unsubscribed: false,
      segments: [{ id: resendNewsletterSegmentId }]
    })
  });
  if (create.response.ok) return true;

  if (create.response.status !== 409) {
    throw new Error(`Resend contact create failed (${create.response.status}).`);
  }

  const contactPath = `/contacts/${encodeURIComponent(email)}`;
  const update = await resend(contactPath, {
    method: "PATCH",
    body: JSON.stringify({ unsubscribed: false })
  });
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

function clientIp(req: Request) {
  return (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "")
    .split(",")[0]
    .trim();
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";

  if (!allowedOrigins.has(origin)) {
    return new Response(JSON.stringify(errorPayload("Origin not allowed.", "NC_ORIGIN")), {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (req.method !== "POST") return json(405, errorPayload("Method not allowed.", "NC_METHOD"), origin);
  if (!supabaseUrl || !serviceRoleKey) return json(503, errorPayload("Service unavailable.", "NC_SERVICE"), origin);

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 4096) return json(413, errorPayload("Request too large.", "NC_SIZE"), origin);

  try {
    const payload = await req.json();
    const action = String(payload?.action || "");
    const ip = clientIp(req);

    if (action === "subscribe") {
      const email = String(payload?.email || "").trim();
      const source = String(payload?.source || "unknown").trim();
      if (!email || email.length > 254 || source.length > 160) {
        return json(400, errorPayload("Invalid subscription request.", "NC_INPUT"), origin);
      }
      const data = await rpc("edge_subscribe_newsletter", { p_email: email, p_source: source, p_ip: ip });
      let providerSynced = false;
      try {
        providerSynced = await syncResendSubscriber(email.toLowerCase());
      } catch (error) {
        console.error("newsletter provider sync", error);
      }
      const payloadData = typeof data === "object" && data && !Array.isArray(data)
        ? { ...(data as Record<string, unknown>), provider_synced: providerSynced }
        : { ok: true, provider_synced: providerSynced };
      return json(200, payloadData, origin);
    }

    if (action === "record_view") {
      const slug = String(payload?.slug || "").trim();
      if (!slug || slug.length > 200) return json(400, errorPayload("Invalid article.", "NC_INPUT"), origin);
      const data = await rpc("edge_record_article_view", { p_slug: slug, p_ip: ip });
      return json(200, data || { ok: true }, origin);
    }

    if (action === "popularity") {
      const rawDays = Number(payload?.days ?? 7);
      const days = Math.min(30, Math.max(1, Number.isFinite(rawDays) ? Math.round(rawDays) : 7));
      const data = await rpc("edge_get_article_popularity", { p_days: days, p_ip: ip });
      return json(200, Array.isArray(data) ? data : [], origin);
    }

    return json(400, errorPayload("Unknown action.", "NC_ACTION"), origin);
  } catch (error) {
    const status = Number((error as { status?: number })?.status || 500);
    const message = status === 429 ? "Too many requests. Try again later." : "Request could not be completed.";
    console.error("public-actions", error);
    return json(status, errorPayload(message, status === 429 ? "NC_RATE_LIMIT" : "NC_PUBLIC_ACTION"), origin);
  }
});
