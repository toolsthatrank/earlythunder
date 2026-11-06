import type { Metadata } from "next";
import { getAllOpportunities, getAllBlogPosts } from "@/lib/data";
import { BMC_URL, PAYPAL_URL, TIP_BTN, TIP_PRIMARY_STYLE, CupIcon, Portrait, GithubSponsorLink } from "@/components/SupportCta";

export const metadata: Metadata = {
  title: "Why there is a tip jar",
  description: "Who runs Early Thunder, what it costs, and how to leave a small tip. The research stays free either way.",
  alternates: { canonical: "https://earlythunder.com/support" },
  robots: { index: false, follow: true },
};

const PRESETS = [5, 10, 20] as const;

export default function SupportPage() {
  const tokenPages = getAllOpportunities().length;
  const posts = getAllBlogPosts().length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <section data-support-cta="support_page" className="max-w-3xl">
        <div className="flex items-center gap-4">
          <Portrait size={64} />
          <p className="font-mono text-sm uppercase tracking-wider text-text-tertiary">Michael, builder of Early Thunder</p>
        </div>
        <h1 className="mt-6 text-4xl font-semibold tracking-tighter text-text-primary md:text-5xl">Why there is a tip jar</h1>
        <div className="mt-6 space-y-5 text-[1.0625rem] leading-[1.75] text-text-secondary">
          <p>
            Hi, I&apos;m Michael. Thank you for being here. I build and run Early Thunder on my own. I started it in April 2026. Since then it has grown
            to {tokenPages} token research pages, a token scorecard, free crypto calculators and {posts} posts.
          </p>
          <p>
            <span className="font-semibold text-text-primary">What it costs.</span> Cloudflare Pages hosts the site for free.
            Prices come from CoinGecko and protocol revenue from DefiLlama, both free public data, refreshed daily. I pay
            for the domain and for the hours I spend checking sources and fixing numbers.
          </p>
          <table className="w-full max-w-xl border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-border py-2 text-left font-semibold text-text-primary">Item</th>
                <th className="border-b border-border py-2 text-right font-semibold text-text-primary">Per year</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-b border-border-subtle py-2">Domain renewal, earlythunder.com (Porkbun list price)</td>
                <td className="border-b border-border-subtle py-2 text-right">$11.08</td>
              </tr>
              <tr>
                <td className="border-b border-border-subtle py-2">Hosting (Cloudflare Pages)</td>
                <td className="border-b border-border-subtle py-2 text-right">$0</td>
              </tr>
              <tr>
                <td className="border-b border-border-subtle py-2">Price and revenue data (CoinGecko, DefiLlama free data)</td>
                <td className="border-b border-border-subtle py-2 text-right">$0</td>
              </tr>
            </tbody>
          </table>
          <p>
            <span className="font-semibold text-text-primary">What tips pay for.</span> The site also sells an optional $29
            Workbench and a pay-per-call data API. A tip is separate from both.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>The domain renewal. It costs about $11 a year, so a $5 tip covers about five months of it.</li>
            <li>Time to check sources and fix numbers on the token research pages.</li>
            <li>Time to keep the daily data refresh running.</li>
          </ul>
          <p>A tip buys nothing extra, and everyone gets the same research.</p>
        </div>

        <p className="mt-8 text-sm text-text-secondary">Pick an amount on PayPal:</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {PRESETS.map((amount) => (
            <a
              key={amount}
              href={`${PAYPAL_URL}/${amount}USD`}
              target="_blank"
              rel="noopener"
              data-support-rail="paypal"
              className={`${TIP_BTN} min-w-[64px]`}
              style={amount === 5 ? TIP_PRIMARY_STYLE : undefined}
            >
              ${amount}
            </a>
          ))}
          <a href={PAYPAL_URL} target="_blank" rel="noopener" data-support-rail="paypal" className={TIP_BTN}>
            Other amount
          </a>
          <a href={BMC_URL} target="_blank" rel="noopener" data-support-rail="bmc" className={TIP_BTN}>
            <CupIcon /> Card, any amount or monthly
          </a>
          <GithubSponsorLink />
        </div>

        <div className="mt-8 space-y-3 text-sm leading-relaxed text-text-secondary">
          <p>PayPal shows my legal name, Michał Lip. Buy Me a Coffee takes a card without an account.</p>
          <p>Prefer monthly? On Buy Me a Coffee you can tick &quot;Make this monthly&quot;. You can cancel at any time.</p>
          <p>The use count on this site stays in your browser. I never see it.</p>
          <p>This is a tip, not a purchase. You get nothing extra, and you owe nothing. The site stays free either way.</p>
          <p className="text-text-tertiary">Everything here is research notes, not advice.</p>
          <p>Thank you. Michael</p>
        </div>
      </section>
    </div>
  );
}
