/**
 * Personalized action plan (market parity: Function/Superpower "protocols / what
 * to do next"). Aggregates active insights into grouped, hedged, plain-English
 * next steps. Non-prescriptive and non-diagnostic by construction.
 */
import { listInsights } from "./insights";
import { SEVERITY_RANK, type Severity } from "../types";

export interface PlanItem {
  insightId: string;
  title: string;
  action: string;
  metric: string | null;
  severity: Severity;
}

export interface PlanGroup {
  key: string;
  title: string;
  description: string;
  items: PlanItem[];
}

export interface ActionPlan {
  groups: PlanGroup[];
  summary: string;
}

export async function getActionPlan(userId: string): Promise<ActionPlan> {
  const insights = await listInsights(userId); // active (excludes resolved)
  const toItem = (i: (typeof insights)[number]): PlanItem => ({
    insightId: i.id,
    title: i.title,
    action: i.recommendedAction,
    metric: i.metric,
    severity: i.severity,
  });

  const clinician = insights.filter((i) => SEVERITY_RANK[i.severity] >= SEVERITY_RANK.elevated).map(toItem);
  const monitor = insights.filter((i) => i.severity === "watch").map(toItem);
  const watching = insights.filter((i) => i.severity === "info").map(toItem);

  const groups: PlanGroup[] = [
    {
      key: "clinician",
      title: "Bring to a clinician",
      description: "These have crossed into a range worth a professional review if they continue.",
      items: clinician,
    },
    {
      key: "monitor",
      title: "Monitor & adjust",
      description: "Track these and try the usual levers — sleep, hydration, stress, and activity.",
      items: monitor,
    },
    {
      key: "watching",
      title: "Keep an eye on",
      description: "In range, just worth watching alongside the rest.",
      items: watching,
    },
  ].filter((g) => g.items.length > 0);

  const total = insights.length;
  const summary =
    total === 0
      ? "Nothing needs action right now — your tracked metrics are holding near baseline."
      : `You have ${total} active insight${total === 1 ? "" : "s"}. Start with anything in “Bring to a clinician,” then work the lifestyle levers for the rest. This is general guidance, not medical advice.`;

  return { groups, summary };
}
