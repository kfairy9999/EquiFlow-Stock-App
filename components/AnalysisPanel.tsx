interface AnalysisPanelProps {
  analysis: string | null;
  error: string | null;
  busy: boolean;
  configured: boolean | null;
  offline: boolean;
  canAsk: boolean;
  onAsk: () => void;
  onRetryHealth: () => void;
}

export function AnalysisPanel({
  analysis,
  error,
  busy,
  configured,
  offline,
  canAsk,
  onAsk,
  onRetryHealth,
}: AnalysisPanelProps) {
  const statusText = busy
    ? "Reading the last few simulated prices…"
    : error
      ? error
      : analysis
        ? analysis
        : offline
          ? "The written read needs the small API beside this page. The chart does not. Start both with npm run dev, then check again."
          : configured === false
            ? "Add an xAI key on the server when you want a written read. Watching the tape does not need one."
            : "When you ask, Grok reads the latest simulated prices and any notes, then describes them in a few sentences. It is a sketch of this tape, not advice.";

  return (
    <section className="rounded-3xl border border-line bg-card p-5 shadow-[0_16px_36px_-24px_rgba(80,48,20,0.45)] sm:p-6" aria-labelledby="read-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-clay uppercase">Optional</p>
          <h2 id="read-heading" className="mt-1 font-display text-3xl text-ink">
            A short read
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Grok 4.7 looks at this simulated tape. The key stays on the server. The words are not a recommendation.
          </p>
        </div>
        <button
          type="button"
          onClick={onAsk}
          disabled={busy || !canAsk || configured === false || offline}
          className="min-h-12 shrink-0 rounded-full bg-clay px-5 py-3 text-base font-bold text-white transition hover:bg-clay-deep disabled:cursor-not-allowed disabled:bg-paper-deep disabled:text-muted"
        >
          {busy ? "Reading…" : "Write a read"}
        </button>
      </div>
      <div
        className={`mt-5 rounded-2xl px-4 py-4 text-sm leading-relaxed ${
          error ? "bg-loss-soft text-loss" : "bg-paper text-ink"
        }`}
        role="status"
        aria-live="polite"
      >
        {statusText}
      </div>
      {(offline || configured === false) && (
        <button type="button" onClick={onRetryHealth} className="mt-3 text-sm font-bold text-clay underline-offset-4 hover:underline">
          Check again
        </button>
      )}
    </section>
  );
}
