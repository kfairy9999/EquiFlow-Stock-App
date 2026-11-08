import type { PricePoint, VolatilityAlert } from "../types";

/** Number of prices in the simple moving average. */
export const SMA_PERIOD = 20;

/** How often the in-browser simulator publishes a new price. */
export const TICK_INTERVAL_MS = 200;

/** How often React commits the buffered tape to the screen. */
export const UI_COMMIT_MS = 200;

/** Minimum time between volatility notes for one symbol. */
export const ALERT_COOLDOWN_MS = 5_000;

/** Prices kept for the chart. Older prices roll off the drawing, not the running high and low. */
export const CHART_WINDOW = 240;

/** Default gap, as a percent of the SMA-20, that earns a note. */
export const DEFAULT_THRESHOLD_PERCENT = 1;

export const MIN_THRESHOLD_PERCENT = 0.2;
export const MAX_THRESHOLD_PERCENT = 3;

export interface TapeState {
  price: number;
  history: number[];
  open: number | null;
  high: number;
  low: number;
  cumulativeVolume: number;
  lastAlertAt: number | null;
}

export interface TickRoll {
  now: number;
  volatilityRoll: number;
  directionRoll: number;
  volume: number;
  thresholdPercent: number;
  alertId: string;
  ticker: string;
  cooldownMs?: number;
}

export function createTape(startPrice: number): TapeState {
  return {
    price: startPrice,
    history: [],
    open: null,
    high: startPrice,
    low: startPrice,
    cumulativeVolume: 0,
    lastAlertAt: null,
  };
}

/**
 * One step of the sample tape.
 * `volatilityRoll` and `directionRoll` are numbers from 0 inclusive to 1 exclusive,
 * the same range as `Math.random()`.
 */
export function stepPrice(
  current: number,
  volatilityRoll: number,
  directionRoll: number,
  options?: { baseVolatility?: number; drift?: number },
): number {
  const baseVolatility = options?.baseVolatility ?? 0.002;
  const drift = options?.drift ?? 0.0001;
  const volatility = baseVolatility * (clamp01(volatilityRoll) * 0.5 + 0.8);
  const change = current * (drift + volatility * (clamp01(directionRoll) - 0.5));
  return current + change;
}

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Simple moving average of the last `period` values.
 * Returns null until enough values exist. Does not read anything older than `period`.
 */
export function simpleMovingAverage(values: readonly number[], period = SMA_PERIOD): number | null {
  if (!Number.isFinite(period) || period <= 0 || values.length < period) return null;
  let sum = 0;
  for (let index = values.length - period; index < values.length; index += 1) {
    const value = values[index];
    if (value === undefined || !Number.isFinite(value)) return null;
    sum += value;
  }
  return sum / period;
}

export interface MoveAssessment {
  kind: "SPIKE" | "DROP";
  diff: number;
  percent: number;
  severity: "medium" | "high";
}

/**
 * Compares a price with the SMA. The threshold is a percent of the average,
 * because the tape itself moves by a percent of price. A gap equal to the
 * threshold stays quiet; only a wider gap is mentioned.
 */
export function assessMove(price: number, sma: number | null, thresholdPercent: number): MoveAssessment | null {
  if (sma === null || !Number.isFinite(price) || !Number.isFinite(sma) || sma === 0) return null;
  if (!Number.isFinite(thresholdPercent) || thresholdPercent < 0) return null;
  const diff = Math.abs(price - sma);
  const percent = (diff / Math.abs(sma)) * 100;
  if (percent <= thresholdPercent) return null;
  return {
    kind: price > sma ? "SPIKE" : "DROP",
    diff,
    percent,
    severity: percent > thresholdPercent * 2 ? "high" : "medium",
  };
}

export function canEmitAlert(now: number, lastAlertAt: number | null, cooldownMs: number): boolean {
  if (lastAlertAt === null) return true;
  return now - lastAlertAt >= cooldownMs;
}

