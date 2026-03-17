"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/",             label: "Standings" },
  { href: "/tournaments",  label: "Tournaments" },
  { href: "/money",        label: "Money" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header style={{ background: "#0a1d0f", borderBottom: "1px solid #2a4a30" }}>
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Logo / title */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg" style={{ color: "#c9a84c" }}>
          <span style={{ fontSize: "1.4rem" }}>⛳</span>
          <span className="hidden sm:inline">Buddies Golf League</span>
          <span className="sm:hidden">BGL</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="px-3 py-1 rounded text-sm font-medium transition-colors"
                style={{
                  background: active ? "#2d7a32" : "transparent",
                  color: active ? "#e8f5ea" : "#9dc49e",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
