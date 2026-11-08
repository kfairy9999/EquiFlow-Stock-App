import {
  ALERT_COOLDOWN_MS,
  DEFAULT_THRESHOLD_PERCENT,
  TICK_INTERVAL_MS,
  applyTick,
  createTape,
  getUsCashSession,
  type TapeState,
} from "../lib/market";
import { findSymbol, searchSymbols } from "../lib/symbols";
import type { ConnectionStatus, PricePoint, SearchResult, VolatilityAlert } from "../types";
import { ConnectionStatus as Status } from "../types";

type Listener<T> = (data: T) => void;

/**
 * In-browser sample tape.
 * This is not a WebSocket and it does not talk to an exchange.
 * Subscribers observe prices the way a socket client would, so the screen
 * can be built against a stream even though the stream is generated here.
 */
class MarketDataService {
  private subscribers: Listener<PricePoint>[] = [];
  private alertSubscribers: Listener<VolatilityAlert>[] = [];
  private statusSubscribers: Listener<ConnectionStatus>[] = [];
  private intervalId: number | null = null;
  private connectTimer: number | null = null;
  private currentTicker = "AAPL";
  private tape: TapeState = createTape(150);
  private status: ConnectionStatus = Status.DISCONNECTED;
  private thresholdPercent = DEFAULT_THRESHOLD_PERCENT;

  constructor() {
    this.start();
  }

  getMarketStatus() {
    return getUsCashSession(new Date());
  }

  async searchSymbols(query: string): Promise<SearchResult[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return searchSymbols(query);
  }

  subscribeToTicker(ticker: string, callback: Listener<PricePoint>) {
    const next = ticker.toUpperCase();
    if (next !== this.currentTicker) {
      this.currentTicker = next;
      const symbol = findSymbol(next);
      this.tape = createTape(symbol?.price ?? 100);
      this.updateStatus(Status.CONNECTING);
      if (this.connectTimer !== null) window.clearTimeout(this.connectTimer);
      this.connectTimer = window.setTimeout(() => {
        this.connectTimer = null;
        this.updateStatus(Status.CONNECTED);
      }, 400);
    }
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((listener) => listener !== callback);
    };
  }

  onAlert(callback: Listener<VolatilityAlert>) {
    this.alertSubscribers.push(callback);
    return () => {
      this.alertSubscribers = this.alertSubscribers.filter((listener) => listener !== callback);
    };
  }

  onStatusChange(callback: Listener<ConnectionStatus>) {
    this.statusSubscribers.push(callback);
    callback(this.status);
    return () => {
      this.statusSubscribers = this.statusSubscribers.filter((listener) => listener !== callback);
    };
  }

  setVolatilityThreshold(value: number) {
    this.thresholdPercent = value;
  }

  getVolatilityThreshold(): number {
    return this.thresholdPercent;
  }

  private start() {
    if (this.intervalId !== null) return;
    this.updateStatus(Status.CONNECTING);
    this.connectTimer = window.setTimeout(() => {
      this.connectTimer = null;
      this.updateStatus(Status.CONNECTED);
    }, 500);
    this.intervalId = window.setInterval(() => this.publishTick(), TICK_INTERVAL_MS);
  }

  private publishTick() {
    if (this.status !== Status.CONNECTED) return;
    const result = applyTick(this.tape, {
      now: Date.now(),
      volatilityRoll: Math.random(),
      directionRoll: Math.random(),
      volume: Math.floor(Math.random() * 1000) + 100,
      thresholdPercent: this.thresholdPercent,
      alertId: crypto.randomUUID(),
      ticker: this.currentTicker,
      cooldownMs: ALERT_COOLDOWN_MS,
    });
    this.tape = result.state;
    this.subscribers.forEach((listener) => listener(result.point));
    if (result.alert) {
      const alert = result.alert;
      this.alertSubscribers.forEach((listener) => listener(alert));
    }
  }

  private updateStatus(next: ConnectionStatus) {
    this.status = next;
    this.statusSubscribers.forEach((listener) => listener(next));
  }
}

export const marketService = new MarketDataService();
