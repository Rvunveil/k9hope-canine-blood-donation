"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LINKS } from "./content";
import { Wordmark } from "./Wordmark";

const NAV = [
  { href: "#story", label: "Story" },
  { href: "#platform", label: "Platform" },
  { href: "#research", label: "Research" },
  { href: "#community", label: "Community" },
  { href: "#people", label: "People" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-300 ${
        scrolled || open ? "border-b border-k9-moss/60 bg-k9-night/90 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="text-k9-bone" aria-label="K9HOPE home">
          <Wordmark />
        </Link>

        <ul className="hidden items-center gap-7 text-[15px] text-k9-mist md:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="transition-colors hover:text-k9-bone">
                {n.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a
            href={LINKS.repo}
            className="hidden rounded-full px-3 py-2 text-[15px] text-k9-mist transition-colors hover:text-k9-bone sm:inline-flex"
          >
            GitHub
          </a>
          <Link
            href={LINKS.app}
            className="rounded-full bg-k9-bone px-4 py-2 text-[15px] font-bold text-k9-night transition-transform active:scale-[0.97]"
          >
            Open the app
          </Link>
          <button
            type="button"
            className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-k9-bone md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path
                d={open ? "M4 4l12 12M16 4L4 16" : "M3 6h14M3 14h14"}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-k9-moss/60 px-5 pb-6 pt-2 md:hidden">
          <ul className="flex flex-col text-lg text-k9-bone">
            {[...NAV, { href: LINKS.repo, label: "GitHub" }].map((n) => (
              <li key={n.href}>
                <a href={n.href} onClick={() => setOpen(false)} className="block py-3">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
