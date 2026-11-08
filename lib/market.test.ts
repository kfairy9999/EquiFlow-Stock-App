import { describe, expect, it } from "vitest";
import {
  ALERT_COOLDOWN_MS,
  SMA_PERIOD,
  applyTick,
  assessMove,
  canEmitAlert,
  createTape,
  getUsCashSession,
  simpleMovingAverage,
  stepPrice,
} from "./market";

describe("simpleMovingAverage", () => {
  it("stays empty until 20 prices exist", () => {
    const prices = Array.from({ length: SMA_PERIOD - 1 }, (_, index) => index + 1);
    expect(simpleMovingAverage(prices)).toBeNull();
    expect(simpleMovingAverage([])).toBeNull();
  });

  it("averages exactly the first 20 prices", () => {
    const prices = Array.from({ length: 20 }, (_, index) => index + 1);
    expect(simpleMovingAverage(prices)).toBe(10.5);
  });

  it("drops the oldest price once the window rolls", () => {
    const prices = Array.from({ length: 21 }, (_, index) => index + 1);
    expect(simpleMovingAverage(prices)).toBe(11.5);
    expect(simpleMovingAverage(prices, 2)).toBe(20.5);
  });

  it("rejects a non-positive period and a non-finite value", () => {
    expect(simpleMovingAverage([1, 2, 3], 0)).toBeNull();
    expect(simpleMovingAverage([1, Number.NaN], 2)).toBeNull();
  });
});

describe("assessMove", () => {
  it("stays quiet at or inside the threshold", () => {
    expect(assessMove(101, 100, 1)).toBeNull();
    expect(assessMove(100.5, 100, 1)).toBeNull();
    expect(assessMove(100, null, 1)).toBeNull();
    expect(assessMove(100, 0, 1)).toBeNull();
  });

  it("names a jump above the average and a fall below it", () => {
    const spike = assessMove(101.5, 100, 1);
    expect(spike).toMatchObject({ kind: "SPIKE", severity: "medium" });
    expect(spike?.percent).toBeCloseTo(1.5);

    const drop = assessMove(98.4, 100, 1);
    expect(drop).toMatchObject({ kind: "DROP", severity: "medium" });
  });

  it("marks a gap more than twice the threshold as large", () => {
    expect(assessMove(103, 100, 1)?.severity).toBe("high");
    expect(assessMove(97, 100, 1)?.severity).toBe("high");
  });
});

describe("stepPrice", () => {
  it("rises when the direction roll is high and falls when it is low", () => {
    expect(stepPrice(100, 0.5, 1)).toBeGreaterThan(100);
    expect(stepPrice(100, 0.5, 0)).toBeLessThan(100);
  });
});

describe("alert cooldown", () => {
  it("allows the first note and then waits", () => {
    expect(canEmitAlert(1_000, null, ALERT_COOLDOWN_MS)).toBe(true);
    expect(canEmitAlert(5_000, 1_000, ALERT_COOLDOWN_MS)).toBe(false);
    expect(canEmitAlert(6_000, 1_000, ALERT_COOLDOWN_MS)).toBe(true);
  });
});

describe("applyTick", () => {
  it("publishes an SMA-20 on the 20th price and keeps a 20-price window", () => {
    let state = createTape(100);
    let lastSma: number | null = null;
    for (let tick = 0; tick < 25; tick += 1) {
      const result = applyTick(state, {
        now: 1_000 + tick * 200,
        volatilityRoll: 0,
        directionRoll: 0.5,
        volume: 100,
        thresholdPercent: 50,
        alertId: `alert-${tick}`,
        ticker: "AAPL",
      });
      state = result.state;
      lastSma = result.point.sma20;
      if (tick < SMA_PERIOD - 1) expect(result.point.sma20).toBeNull();
      if (tick === SMA_PERIOD - 1) expect(result.point.sma20).not.toBeNull();
      expect(result.alert).toBeNull();
    }
    expect(state.history).toHaveLength(SMA_PERIOD);
    expect(lastSma).not.toBeNull();
    expect(state.cumulativeVolume).toBe(2_500);
  });

  it("emits one note and then respects the cooldown", () => {
    let state = createTape(100);
    for (let tick = 0; tick < 20; tick += 1) {
      state = applyTick(state, {
        now: tick * 200,
        volatilityRoll: 0,
        directionRoll: 0.5,
        volume: 10,
        thresholdPercent: 50,
        alertId: `warm-${tick}`,
        ticker: "NVDA",
      }).state;
    }

    const jumped = applyTick(state, {
      now: 20_000,
      volatilityRoll: 0,
      directionRoll: 1,
      volume: 10,
      thresholdPercent: 0.01,
      alertId: "jump",
      ticker: "NVDA",
      cooldownMs: 5_000,
    });
    expect(jumped.alert?.type).toBe("SPIKE");
    expect(jumped.alert?.message).toContain("NVDA");
    expect(jumped.alert?.message).toContain("above");

    const suppressed = applyTick(jumped.state, {
      now: 21_000,
      volatilityRoll: 0,
      directionRoll: 1,
      volume: 10,
      thresholdPercent: 0.01,
      alertId: "again",
      ticker: "NVDA",
      cooldownMs: 5_000,
    });
    expect(suppressed.alert).toBeNull();

    const later = applyTick(suppressed.state, {
      now: 26_000,
      volatilityRoll: 0,
      directionRoll: 1,
      volume: 10,
      thresholdPercent: 0.01,
      alertId: "later",
      ticker: "NVDA",
      cooldownMs: 5_000,
    });
    expect(later.alert).not.toBeNull();
  });
});

describe("getUsCashSession", () => {
  it("is closed on a Sunday", () => {
    const session = getUsCashSession(new Date("2026-11-08T15:00:00Z"));
    expect(session.isOpen).toBe(false);
    expect(session.countdown).toBe("Opens Monday at 9:30 a.m. ET");
  });

  it("is open on a Wednesday morning and counts down to the close", () => {
    const session = getUsCashSession(new Date("2026-11-11T15:00:00Z"));
    expect(session.isOpen).toBe(true);
    expect(session.message).toBe("Cash session open");
    expect(session.countdown).toBe("Closes in 6h 0m");
  });

  it("counts the time until the same-day open", () => {
    const session = getUsCashSession(new Date("2026-11-11T13:00:00Z"));
    expect(session.isOpen).toBe(false);
    expect(session.countdown).toBe("Opens in 1h 30m");
  });

  it("points to the next morning after a midweek close, and to Monday after Friday", () => {
    expect(getUsCashSession(new Date("2026-11-11T21:30:00Z")).countdown).toBe("Opens tomorrow at 9:30 a.m. ET");
    expect(getUsCashSession(new Date("2026-11-13T21:30:00Z")).countdown).toBe("Opens Monday at 9:30 a.m. ET");
  });
});
