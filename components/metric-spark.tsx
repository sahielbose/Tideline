"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { MetricStatus } from "@/lib/types";

/** Sparkline for a dashboard metric card (Recharts). */
const COLOR: Record<MetricStatus, string> = {
  normal: "#46A86B",
  info: "#4C9AD0",
  watch: "#C99327",
  elevated: "#C77A3C",
  urgent: "#C84B45",
};

export function MetricSpark({
  data,
  status,
  height = 46,
}: {
  data: number[];
  status: MetricStatus;
  height?: number;
}) {
  const color = COLOR[status];
  const chart = data.map((v, i) => ({ i, v }));
  const id = `spark-${status}-${data.length}`;
  return (
    <div style={{ width: "100%", height }} className="spark">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chart} margin={{ top: 3, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity={0.22} />
              <stop offset="1" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2.4}
            fill={`url(#${id})`}
            isAnimationActive
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
