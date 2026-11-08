import { useCallback, useEffect, useRef, useState } from "react";
import { AlertLog } from "./components/AlertLog";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { LogoMark } from "./components/Icons";
import { PriceChart } from "./components/PriceChart";
import { SearchBox } from "./components/SearchBox";
import { StatsCard } from "./components/StatsCard";
import { ThresholdControl } from "./components/ThresholdControl";
import { formatMoney, formatPercent, formatShares } from "./lib/format";
import { CHART_WINDOW, SMA_PERIOD, TICK_INTERVAL_MS, UI_COMMIT_MS, gapPercent } from "./lib/market";
import { findSymbol } from "./lib/symbols";
import { fetchAnalysisHealth, requestMarketAnalysis } from "./services/analysisClient";
import { marketService } from "./services/marketDataService";
import { ConnectionStatus, type MarketStatusInfo, type PricePoint, type VolatilityAlert } from "./types";

const FEED_LABEL: Record<ConnectionStatus, string> = {
  [ConnectionStatus.CONNECTING]: "Starting sample feed",
  [ConnectionStatus.CONNECTED]: "Sample feed running",
  [ConnectionStatus.DISCONNECTED]: "Sample feed idle",
  [ConnectionStatus.ERROR]: "Sample feed interrupted",
};

