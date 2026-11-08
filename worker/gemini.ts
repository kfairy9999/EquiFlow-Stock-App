/** Verified against Google's Gemini 3 docs on 8 Nov 2026. Still a preview model, not retired. */
export const GEMINI_MODEL = "gemini-3-flash-preview";

export const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface GeminiPart {
  text?: string;
  thought?: boolean;
}

export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

export function buildAnalysisPrompt(input: {
  ticker: string;
  points: Array<{ timestamp: number; price: number; sma20: number | null }>;
  alerts: Array<{ type: string; message: string }>;
}): string {
  const rows = input.points
    .map((point) => {
      const clock = new Date(point.timestamp).toISOString();
      const average = point.sma20 === null ? "n/a" : point.sma20.toFixed(2);
      return `${clock} price ${point.price.toFixed(2)} sma20 ${average}`;
    })
    .join("\n");
  const notes = input.alerts.map((alert) => `${alert.type}: ${alert.message}`).join("\n");

  return [
    "You are writing a short, calm note for a person learning how a price chart behaves.",
    "The prices below are simulated inside a web browser. They are not quotes from an exchange.",
    "Do not tell the reader to buy, sell, or hold anything. This is not investment advice.",
    "Write at most three sentences, in plain language.",
    "Say whether the latest simulated price is above, below, or touching its 20-price average, and whether the recent notes suggest a jumpy tape.",
    `Symbol: ${input.ticker}`,
    "Recent simulated prices:",
    rows || "(none)",
    "Recent notes:",
    notes || "(none)",
  ].join("\n");
}

export function buildGeminiRequest(prompt: string): { url: string; init: RequestInit } {
  return {
    url: GEMINI_ENDPOINT,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
    },
  };
}

/**
 * Gemini 3 can return thought parts before the answer. Keep the non-thought text.
 */
export function extractAnswerText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = (payload as GeminiResponse).candidates;
  const parts = candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .filter((part) => part.thought !== true && typeof part.text === "string")
    .map((part) => part.text?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join("\n")
    .trim();
  return text.length > 0 ? text : null;
}
