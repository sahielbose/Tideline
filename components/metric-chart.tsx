"use client";

import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricSeriesPoint, MetricStatus } from "@/lib/types";

const COLOR: Record<MetricStatus, string> = {
  normal: "#46A86B",
  info: "#4C9AD0",
  watch: "#C99327",
  elevated: "#C77A3C",
  urgent: "#C84B45",
};

/**
 * Full metric time-series with the personal-baseline band and the population
 * reference band (CONTEXT.md §4.4 metric detail view).
 */
export function MetricChart({
  series,
  status = "normal",
  baseline,
  refLow,
  refHigh,
}: {
  series: MetricSeriesPoint[];
  status?: MetricStatus;
  baseline?: { center: number; spread: number } | null;
  refLow?: number | null;
  refHigh?: number | null;
}) {
  const color = COLOR[status];
  const data = series.map((p) => ({
    t: new Date(p.t).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    v: p.v,
  }));
  const values = series.map((p) => p.v);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const lo = Math.min(dataMin, refLow ?? dataMin, baseline ? baseline.center - baseline.spread : dataMin);
  const hi = Math.max(dataMax, refHigh ?? dataMax, baseline ? baseline.center + baseline.spread : dataMax);
  const pad = (hi - lo) * 0.12 || 1;

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="metric-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity={0.18} />
              <stop offset="1" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {refLow != null && refHigh != null && (
            <ReferenceArea
              y1={refLow}
              y2={refHigh}
              fill="#46A86B"
              fillOpacity={0.06}
              ifOverflow="extendDomain"
            />
          )}
          {baseline && (
            <ReferenceArea
              y1={baseline.center - baseline.spread}
              y2={baseline.center + baseline.spread}
              fill="#4C9AD0"
              fillOpacity={0.1}
              ifOverflow="extendDomain"
            />
          )}
          <XAxis dataKey="t" tick={{ fontSize: 11, fill: "#8A98A5" }} minTickGap={28} tickLine={false} axisLine={false} />
          <YAxis
            domain={[Math.floor(lo - pad), Math.ceil(hi + pad)]}
            tick={{ fontSize: 11, fill: "#8A98A5" }}
            width={38}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #E6ECF3", fontSize: 13 }}
            labelStyle={{ color: "#5A6A78" }}
          />
          <Area type="monotone" dataKey="v" stroke="none" fill="url(#metric-area)" isAnimationActive={false} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2.4} dot={false} isAnimationActive />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
