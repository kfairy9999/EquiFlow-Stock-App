import type { ReactNode } from "react";
import { DownIcon, UpIcon } from "./Icons";

interface StatsCardProps {
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down" | "flat" | "neutral";
  detail?: string;
  flash?: "up" | "down" | null;
  flashKey?: number;
  icon?: ReactNode;
}

const trendClass: Record<NonNullable<StatsCardProps["trend"]>, string> = {
  up: "text-gain bg-gain-soft",
  down: "text-loss bg-loss-soft",
  flat: "text-muted bg-paper-deep",
  neutral: "text-muted bg-transparent",
};

const trendWord: Record<NonNullable<StatsCardProps["trend"]>, string> = {
  up: "Up",
  down: "Down",
  flat: "Flat",
  neutral: "",
};

export function StatsCard({ label, value, hint, trend = "neutral", detail, flash, flashKey = 0, icon }: StatsCardProps) {
  const flashClass = flash === "up" ? "tick-up" : flash === "down" ? "tick-down" : "";
  return (
    <article className="flex flex-col justify-between rounded-3xl border border-line bg-card p-4 shadow-[0_16px_36px_-24px_rgba(80,48,20,0.55)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm text-muted">{label}</h3>
        {icon}
      </div>
      <p key={flash ? `${flash}-${flashKey}` : "still"} className={`mt-3 inline-block rounded-xl px-1 font-sans text-2xl font-bold tabular-nums text-ink sm:text-3xl ${flashClass}`}>
        {value}
      </p>
      {hint && (
        <p className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold ${trendClass[trend]}`}>
          {trend === "up" && <UpIcon />}
          {trend === "down" && <DownIcon />}
          <span>
            {trendWord[trend] ? `${trendWord[trend]} ` : ""}
            {hint}
          </span>
        </p>
      )}
      {detail && <p className="mt-2 text-sm leading-relaxed text-muted">{detail}</p>}
    </article>
  );
}
