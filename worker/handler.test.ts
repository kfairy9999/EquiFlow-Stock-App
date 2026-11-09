import { describe, expect, it, vi } from "vitest";
import { GROK_ENDPOINT, GROK_MODEL, buildGrokMessages, buildGrokRequest, extractAnswerText } from "./grok";
import { handleApiRequest, type RateLimiter } from "./handler";
import { parseAnalyzeBody } from "./validate";

const KEY = "xai-test-key-value-0123456789";

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

describe("grok helpers", () => {
  it("tells the model the tape is simulated and is not advice", () => {
    const messages = buildGrokMessages(sampleBody);
    const system = messages.find((message) => message.role === "system")?.content ?? "";
    const user = messages.find((message) => message.role === "user")?.content ?? "";
    expect(system).toContain("simulated");
    expect(system).toContain("not investment advice");
    expect(user).toContain("AAPL");
    expect(user).toContain("150.25");
  });

  it("calls the OpenAI-compatible chat completions endpoint for grok-4.7 and keeps the key out of the body", () => {
    const request = buildGrokRequest(buildGrokMessages(sampleBody));
    expect(request.url).toBe(GROK_ENDPOINT);
    const body = JSON.parse(String(request.init.body)) as { model: string; stream: boolean; messages: unknown[] };
    expect(body.model).toBe(GROK_MODEL);
    expect(body.stream).toBe(false);
    expect(body.messages).toHaveLength(2);
    expect(JSON.stringify(body)).not.toContain(KEY);
    expect(JSON.stringify(request.init.headers)).not.toContain(KEY);
  });

  it("reads the assistant content and ignores reasoning text", () => {
    expect(
      extractAnswerText({
        choices: [
          {
            message: {
              role: "assistant",
              content: "The simulated price is sitting just above its average.",
              reasoning_content: "hidden reasoning that should not be shown",
            },
          },
        ],
      }),
    ).toBe("The simulated price is sitting just above its average.");
    expect(extractAnswerText({ choices: [{ message: { content: "   " } }] })).toBeNull();
    expect(extractAnswerText({ choices: [] })).toBeNull();
  });
});

describe("handleApiRequest", () => {
  it("reports whether a key is configured", async () => {
    const open = await handleApiRequest(new Request("https://equiflow.test/api/health"), {
      ANALYSIS_LIMITER: limiter(true),
    });
    expect(await open.json()).toMatchObject({ ok: true, analysisConfigured: false, model: GROK_MODEL });

    const ready = await handleApiRequest(new Request("https://equiflow.test/api/health"), {
      XAI_API_KEY: KEY,
      ANALYSIS_LIMITER: limiter(true),
    });
    expect(await ready.json()).toMatchObject({ analysisConfigured: true, model: GROK_MODEL, prices: "simulated-in-browser" });
  });

  it("does not call xAI when the limiter says no or the key is missing", async () => {
    const modelFetch = vi.fn<typeof fetch>();
    const limited = await handleApiRequest(post(sampleBody), { XAI_API_KEY: KEY, ANALYSIS_LIMITER: limiter(false) }, modelFetch);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");

    const unconfigured = await handleApiRequest(post(sampleBody), { ANALYSIS_LIMITER: limiter(true) }, modelFetch);
    expect(unconfigured.status).toBe(503);
    expect(modelFetch).not.toHaveBeenCalled();
  });

  it("sends the key as a Bearer token and returns only the answer text", async () => {
    const modelFetch = vi.fn<typeof fetch>(async () =>
      Response.json({
        id: "chatcmpl-test",
        object: "chat.completion",
        choices: [
          {
            message: {
              role: "assistant",
              content: "The simulated price is sitting just above its average.",
              reasoning_content: "do not show this",
            },
          },
        ],
      }),
    );
    const response = await handleApiRequest(post(sampleBody), { XAI_API_KEY: KEY, ANALYSIS_LIMITER: limiter(true) }, modelFetch);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      analysis: "The simulated price is sitting just above its average.",
      model: GROK_MODEL,
      simulated: true,
    });
    const [url, init] = modelFetch.mock.calls[0] ?? [];
    expect(url).toBe(GROK_ENDPOINT);
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${KEY}`);
    expect(String(init?.body)).not.toContain(KEY);
    const sent = JSON.parse(String(init?.body)) as { model: string };
    expect(sent.model).toBe("grok-4.7");
  });

  it("turns an upstream failure into a calm error and does not leak the key", async () => {
    const modelFetch = vi.fn<typeof fetch>(async () => new Response("nope " + KEY, { status: 500 }));
    const response = await handleApiRequest(post(sampleBody), { XAI_API_KEY: KEY, ANALYSIS_LIMITER: limiter(true) }, modelFetch);
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain(KEY);
  });
});
