import { formatClock } from "../lib/format";
import type { VolatilityAlert } from "../types";

interface AlertLogProps {
  alerts: VolatilityAlert[];
  pricesSeen: number;
  thresholdPercent: number;
}

export function AlertLog({ alerts, pricesSeen, thresholdPercent }: AlertLogProps) {
  const newestFirst = [...alerts].reverse();
  return (
    <section className="flex h-full flex-col rounded-3xl border border-line bg-card shadow-[0_16px_36px_-24px_rgba(80,48,20,0.45)]" aria-labelledby="notes-heading">
      <div className="border-b border-line px-5 py-4">
        <h2 id="notes-heading" className="font-display text-2xl text-ink">
          Notes
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          A note appears when the price is more than {thresholdPercent.toFixed(1)}% away from the 20-price average. The same move will not be repeated for 5 seconds.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {newestFirst.length === 0 ? (
          <div className="rounded-2xl bg-paper px-4 py-5" role="status">
            <p className="font-bold text-ink">The tape is calm.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {pricesSeen < 20
                ? `The average needs 20 prices before it can be compared. ${20 - pricesSeen} to go.`
                : "Nothing has wandered far enough from the average to mention. Lower the gap if you would like a closer watch."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {newestFirst.map((alert) => {
              const large = alert.severity === "high";
              const up = alert.type === "SPIKE";
              return (
                <li
                  key={alert.id}
                  className={`rounded-2xl border px-4 py-3 ${
                    up ? "border-gain/30 bg-gain-soft" : "border-loss/30 bg-loss-soft"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-sm font-bold ${up ? "text-gain" : "text-loss"}`}>
                      {up ? "Above the average" : "Below the average"}
                      <span className="sr-only">, {large ? "large gap" : "notable gap"}</span>
                    </p>
                    <p className={`rounded-full px-2 py-0.5 text-xs font-bold ${large ? "bg-card text-ink" : "bg-card/70 text-muted"}`}>
                      {large ? "Large gap" : "Notable"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink">{alert.message}</p>
                  <p className="mt-1 text-xs text-muted">
                    <time dateTime={new Date(alert.timestamp).toISOString()}>{formatClock(alert.timestamp)}</time>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