export function applyTick(state: TapeState, roll: TickRoll): { state: TapeState; point: PricePoint; alert: VolatilityAlert | null } {
  const nextRaw = stepPrice(state.price, roll.volatilityRoll, roll.directionRoll);
  const price = roundCents(nextRaw);
  const history = state.history.length >= SMA_PERIOD ? [...state.history.slice(-(SMA_PERIOD - 1)), price] : [...state.history, price];
  const smaRaw = simpleMovingAverage(history, SMA_PERIOD);
  const sma20 = smaRaw === null ? null : roundCents(smaRaw);
  const open = state.open ?? price;
  const high = Math.max(state.high, price);
  const low = state.history.length === 0 ? price : Math.min(state.low, price);
  const cumulativeVolume = state.cumulativeVolume + roll.volume;
  const point: PricePoint = {
    timestamp: roll.now,
    price,
    sma20,
    volume: roll.volume,
    open,
    high,
    low,
    cumulativeVolume,
  };

  const move = assessMove(price, sma20, roll.thresholdPercent);
  const cooldownMs = roll.cooldownMs ?? ALERT_COOLDOWN_MS;
  let alert: VolatilityAlert | null = null;
  let lastAlertAt = state.lastAlertAt;
  if (move && canEmitAlert(roll.now, state.lastAlertAt, cooldownMs)) {
    const direction = move.kind === "SPIKE" ? "above" : "below";
    alert = {
      id: roll.alertId,
      timestamp: roll.now,
      type: move.kind,
      message: `${roll.ticker} is $${move.diff.toFixed(2)} (${move.percent.toFixed(2)}%) ${direction} its 20-price average.`,
      severity: move.severity,
    };
    lastAlertAt = roll.now;
  }

  return {
    state: {
      price: nextRaw,
      history,
      open,
      high,
      low,
      cumulativeVolume,
      lastAlertAt,
    },
    point,
    alert,
  };
}

export interface CashSession {
  isOpen: boolean;
  message: string;
  countdown: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const OPEN_MINUTES = 9 * 60 + 30;
const CLOSE_MINUTES = 16 * 60;

/**
 * Weekday US cash-session clock in America/New_York.
 * Holidays and early closes are not included.
 */
export function getUsCashSession(now: Date): CashSession {
  const zoned = zonedParts(now, "America/New_York");
  const weekend = zoned.weekday === "Sat" || zoned.weekday === "Sun";
  const isOpen = !weekend && zoned.totalMinutes >= OPEN_MINUTES && zoned.totalMinutes < CLOSE_MINUTES;

  if (isOpen) {
    return {
      isOpen: true,
      message: "Cash session open",
      countdown: `Closes in ${formatGap(CLOSE_MINUTES - zoned.totalMinutes)}`,
    };
  }

  if (!weekend && zoned.totalMinutes < OPEN_MINUTES) {
    return {
      isOpen: false,
      message: "Cash session closed",
      countdown: `Opens in ${formatGap(OPEN_MINUTES - zoned.totalMinutes)}`,
    };
  }

  const fridayAfterClose = zoned.weekday === "Fri" && zoned.totalMinutes >= CLOSE_MINUTES;
  const opensMonday = weekend || fridayAfterClose;
  return {
    isOpen: false,
    message: "Cash session closed",
    countdown: opensMonday ? "Opens Monday at 9:30 a.m. ET" : "Opens tomorrow at 9:30 a.m. ET",
  };
}

export function gapPercent(price: number, sma: number | null): number | null {
  if (sma === null || sma === 0 || !Number.isFinite(price) || !Number.isFinite(sma)) return null;
  return ((price - sma) / Math.abs(sma)) * 100;
}

function formatGap(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function zonedParts(now: Date, timeZone: string): { weekday: (typeof WEEKDAYS)[number]; totalMinutes: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(now);
  const weekdayText = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const weekday = WEEKDAYS.find((day) => weekdayText.startsWith(day)) ?? "Sun";
  return { weekday, totalMinutes: hour * 60 + minute };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
