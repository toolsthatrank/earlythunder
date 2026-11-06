"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { TipButtons, Portrait } from "./SupportCta";

/** No tip ask on pages that sell something, or on the support page itself. */
const NO_TIP_PATHS = new Set(["/pricing", "/welcome", "/about", "/support"]);

/** One delegated listener: report tip clicks to GA4 only when gtag exists (consent given). */
function useSupportClickTracking() {
  useEffect(() => {
    function onClick(ev: MouseEvent) {
      const target = ev.target as Element | null;
      const link = target?.closest?.("a[data-support-rail]") as HTMLAnchorElement | null;
      if (!link) return;
      // Links that also carry data-rail are reported by support-v3.js when it is loaded; skip them here to avoid a double count.
      if (link.hasAttribute("data-rail") && typeof (window as unknown as { sctShown?: unknown }).sctShown === "function") return;
      const root = link.closest("[data-support-cta]") as HTMLElement | null;
      const w = window as unknown as { gtag?: (...args: unknown[]) => void };
      if (typeof w.gtag === "function") {
        w.gtag("event", "support_click", {
          cta_position: root?.dataset.supportCta ?? "unknown",
          rail: link.dataset.supportRail,
          variant: root?.dataset.sctState ?? "na",
        });
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}

/** CTA 2: footer support block, shown on every free page. */
export default function SupportFooter() {
  useSupportClickTracking();
  const raw = usePathname() || "/";
  const path = raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  if (NO_TIP_PATHS.has(path)) return null;

  return (
    <div
      data-support-cta="footer"
      className="mx-auto flex max-w-[1280px] flex-col gap-5 border-b border-border-subtle px-6 py-10 md:px-12 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex max-w-2xl items-start gap-4">
        <Portrait size={44} />
        <div>
          <p className="text-base font-semibold tracking-tight text-text-primary">
            Made by Michael, one person and a lot of coffee.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            If Early Thunder has helped you, you can buy me a coffee. It honestly makes my day, and I read every note
            that comes with one.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:shrink-0">
        <TipButtons />
        <Link
          href="/support"
          prefetch={false}
          className="inline-flex min-h-[44px] items-center px-1 text-sm text-text-secondary underline underline-offset-4 hover:text-text-primary"
        >
          Why I ask
        </Link>
      </div>
    </div>
  );
}
