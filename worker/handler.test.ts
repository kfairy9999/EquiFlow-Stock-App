import { describe, expect, it, vi } from "vitest";
import { extractAnswerText, buildAnalysisPrompt, buildGeminiRequest, GEMINI_MODEL } from "./gemini";
import { handleApiRequest, type RateLimiter } from "./handler";
import { parseAnalyzeBody } from "./validate";

const KEY = "test-gemini-key-value-0123456789";

function limiter(success: boolean): RateLimiter {
  return { limit: vi.fn(async () => ({ success })) };
}

function post(body: unknown, headers?: HeadersInit): Request {
  return new Request("https://equiflow.test/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const sampleBody = {
  ticker: "aapl",
  points: [
    { timestamp: 1_700_000_000_000, price: 150.25, sma20: 149.8 },
    { timestamp: 1_700_000_000_200, price: 150.4, sma20: 149.9 },
  ],
  alerts: [{ type: "SPIKE", message: "AAPL is $1.20 above its 20-price average." }],
};

describe("parseAnalyzeBody", () => {
  it("accepts a small tape and uppercases the ticker", () => {
    const parsed = parseAnalyzeBody(sampleBody);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.ticker).toBe("AAPL");
  });

  it("rejects an oversized tape, a bad ticker, and an unknown note type", () => {
    expect(parseAnalyzeBody({ ticker: "AAPL", points: [] }).ok).toBe(false);
    expect(parseAnalyzeBody({ ticker: "too long for this", points: sampleBody.points }).ok).toBe(false);
    expect(
      parseAnalyzeBody({
        ticker: "AAPL",
        points: sampleBody.points,
        alerts: [{ type: "MOON", message: "nope" }],
      }).ok,
    ).toBe(false);
  });
});

describe("gemini helpers", () => {
  it("tells the model the tape is simulated and is not advice", () => {
    const prompt = buildAnalysisPrompt(sampleBody);
    expect(prompt).toContain("simulated");
    expect(prompt).toContain("not investment advice");
    expect(prompt).toContain("AAPL");
    expect(prompt).toContain("150.25");
  });

  it("asks Gemini 3 Flash at a low thinking level and keeps the key out of the body", () => {
    const request = buildGeminiRequest("hello");
    expect(request.url).toContain(GEMINI_MODEL);
    const body = String(request.init.body);
    expect(body).toContain('"thinkingLevel":"low"');
    expect(body).not.toContain("api");
    expect(body).not.toContain(KEY);
  });

  it("skips thought parts and blank parts", () => {
    expect(
      extractAnswerText({
        candidates: [
          {
            content: {
              parts: [{ text: "thinking out loud", thought: true }, { text: "\n" }, { text: "Price is above the average." }],
            },
          },
        ],
      }),
    ).toBe("Price is above the average.");
    expect(extractAnswerText({ candidates: [] })).toBeNull();
  });
});

describe("handleApiRequest", () => {
  it("reports whether a key is configured", async () => {
    const open = await handleApiRequest(new Request("https://equiflow.test/api/health"), {
      ANALYSIS_LIMITER: limiter(true),
    });
    expect(await open.json()).toMatchObject({ ok: true, analysisConfigured: false });

    const ready = await handleApiRequest(new Request("https://equiflow.test/api/health"), {
      GEMINI_API_KEY: KEY,
      ANALYSIS_LIMITER: limiter(true),
    });
    expect(await ready.json()).toMatchObject({ analysisConfigured: true, prices: "simulated-in-browser" });
  });

  it("does not call Gemini when the limiter says no or the key is missing", async () => {
    const geminiFetch = vi.fn<typeof fetch>();
    const limited = await handleApiRequest(
      post(sampleBody),
      { GEMINI_API_KEY: KEY, ANALYSIS_LIMITER: limiter(false) },
      geminiFetch,
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");

    const unconfigured = await handleApiRequest(
      post(sampleBody),
      { ANALYSIS_LIMITER: limiter(true) },
      geminiFetch,
    );
    expect(unconfigured.status).toBe(503);
    expect(geminiFetch).not.toHaveBeenCalled();
  });

  it("sends the key as a header and returns only the answer text", async () => {
    const geminiFetch = vi.fn<typeof fetch>(async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: "hidden reasoning" },
                { text: "The simulated price is sitting just above its average." },
              ],
            },
          },
        ],
      }),
    );
    const response = await handleApiRequest(
      post(sampleBody),
      { GEMINI_API_KEY: KEY, ANALYSIS_LIMITER: limiter(true) },
      geminiFetch,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      analysis: "The simulated price is sitting just above its average.",
      model: GEMINI_MODEL,
      simulated: true,
    });
    const [, init] = geminiFetch.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get("x-goog-api-key")).toBe(KEY);
    expect(String(init?.body)).not.toContain(KEY);
  });

  it("turns an upstream failure into a calm error and does not leak the key", async () => {
    const geminiFetch = vi.fn<typeof fetch>(async () => new Response("nope " + KEY, { status: 500 }));
    const response = await handleApiRequest(
      post(sampleBody),
      { GEMINI_API_KEY: KEY, ANALYSIS_LIMITER: limiter(true) },
      geminiFetch,
    );
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain(KEY);
  });
});
