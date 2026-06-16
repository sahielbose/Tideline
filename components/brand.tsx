import Link from "next/link";

/** The Tideline wordmark + wave logo, ported from the prototype nav. */
export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href}>
      <span className="logo" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M2 13c2.5 0 2.5-3.4 5-3.4S9.5 13 12 13s2.5-3.4 5-3.4S19.5 13 22 13"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M2 17c2.5 0 2.5-3.4 5-3.4S9.5 17 12 17s2.5-3.4 5-3.4S19.5 17 22 17"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            opacity=".6"
          />
        </svg>
      </span>
      <span className="word">
        Tide<b>line</b>
      </span>
    </Link>
  );
}
