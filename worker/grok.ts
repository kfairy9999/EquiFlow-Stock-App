/**
 * Verified against xAI docs on 9 Nov 2026.
 * Models page: https://docs.x.ai/docs/models — Grok 4.7 is the recommended text model.
 * Request shape: https://docs.x.ai/developers/model-capabilities/legacy/chat-completions
 *   POST https://api.x.ai/v1/chat/completions
 *   Authorization: Bearer $XAI_API_KEY
 *   { model: "grok-4.7", messages: [{ role, content }], stream: false }
 * The answer text is choices[0].message.content.
 * xAI labels this OpenAI-compatible endpoint as legacy and recommends the Responses API
 * for new features. This one-shot note uses chat completions so the call stays stateless.
 */
export const GROK_MODEL = "grok-4.7";

export const GROK_ENDPOINT = "https://api.x.ai/v1/chat/completions";

export interface GrokMessage {
  role: "system" | "user";
  content: string;
}

export function buildGrokMessages(input: {
  ticker: string;
  points: Array<{ timestamp: number; price: number; sma20: number | null }>;
  alerts: Array<{ type: string; message: string }>;
}): GrokMessage[] {
  const rows = input.points
    .map((point) => {
      const clock = new Date(point.timestamp).toISOString();
      const average = point.sma20 === null ? "n/a" : point.sma20.toFixed(2);
      return `${clock} price ${point.price.toFixed(2)} sma20 ${average}`;
    })
    .join("\n");
  const notes = input.alerts.map((alert) => `${alert.type}: ${alert.message}`).join("\n");

  return [
    {
      role: "system",
      content: [
        "You write a short, calm note for a person learning how a price chart behaves.",
        "The prices you are given are simulated inside a web browser. They are not quotes from an exchange.",
        "Do not tell the reader to buy, sell, or hold anything. This is not investment advice.",
        "Write at most three sentences, in plain language.",
        "Say whether the latest simulated price is above, below, or touching its 20-price average, and whether the recent notes suggest a jumpy tape.",
      ].join(" "),
    },
    {
      role: "user",
      content: [`Symbol: ${input.ticker}`, "Recent simulated prices:", rows || "(none)", "Recent notes:", notes || "(none)"].join("\n"),
    },
  ];
}

export function buildGrokRequest(messages: GrokMessage[]): { url: string; init: RequestInit } {
  return {
    url: GROK_ENDPOINT,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: GROK_MODEL,
        stream: false,
        messages,
      }),
    },
  };
}

/**
 * Chat completions puts the visible answer in message.content.
 * Reasoning text, when present, is a separate field and is not shown.
 */
export function extractAnswerText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return null;
  const first = choices[0];
  if (!first || typeof first !== "object") return null;
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as { content?: unknown }).content;
  const text = readContent(content);
  return text.length > 0 ? text : null;
}

function readContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
      return "";
    })
    .join("")
    .trim();
}
