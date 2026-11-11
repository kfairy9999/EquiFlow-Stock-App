import type { PricePoint, VolatilityAlert } from "../types";

export interface AnalysisHealth {
  ok: boolean;
  analysisConfigured: boolean;
}

export type AnalysisResult =
  | { ok: true; analysis: string }
  | { ok: false; status: number; error: string };

export async function fetchAnalysisHealth(): Promise<AnalysisHealth | null> {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) return null;
    const body = (await response.json()) as Partial<AnalysisHealth>;
    return {
      ok: body.ok === true,
      analysisConfigured: body.analysisConfigured === true,
    };
  } catch {
    return null;
  }
}

export async function requestMarketAnalysis(
  ticker: string,
  points: PricePoint[],
  alerts: VolatilityAlert[],
): Promise<AnalysisResult> {
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ticker,
        points: points.slice(-50).map((point) => ({
          timestamp: point.timestamp,
          price: point.price,
          sma20: point.sma20,
        })),
        alerts: alerts.slice(-3).map((alert) => ({
          type: alert.type,
          message: alert.message,
        })),
      }),
    });
    const body = (await response.json().catch(() => null)) as { analysis?: string; error?: string } | null;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: body?.error ?? "The written read did not come back. The tape is still running.",
      };
    }
    if (!body?.analysis) {
      return { ok: false, status: response.status, error: "The read came back empty." };
    }
    return { ok: true, analysis: body.analysis };
  } catch {
    return {
      ok: false,
      status: 0,
      error: "The analysis service is not reachable. If you are running this locally, start it with npm run dev.",
    };
  }
}
