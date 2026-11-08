import { buildAnalysisPrompt, buildGeminiRequest, extractAnswerText } from "./gemini";
import { MAX_BODY_BYTES, parseAnalyzeBody } from "./validate";

export interface RateLimiter {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export interface ApiEnv {
  GEMINI_API_KEY?: string;
  ANALYSIS_LIMITER: RateLimiter;
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export async function handleApiRequest(request: Request, env: ApiEnv, geminiFetch: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") return health(request, env);
  if (url.pathname === "/api/analyze") return analyze(request, env, geminiFetch);
  return json({ error: "That path is not part of EquiFlow." }, 404);
}

function health(request: Request, env: ApiEnv): Response {
  if (request.method !== "GET") return methodNotAllowed("GET");
  return json({
    ok: true,
    analysisConfigured: isConfigured(env.GEMINI_API_KEY),
    model: "gemini-3-flash-preview",
    prices: "simulated-in-browser",
  });
}

async function analyze(request: Request, env: ApiEnv, geminiFetch: typeof fetch): Promise<Response> {
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

  if (!isConfigured(env.GEMINI_API_KEY)) {
    return json(
      {
        error:
          "A written read needs a Gemini key on the server. The sample tape keeps running without one.",
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

  const prompt = buildAnalysisPrompt(parsed.value);
  const gemini = buildGeminiRequest(prompt);
  const headers = new Headers(gemini.init.headers);
  headers.set("x-goog-api-key", env.GEMINI_API_KEY ?? "");

  let upstream: Response;
  try {
    upstream = await geminiFetch(gemini.url, { ...gemini.init, headers });
  } catch (error) {
    console.error(JSON.stringify({ message: "gemini_network_error", error: errorText(error) }));
    return json({ error: "Gemini could not be reached. The tape is still here." }, 502);
  }

  if (!upstream.ok) {
    console.error(JSON.stringify({ message: "gemini_http_error", upstreamStatus: upstream.status }));
    if (upstream.status === 429) {
      return json({ error: "Gemini is busy right now. Wait a moment, then ask again." }, 503);
    }
    return json({ error: "Gemini could not write a read just now. The tape is still here." }, 502);
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch (error) {
    console.error(JSON.stringify({ message: "gemini_parse_error", error: errorText(error) }));
    return json({ error: "Gemini replied in a shape EquiFlow could not read." }, 502);
  }

  const analysis = extractAnswerText(payload);
  if (!analysis) {
    console.error(JSON.stringify({ message: "gemini_empty_answer" }));
    return json({ error: "Gemini returned an empty note. Try once more." }, 502);
  }

  console.log(JSON.stringify({ message: "analyze_ok", ticker: parsed.value.ticker, status: 200 }));
  return json({
    analysis,
    model: "gemini-3-flash-preview",
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
