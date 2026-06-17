"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

const PRIMARY = [
  { href: "/app", label: "Dashboard", exact: true },
  { href: "/app/timeline", label: "Timeline" },
  { href: "/app/trends", label: "Trends" },
  { href: "/app/insights", label: "Insights" },
  { href: "/app/plan", label: "Plan" },
  { href: "/app/labs", label: "Labs" },
  { href: "/app/reviews", label: "Reviews" },
];

const GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Longevity",
    links: [
      { href: "/app/biomarkers", label: "Biomarkers" },
      { href: "/app/body-systems", label: "Body systems" },
      { href: "/app/risk", label: "Risk & screening" },
      { href: "/app/longevity", label: "Longevity panel" },
    ],
  },
  {
    title: "Daily",
    links: [
      { href: "/app/habits", label: "Habits" },
      { href: "/app/journal", label: "Journal" },
      { href: "/app/programs", label: "Programs" },
    ],
  },
  {
    title: "Care",
    links: [
      { href: "/app/intake", label: "Symptom intake" },
      { href: "/app/inbox", label: "Inbox" },
      { href: "/app/medications", label: "Medications" },
      { href: "/app/adherence", label: "Adherence" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/app/connections", label: "Connections" },
      { href: "/app/reports", label: "Reports" },
      { href: "/app/notifications", label: "Notifications" },
      { href: "/app/profile", label: "Profile" },
      { href: "/app/settings", label: "Settings" },
    ],
  },
];

export function AppSubnav() {
  const pathname = usePathname() || "/app";
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);
  const moreActive = GROUPS.some((g) => g.links.some((l) => isActive(l.href)));

  return (
    <div className="app-subnav">
      <div className="wrap app-subnav-row">
        {PRIMARY.map((l) => (
          <Link key={l.href} href={l.href} className={`app-subnav-link ${isActive(l.href, l.exact) ? "active" : ""}`}>
            {l.label}
          </Link>
        ))}
        <details className="more-menu">
          <summary className={`app-subnav-link more-summary ${moreActive ? "active" : ""}`}>
            More <ChevronDown size={13} />
          </summary>
          <div className="more-panel">
            {GROUPS.map((g) => (
              <div className="more-group" key={g.title}>
                <div className="more-group-title">{g.title}</div>
                {g.links.map((l) => (
                  <Link key={l.href} href={l.href} className={`more-link ${isActive(l.href) ? "active" : ""}`}>
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
