import { MAX_THRESHOLD_PERCENT, MIN_THRESHOLD_PERCENT } from "../lib/market";

interface ThresholdControlProps {
  value: number;
  gap: number | null;
  pricesSeen: number;
  onChange: (value: number) => void;
}

export function ThresholdControl({ value, gap, pricesSeen, onChange }: ThresholdControlProps) {
  const gapText =
    gap === null
      ? `The average needs 20 prices. ${Math.max(20 - pricesSeen, 0)} to go.`
      : `Right now the price is ${Math.abs(gap).toFixed(2)}% ${gap >= 0 ? "above" : "below"} that average.`;

  return (
    <section className="rounded-3xl border border-line bg-card p-5 shadow-[0_16px_36px_-24px_rgba(80,48,20,0.45)]" aria-labelledby="gap-heading">
      <h2 id="gap-heading" className="font-display text-2xl text-ink">
        How close to watch
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        SMA-20 is the average of the last 20 simulated prices. Choose how far the price may wander before EquiFlow leaves a note.
      </p>
      <div className="mt-5">
        <div className="flex items-end justify-between gap-3">
          <label htmlFor="threshold" className="text-sm font-bold text-ink">
            Gap that earns a note
          </label>
          <p className="font-sans text-2xl font-bold tabular-nums text-clay">{value.toFixed(1)}%</p>
        </div>
        <input
          id="threshold"
          type="range"
          min={MIN_THRESHOLD_PERCENT}
          max={MAX_THRESHOLD_PERCENT}
          step={0.1}
          value={value}
          aria-valuemin={MIN_THRESHOLD_PERCENT}
          aria-valuemax={MAX_THRESHOLD_PERCENT}
          aria-valuenow={value}
          aria-valuetext={`${value.toFixed(1)} percent away from the average`}
          onChange={(event) => onChange(Number(event.target.value))}
          className="mt-3 h-2 w-full cursor-pointer accent-clay"
        />
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>Closer, {MIN_THRESHOLD_PERCENT.toFixed(1)}%</span>
          <span>Quieter, {MAX_THRESHOLD_PERCENT.toFixed(1)}%</span>
        </div>
      </div>
      <p className="mt-4 rounded-2xl bg-paper px-3 py-3 text-sm leading-relaxed text-ink" role="status">
        {gapText}
      </p>
    </section>
  );
}
