"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Stethoscope,
  CalendarCheck2,
  LayoutGrid,
  MessageCircle,
  Menu,
} from "lucide-react";
import { Brand } from "./brand";

const TABS = [
  { href: "/", label: "AI Doctor", Icon: Stethoscope, key: "doctor" },
  { href: "/app/reviews", label: "Visits", Icon: CalendarCheck2, key: "visits" },
  { href: "/app", label: "Dashboard", Icon: LayoutGrid, key: "dashboard" },
  { href: "/app/chat", label: "Chat", Icon: MessageCircle, key: "chat" },
] as const;

function activeKey(pathname: string): string {
  if (pathname.startsWith("/app/chat")) return "chat";
  if (pathname.startsWith("/app/reviews")) return "visits";
  if (pathname.startsWith("/app")) return "dashboard";
  if (pathname.startsWith("/ai-doctor")) return "doctor";
  if (pathname === "/") return "doctor";
  return "doctor";
}

export function TopNav({ userInitial = "D" }: { userInitial?: string }) {
  const pathname = usePathname() || "/";
  const active = activeKey(pathname);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className={`topbar ${scrolled ? "scrolled" : ""}`}>
      <div className="wrap nav">
        <Brand href="/" />

        <nav className="tabs" aria-label="Primary">
          {TABS.map(({ href, label, Icon, key }) => (
            <Link key={key} href={href} className={`tab ${active === key ? "active" : ""}`}>
              <Icon className={key === "doctor" ? "ico-doctor" : ""} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="nav-right">
          <Link className="nav-link" href="/about">
            FAQ
          </Link>
          <span className="avatar" title="Signed in">
            {userInitial}
          </span>
          <button
            className="nav-hamb"
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Menu />
          </button>
        </div>
      </div>

      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        {TABS.map(({ href, label, key }) => (
          <Link key={key} href={href} className={`tab ${active === key ? "active" : ""}`}>
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </header>
  );
}
