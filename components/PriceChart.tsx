import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatClock, formatMoney } from "../lib/format";
import type { PricePoint } from "../types";

interface PriceChartProps {
  data: PricePoint[];
  ticker: string;
}

export function PriceChart({ data, ticker }: PriceChartProps) {
  const visible = useMemo(() => data.slice(-180), [data]);
  const domain = useMemo(() => {
    if (visible.length === 0) return [0, 1] as [number, number];
    const prices = visible.flatMap((point) => (point.sma20 === null ? [point.price] : [point.price, point.sma20]));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = Math.max((max - min) * 0.15, 0.05);
    return [min - pad, max + pad] as [number, number];
  }, [visible]);

  if (visible.length < 2) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center" role="status">
        <p className="font-display text-2xl text-ink">The tape is waking up</p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          The first simulated prices for {ticker} arrive in about a second. Nothing here is a live quote.
        </p>
      </div>
    );
  }

  const origin = visible[0]?.timestamp ?? 0;
  const latest = visible[visible.length - 1];
  const summary = latest
    ? `${ticker} simulated chart. Latest price ${formatMoney(latest.price)}. ${
        latest.sma20 === null ? "The 20-price average is not ready yet." : `20-price average ${formatMoney(latest.sma20)}.`
      }`
    : `${ticker} chart`;

  return (
    <div className="h-full w-full" role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={visible} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8d4324" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#8d4324" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e3d5c4" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value: number) => `${Math.max(0, Math.round((Number(value) - origin) / 1000))}s`}
            minTickGap={72}
            stroke="#65584b"
            tick={{ fill: "#65584b", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={domain}
            stroke="#65584b"
            tick={{ fill: "#65584b", fontSize: 12 }}
            tickFormatter={(value: number) => value.toFixed(2)}
            width={64}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#fffdf8",
              border: "1px solid #e3d5c4",
              borderRadius: 16,
              color: "#2c241c",
            }}
            labelFormatter={(value) => formatClock(Number(value))}
            formatter={(value, name) => {
              const amount = typeof value === "number" ? formatMoney(value) : String(value ?? "");
              return [amount, name === "sma20" ? "SMA-20" : "Price"];
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            name="price"
            stroke="#8d4324"
            fill="url(#priceFill)"
            strokeWidth={2.4}
            isAnimationActive={false}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="sma20"
            name="sma20"
            stroke="#24577f"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
