"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app", label: "Dashboard", exact: true },
  { href: "/app/timeline", label: "Timeline" },
  { href: "/app/insights", label: "Insights" },
  { href: "/app/plan", label: "Plan" },
  { href: "/app/biomarkers", label: "Biomarkers" },
  { href: "/app/body-systems", label: "Body systems" },
  { href: "/app/risk", label: "Risk" },
  { href: "/app/labs", label: "Labs" },
  { href: "/app/medications", label: "Medications" },
  { href: "/app/connections", label: "Connections" },
  { href: "/app/reviews", label: "Reviews" },
  { href: "/app/notifications", label: "Notifications" },
  { href: "/app/settings", label: "Settings" },
];

export function AppSubnav() {
  const pathname = usePathname() || "/app";
  return (
    <div className="app-subnav">
      <div className="wrap app-subnav-row">
        {LINKS.map((l) => {
          const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={`app-subnav-link ${active ? "active" : ""}`}>
              {l.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
