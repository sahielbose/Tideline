import {
  LineChart,
  RefreshCw,
  FlaskConical,
  HeartPulse,
  Stethoscope,
  CalendarCheck2,
  Pill,
} from "lucide-react";
import type { TimelineCategory } from "@/lib/services/timeline";

const MAP: Record<TimelineCategory, typeof LineChart> = {
  insight: LineChart,
  sync: RefreshCw,
  lab: FlaskConical,
  vital: HeartPulse,
  condition: Stethoscope,
  encounter: CalendarCheck2,
  medication: Pill,
};

export function TimelineIcon({ category }: { category: TimelineCategory }) {
  const Icon = MAP[category] ?? LineChart;
  return <Icon />;
}
