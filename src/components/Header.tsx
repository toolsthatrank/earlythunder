"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/** Primary nav: alpha tools showcased front and center */
const PRIMARY_NAV = [
  { href: "/intelligence/", label: "Intelligence", isNextRoute: false },
  { href: "/opportunities", label: "Opportunities", isNextRoute: true },
  { href: "/research/", label: "Research", isNextRoute: false },
  { href: "/earnings/", label: "Earnings", isNextRoute: false },
  { href: "/deadlines/", label: "Deadlines", isNextRoute: false },
  { href: "/clarity-act", label: "CLARITY", isNextRoute: true },
  { href: "/scorecard", label: "Scorecard", isNextRoute: true },
  { href: "/portfolio", label: "Portfolio", isNextRoute: true },
  { href: "https://workbench.earlythunder.com/workbench/", label: "Workbench", isNextRoute: false },
] as const;

/** Secondary nav: shown only in mobile menu below a divider */
const SECONDARY_NAV = [
  { href: "/about", label: "About", isNextRoute: true },
  { href: "/guides", label: "Guides", isNextRoute: true },
  { href: "/methodology", label: "Methodology", isNextRoute: true },
  { href: "/how-it-works", label: "How It Works", isNextRoute: true },
  { href: "/graveyard", label: "Graveyard", isNextRoute: true },
  { href: "/pricing", label: "Pricing", isNextRoute: true },
  { href: "/blog", label: "Blog", isNextRoute: true },
] as const;

type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly isNextRoute: boolean;
};

/* ─── Scroll hook ─────────────────────────────────────────── */

function useScrolled(threshold: number = 8): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => {
      setScrolled(window.scrollY > threshold);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [threshold]);

  return scrolled;
}

/* ─── NavLink helper ──────────────────────────────────────── */

function NavLink({ item, className, onClick }: {
  readonly item: NavItem;
  readonly className: string;
  readonly onClick?: () => void;
}) {
  if (item.isNextRoute) {
    return (
      <Link href={item.href} className={className} onClick={onClick} prefetch={false}>
        {item.label}
      </Link>
    );
  }
  return (
    <a href={item.href} className={className} onClick={onClick}>
      {item.label}
    </a>
  );
}

/* ─── Header (exported) ──────────────────────────────────── */

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrolled = useScrolled(8);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);

  const navClass = scrolled ? "nav nav--scrolled" : "nav";

  return (
    <header className={navClass}>
      <div className="nav__inner">
        {/* Logo */}
        <Link href="/" className="nav__logo">
          EarlyThunder
        </Link>

        {/* Center: Nav links (hidden at <=720px via CSS) */}
        <DesktopNav />

        {/* Right: CTAs */}
        <CtaGroup />

        {/* Mobile hamburger (visible at <=720px via CSS) */}
        <button
          type="button"
          className="nav__mobile-toggle"
          onClick={toggleMobile}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          <MobileMenuIcon open={mobileOpen} />
        </button>
      </div>

      {mobileOpen && <MobileNav onClose={closeMobile} />}
    </header>
  );
}

/* ─── Desktop nav links ───────────────────────────────────── */

function DesktopNav() {
  return (
    <ul className="nav__links">
      {PRIMARY_NAV.map((item) => (
        <li key={item.href}>
          <NavLink item={item} className="nav__link" />
        </li>
      ))}
    </ul>
  );
}

/* ─── CTA group (primary) ──────────────────────────────── */

function CtaGroup() {
  return (
    <div className="nav__cta">
      <a href="https://workbench.earlythunder.com/workbench/?utm_source=earlythunder&amp;utm_medium=website&amp;utm_content=header" className="primary-btn" id="cta-header-workbench" data-cta="header_workbench" data-placement="header">
        <span className="cta-long">Get the Workbench, $29 {"\u2192"}</span><span className="cta-short">Workbench $29</span>
      </a>
    </div>
  );
}

/* ─── Mobile nav ──────────────────────────────────────────── */

function MobileNav({ onClose }: { readonly onClose: () => void }) {
  return (
    <div className="nav__mobile-panel">
      <nav className="nav__mobile-links">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            className="nav__mobile-link"
            onClick={onClose}
          />
        ))}

        <div className="nav__mobile-divider" />

        {SECONDARY_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            className="nav__mobile-link"
            onClick={onClose}
          />
        ))}

        {/* Mobile CTA */}
        <a
          href="https://workbench.earlythunder.com/workbench/?utm_source=earlythunder&amp;utm_medium=website&amp;utm_content=mobile-menu"
          onClick={onClose}
          className="primary-btn nav__mobile-cta"
          data-cta="mobilemenu_workbench"
          data-placement="mobilemenu"
        >
          Get the Workbench, $29 {"\u2192"}
        </a>
      </nav>
    </div>
  );
}

/* ─── Mobile menu icon (hamburger / close) ────────────────── */

function MobileMenuIcon({ open }: { readonly open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