function App() {
  const [ticker, setTicker] = useState("AAPL");
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [alerts, setAlerts] = useState<VolatilityAlert[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [marketStatus, setMarketStatus] = useState<MarketStatusInfo>(marketService.getMarketStatus());
  const [threshold, setThreshold] = useState(marketService.getVolatilityThreshold());
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [offline, setOffline] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const bufferRef = useRef<PricePoint[]>([]);
  const previousPrice = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const refreshHealth = useCallback(async () => {
    const health = await fetchAnalysisHealth();
    if (!health) {
      setOffline(true);
      setConfigured(null);
      return;
    }
    setOffline(false);
    setConfigured(health.analysisConfigured);
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  useEffect(() => {
    const unsubscribeStatus = marketService.onStatusChange(setStatus);
    bufferRef.current = [];
    setPoints([]);
    setAlerts([]);
    setAnalysis(null);
    setAnalysisError(null);
    previousPrice.current = null;

    const unsubscribeTicker = marketService.subscribeToTicker(ticker, (point) => {
      bufferRef.current.push(point);
      if (bufferRef.current.length > CHART_WINDOW) bufferRef.current.shift();
    });
    const unsubscribeAlerts = marketService.onAlert((alert) => {
      setAlerts((current) => [...current.slice(-19), alert]);
      setAnnouncement(alert.message);
    });

    const paint = window.setInterval(() => {
      const next = bufferRef.current.slice();
      setPoints(next);
      setMarketStatus(marketService.getMarketStatus());
      const latest = next[next.length - 1];
      if (latest && previousPrice.current !== null && latest.price !== previousPrice.current) {
        setFlash(latest.price > previousPrice.current ? "up" : "down");
      }
      if (latest) previousPrice.current = latest.price;
    }, UI_COMMIT_MS);

    return () => {
      unsubscribeStatus();
      unsubscribeTicker();
      unsubscribeAlerts();
      window.clearInterval(paint);
    };
  }, [ticker]);

  const search = useCallback((query: string) => marketService.searchSymbols(query), []);

  const selectTicker = (symbol: string) => {
    setTicker(symbol);
    headingRef.current?.focus();
  };

  const ask = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    const result = await requestMarketAnalysis(ticker, bufferRef.current, alerts);
    if (result.ok) {
      setAnalysis(result.analysis);
    } else {
      setAnalysis(null);
      setAnalysisError(result.error);
      if (result.status === 503) void refreshHealth();
    }
    setIsAnalyzing(false);
  };

  const changeThreshold = (value: number) => {
    setThreshold(value);
    marketService.setVolatilityThreshold(value);
  };

  const symbol = findSymbol(ticker);
  const latest = points[points.length - 1];
  const change = latest ? latest.price - latest.open : 0;
  const changePercent = latest && latest.open !== 0 ? (change / latest.open) * 100 : 0;
  const trend = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const pricesPerSecond = Math.round(1000 / TICK_INTERVAL_MS);
  const gap = latest ? gapPercent(latest.price, latest.sma20) : null;
  const connected = status === ConnectionStatus.CONNECTED;

  return (
    <div className="min-h-screen text-ink">
      <a href="#prices" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2">
        Skip to prices
      </a>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="bg-clay-soft px-4 py-2 text-center text-sm text-ink sm:px-6">
        Sample prices, generated in this browser about {pricesPerSecond} times a second. Not a live market.
      </div>

      <header className="border-b border-line bg-card/80 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3 lg:w-64">
            <LogoMark />
            <div>
              <p className="font-display text-2xl leading-none text-ink">EquiFlow</p>
              <p className="mt-1 text-sm text-muted">A sample market</p>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <SearchBox onSearch={search} onSelect={selectTicker} />
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <p className="rounded-full border border-line bg-paper px-3 py-2 text-sm">
              <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${marketStatus.isOpen ? "bg-gain" : "bg-muted"}`} aria-hidden="true" />
              <span className="font-bold">{marketStatus.message}</span>
              <span className="text-muted"> · {marketStatus.countdown}</span>
            </p>
            <p className="rounded-full border border-line bg-paper px-3 py-2 text-sm" role="status">
              <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${connected ? "bg-gain" : "bg-clay"}`} aria-hidden="true" />
              {FEED_LABEL[status]}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:px-8 lg:py-8">
        <section className="order-1 space-y-6 lg:col-start-1" id="prices">
          <div>
            <p className="text-sm font-bold tracking-[0.14em] text-clay uppercase">Simulated</p>
            <h1 ref={headingRef} tabIndex={-1} className="mt-1 font-display text-4xl text-ink outline-none sm:text-5xl">
              {symbol?.name ?? ticker}
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">
              {ticker}
              {symbol ? ` · ${symbol.sector}` : ""}. You are watching a made-up tape. The average and the notes use real arithmetic on those made-up prices.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatsCard
              label="Latest price"
              value={latest ? formatMoney(latest.price) : "—"}
              hint={latest ? `${formatMoney(Math.abs(change))} (${formatPercent(changePercent)})` : "Waiting for the first price"}
              trend={latest ? trend : "neutral"}
              detail="Since you opened this symbol"
              flash={flash}
              flashKey={latest?.timestamp ?? 0}
            />
            <StatsCard
              label="SMA-20"
              value={latest?.sma20 ? formatMoney(latest.sma20) : "—"}
              detail={
                latest?.sma20
                  ? "Average of the last 20 prices"
                  : `${Math.min(points.length, SMA_PERIOD)} of ${SMA_PERIOD} prices so far`
              }
            />
            <StatsCard
              label="High"
              value={latest ? formatMoney(latest.high) : "—"}
              detail={latest ? `Low ${formatMoney(latest.low)}` : "Since you opened this symbol"}
            />
            <StatsCard
              label="Simulated volume"
              value={latest ? formatShares(latest.cumulativeVolume) : "—"}
              detail="Random print sizes, not exchange volume"
            />
          </div>

          <section className="rounded-3xl border border-line bg-card p-3 shadow-[0_16px_36px_-24px_rgba(80,48,20,0.45)] sm:p-4" aria-labelledby="chart-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-1">
              <div>
                <h2 id="chart-heading" className="font-display text-2xl text-ink">
                  The last few moments
                </h2>
                <p className="text-sm text-muted">
                  About {pricesPerSecond} simulated prices a second. The marks along the bottom are seconds since the oldest price still in view.
                </p>
              </div>
              <ul className="flex flex-wrap gap-3 text-sm text-ink">
                <li className="inline-flex items-center gap-2">
                  <span className="inline-block h-1 w-6 rounded-full bg-clay" aria-hidden="true" />
                  Price
                </li>
                <li className="inline-flex items-center gap-2">
                  <span className="inline-block h-0 w-6 border-t-2 border-dashed border-sma" aria-hidden="true" />
                  SMA-20
                </li>
              </ul>
            </div>
            <div className="h-72 sm:h-96 lg:h-[28rem]">
              <PriceChart data={points} ticker={ticker} />
            </div>
          </section>
        </section>

        <aside className="order-2 space-y-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <ThresholdControl value={threshold} gap={gap} pricesSeen={points.length} onChange={changeThreshold} />
          <div className="min-h-80 lg:min-h-[28rem]">
            <AlertLog alerts={alerts} pricesSeen={points.length} thresholdPercent={threshold} />
          </div>
        </aside>

        <div className="order-3 lg:col-start-1">
          <AnalysisPanel
            analysis={analysis}
            error={analysisError}
            busy={isAnalyzing}
            configured={configured}
            offline={offline}
            canAsk={connected && points.length > 0}
            onAsk={() => void ask()}
            onRetryHealth={() => void refreshHealth()}
          />
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-sm leading-relaxed text-muted sm:px-6 lg:px-8">
        <p>
          The cash-session clock follows weekday hours in New York, 9:30 a.m. to 4:00 p.m. It does not know about holidays or early closes.
          Nothing on this page is investment advice.
        </p>
      </footer>
    </div>
  );
}

export default App;
