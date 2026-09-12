import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_DISPATCH_TOKEN") || "";
const GITHUB_WORKFLOW = "fast-publish-story.yml";
const GITHUB_DISPATCH_URL = `https://api.github.com/repos/Rouane12/NeuralCritic/actions/workflows/${GITHUB_WORKFLOW}/dispatches`;
const ALLOWED_ORIGINS = new Set([
  "https://www.neuralcritic.net",
  "https://neuralcritic.net",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://www.neuralcritic.net",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(req, { error: "Supabase server configuration is unavailable" }, 503);
  }

  const authorization = req.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json(req, { error: "Unauthorized" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return json(req, { error: "Unauthorized" }, 401);
  }

  const { data: editor, error: editorError } = await admin
    .from("editor_profiles")
    .select("user_id,role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (editorError) {
    return json(req, { error: "Could not verify editor access" }, 500);
  }
  if (!editor) {
    return json(req, { error: "Approved editor access is required" }, 403);
  }

  let payload: { slug?: unknown } = {};
  try {
    payload = await req.json();
  } catch (_) {
    return json(req, { error: "Invalid JSON body" }, 400);
  }

  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
    return json(req, { error: "A valid article slug is required" }, 400);
  }

  const { data: article, error: articleError } = await admin
    .from("articles")
    .select("slug,status")
    .eq("slug", slug)
    .maybeSingle();
  if (articleError) {
    return json(req, { error: "Could not verify the published article" }, 500);
  }
  if (!article || article.status !== "published") {
    return json(req, { error: "Article must be published before refreshing discovery files" }, 409);
  }

  if (!GITHUB_TOKEN) {
    return json(req, {
      error: "GITHUB_DISPATCH_TOKEN is not configured",
      setup_required: true,
      fallback: "The scheduled publication refresh remains active.",
    }, 503);
  }

  const githubResponse = await fetch(GITHUB_DISPATCH_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "Neural-Critic-Publication-Refresh",
    },
    body: JSON.stringify({ ref: "main", inputs: { slug } }),
  });

  if (!githubResponse.ok) {
    const requestId = githubResponse.headers.get("x-github-request-id") || null;
    return json(req, {
      error: "GitHub publication refresh dispatch failed",
      github_status: githubResponse.status,
      github_request_id: requestId,
      fallback: "The scheduled publication refresh remains active.",
    }, 502);
  }

  return json(req, {
    ok: true,
    slug,
    workflow: GITHUB_WORKFLOW,
    ref: "main",
    canonical_url: `https://www.neuralcritic.net/stories/${encodeURIComponent(slug)}/`,
  }, 202);
});
