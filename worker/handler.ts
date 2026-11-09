import { GROK_MODEL, buildGrokMessages, buildGrokRequest, extractAnswerText } from "./grok";
import { MAX_BODY_BYTES, parseAnalyzeBody } from "./validate";

export interface RateLimiter {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export interface ApiEnv {
  XAI_API_KEY?: string;
  ANALYSIS_LIMITER: RateLimiter;
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export async function handleApiRequest(request: Request, env: ApiEnv, modelFetch: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") return health(request, env);
  if (url.pathname === "/api/analyze") return analyze(request, env, modelFetch);
  return json({ error: "That path is not part of EquiFlow." }, 404);
}

function health(request: Request, env: ApiEnv): Response {
  if (request.method !== "GET") return methodNotAllowed("GET");
  return json({
    ok: true,
    analysisConfigured: isConfigured(env.XAI_API_KEY),
    model: GROK_MODEL,
    prices: "simulated-in-browser",
  });
}

async function analyze(request: Request, env: ApiEnv, modelFetch: typeof fetch): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const limited = await limitRequest(request, env.ANALYSIS_LIMITER);
  if (!limited.success) {
    console.log(JSON.stringify({ message: "rate_limited", path: "/api/analyze", status: 429 }));
    return json(
      { error: "That's a lot of reads in a short time. Give it about a minute, then try again." },
      429,
      { "retry-after": "60" },
    );
  }

  if (!isConfigured(env.XAI_API_KEY)) {
    return json(
      {
        error: "A written read needs an xAI key on the server. The sample tape keeps running without one.",
      },
      503,
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ error: "That request is larger than this small read accepts." }, 413);
  }

  let raw = "";
  try {
    raw = await request.text();
  } catch (error) {
    console.error(JSON.stringify({ message: "body_read_failed", error: errorText(error) }));
    return json({ error: "The request body could not be read." }, 400);
  }
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: "That request is larger than this small read accepts." }, 413);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return json({ error: "The body needs to be JSON." }, 400);
  }
  const parsed = parseAnalyzeBody(parsedJson);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const grok = buildGrokRequest(buildGrokMessages(parsed.value));
  const headers = new Headers(grok.init.headers);
  headers.set("authorization", `Bearer ${env.XAI_API_KEY ?? ""}`);

  let upstream: Response;
  try {
    upstream = await modelFetch(grok.url, { ...grok.init, headers });
  } catch (error) {
    console.error(JSON.stringify({ message: "grok_network_error", error: errorText(error) }));
    return json({ error: "Grok could not be reached. The tape is still here." }, 502);
  }

  if (!upstream.ok) {
    console.error(JSON.stringify({ message: "grok_http_error", upstreamStatus: upstream.status }));
    if (upstream.status === 429) {
      return json({ error: "Grok is busy right now. Wait a moment, then ask again." }, 503);
    }
    return json({ error: "Grok could not write a read just now. The tape is still here." }, 502);
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch (error) {
    console.error(JSON.stringify({ message: "grok_parse_error", error: errorText(error) }));
    return json({ error: "Grok replied in a shape EquiFlow could not read." }, 502);
  }

  const analysis = extractAnswerText(payload);
  if (!analysis) {
    console.error(JSON.stringify({ message: "grok_empty_answer" }));
    return json({ error: "Grok returned an empty note. Try once more." }, 502);
  }

  console.log(JSON.stringify({ message: "analyze_ok", ticker: parsed.value.ticker, status: 200 }));
  return json({
    analysis,
    model: GROK_MODEL,
    simulated: true,
  });
}

async function limitRequest(request: Request, limiter: RateLimiter): Promise<{ success: boolean }> {
  const ip =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  try {
    return await limiter.limit({ key: `analyze:${ip}` });
  } catch (error) {
    console.error(JSON.stringify({ message: "rate_limiter_failed", error: errorText(error) }));
    return { success: false };
  }
}

function isConfigured(key: string | undefined): key is string {
  return typeof key === "string" && key.trim().length >= 20;
}

function methodNotAllowed(allow: string): Response {
  return json({ error: "That method is not used here." }, 405, { allow });
}

function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...Object.fromEntries(new Headers(extra).entries()) },
  });
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}
