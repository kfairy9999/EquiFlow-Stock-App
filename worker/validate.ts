export interface AnalyzePoint {
  timestamp: number;
  price: number;
  sma20: number | null;
}

export interface AnalyzeAlert {
  type: string;
  message: string;
}

export interface AnalyzeInput {
  ticker: string;
  points: AnalyzePoint[];
  alerts: AnalyzeAlert[];
}

const TICKER = /^[A-Za-z0-9.-]{1,12}$/;
const ALERT_TYPES = new Set(["SPIKE", "DROP", "HIGH_VOLATILITY"]);

export const MAX_BODY_BYTES = 20_000;

export function parseAnalyzeBody(body: unknown): { ok: true; value: AnalyzeInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Send a JSON object with a ticker and a few prices." };
  }
  const record = body as Record<string, unknown>;
  if (typeof record.ticker !== "string" || !TICKER.test(record.ticker)) {
    return { ok: false, error: "The ticker needs to be 1–12 letters or numbers." };
  }
  if (!Array.isArray(record.points) || record.points.length < 1 || record.points.length > 60) {
    return { ok: false, error: "Include between 1 and 60 recent prices." };
  }
  const points: AnalyzePoint[] = [];
  for (const point of record.points) {
    const parsed = parsePoint(point);
    if (!parsed) return { ok: false, error: "Each price needs a timestamp and a finite number." };
    points.push(parsed);
  }
  const alerts: AnalyzeAlert[] = [];
  const rawAlerts = record.alerts === undefined ? [] : record.alerts;
  if (!Array.isArray(rawAlerts) || rawAlerts.length > 5) {
    return { ok: false, error: "Send at most 5 recent notes." };
  }
  for (const alert of rawAlerts) {
    const parsed = parseAlert(alert);
    if (!parsed) return { ok: false, error: "A note needs a short type and message." };
    alerts.push(parsed);
  }
  return { ok: true, value: { ticker: record.ticker.toUpperCase(), points, alerts } };
}

function parsePoint(value: unknown): AnalyzePoint | null {
  if (!value || typeof value !== "object") return null;
  const point = value as Record<string, unknown>;
  if (typeof point.timestamp !== "number" || !Number.isFinite(point.timestamp)) return null;
  if (typeof point.price !== "number" || !Number.isFinite(point.price)) return null;
  if (point.sma20 !== null && (typeof point.sma20 !== "number" || !Number.isFinite(point.sma20))) return null;
  return { timestamp: point.timestamp, price: point.price, sma20: point.sma20 };
}

function parseAlert(value: unknown): AnalyzeAlert | null {
  if (!value || typeof value !== "object") return null;
  const alert = value as Record<string, unknown>;
  if (typeof alert.type !== "string" || !ALERT_TYPES.has(alert.type)) return null;
  if (typeof alert.message !== "string" || alert.message.length < 1 || alert.message.length > 180) return null;
  return { type: alert.type, message: alert.message };
}
