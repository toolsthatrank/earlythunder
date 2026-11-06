import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import WorkbenchCTA from "@/components/WorkbenchCTA";
import { PageHeader, SectionLabel, Prose, EyebrowLabel, Section } from "@/components/PageChrome";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getAllScreens, getScreensMeta, getMispricing } from "@/lib/scorecard-screens";
import { getScreenCopy } from "@/lib/screen-copy";
import { formatDate } from "@/lib/scorecard-insight";
import { getBreadcrumbListSchema, getFaqPageSchema } from "@/lib/structured-data";

const TITLE = "Crypto screens over 251 scored tokens";

export function generateMetadata(): Metadata {
  const screens = getAllScreens();
  const meta = getScreensMeta();
  const description =
    `${screens.length} filters over the same ${meta.universe_size}-token scored universe. Real revenue at ` +
    `a cheap multiple, no vesting left, buybacks, real staking yield, developer momentum and more. ` +
    `Each screen states its rule and lists every token that passes.`;
  return {
    title: "Crypto Screener Built on 25 Fundamental Variables",
    description,
    keywords: [
      "crypto screener",
      "altcoin screener",
      "crypto screener fundamentals",
      "filter crypto by revenue",
      "best crypto by the numbers",
    ],
    openGraph: { title: `${TITLE} | ${SITE_NAME}`, description, url: `${SITE_URL}/scorecard/screen`, type: "article" },
    twitter: { card: "summary_large_image", title: `${TITLE} | ${SITE_NAME}`, description },
    alternates: { canonical: `${SITE_URL}/scorecard/screen` },
  };
}

export default function ScreenIndexPage() {
  const screens = getAllScreens();
  const meta = getScreensMeta();
  const mispricing = getMispricing();
  if (screens.length === 0) return null;

  const faqs = [
    {
      question: "What is a screen on this site?",
      answer:
        `A filter over the ${meta.universe_size}-token scored universe, stated as a rule a reader can ` +
        `check. Every variable runs 1 to 10 against the same definition, so a threshold means the same ` +
        `thing on every token. There are ${screens.length} screens.`,
    },
    {
      question: "Are these screens updated?",
      answer:
        `The filters are fixed. The membership moves when a scoring pass runs and when the market ` +
        `snapshot refreshes, which happens daily. The current pass is dated ${formatDate(meta.source_updated_at)}.`,
    },
  ];

  const breadcrumbs = getBreadcrumbListSchema([
    { name: "Home", path: "/" },
    { name: "Scorecard", path: "/scorecard" },
    { name: "Screens", path: "/scorecard/screen" },
  ]);
  const faqSchema = getFaqPageSchema(faqs);
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Crypto screens",
    numberOfItems: screens.length,
    itemListElement: screens.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.name,
      url: `${SITE_URL}/scorecard/screen/${s.slug}`,
    })),
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <JsonLd data={breadcrumbs} />
      <JsonLd data={itemList} />
      {faqSchema && <JsonLd data={faqSchema} />}

      <nav aria-label="Breadcrumb" className="mb-8 font-mono text-xs text-text-tertiary">
        <Link href="/" className="hover:text-text-secondary">Home</Link>
        <span className="px-2">/</span>
        <Link href="/scorecard" className="hover:text-text-secondary">Scorecard</Link>
        <span className="px-2">/</span>
        <span className="text-text-secondary">Screens</span>
      </nav>

      <PageHeader
        eyebrow={`${screens.length} screens`}
        title={TITLE}
        lead={`Each screen is one question with a stated rule, run against the same ${meta.universe_size} tokens scored on the same 25 variables. No screen is a recommendation, and every member links to its full scorecard.`}
        meta={`Scoring pass ${formatDate(meta.source_updated_at)}. Market snapshot ${formatDate(meta.market_fetched_at)}.`}
      />

      <WorkbenchCTA
        placement="screenhub"
        heading="Found a screen that fits your question?"
        body="Take its members into the Token Evidence Workbench. Keep the source and date of each figure, compare your own assumptions, and export a research memo."
      />

      {mispricing !== null && (
        <Section>
          <SectionLabel number="01" title="Start with the disagreement" />
          <Prose>
            Before any single filter, the most useful cut is where the market and the framework rank a
            token differently. {mispricing.underpriced_total} tokens sit at least {mispricing.min_gap}{" "}
            places higher on fundamentals than on size, and {mispricing.overpriced_total} sit the same
            distance the other way.
          </Prose>
          <Link
            href="/scorecard/mispriced"
            className="mt-6 block rounded-2xl border border-amber/40 bg-amber/5 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber/70"
          >
            <span className="block text-sm font-semibold text-text-primary">
              Where the market and the fundamentals disagree
            </span>
            <span className="mt-1.5 block text-xs leading-relaxed text-text-secondary">
              {mispricing.universe} tokens ranked twice, widest gap {`+${mispricing.underpriced[0]?.gap ?? 0}`} on{" "}
              {mispricing.underpriced[0]?.symbol}.
            </span>
          </Link>
        </Section>
      )}

      <Section>
        <SectionLabel number="02" title={`The ${screens.length} screens`} />
        <Prose>
          Thresholds are set so each result is a shortlist rather than a list of everything. The pass
          count sits on every card, because a filter that half the universe clears is not a filter.
        </Prose>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {screens.map((screen) => {
            const copy = getScreenCopy(screen.slug);
            return (
              <Link
                key={screen.slug}
                href={`/scorecard/screen/${screen.slug}`}
                className="block rounded-2xl border border-border bg-bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active"
              >
                <span className="block text-sm font-semibold leading-snug text-text-primary">
                  {screen.name}
                </span>
                <span className="mt-2 block text-xs leading-relaxed text-text-secondary">
                  {copy ? copy.rule : `A filter over the ${screen.universe}-token universe.`}
                </span>
                <span className="mt-3 block font-mono text-[11px] text-text-tertiary">
                  {screen.count} of {screen.universe} pass &middot; median {screen.median_score}
                </span>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section>
        <SectionLabel number="03" title="Common questions" />
        <dl className="mt-6 space-y-6">
          {faqs.map((faq) => (
            <div key={faq.question}>
              <dt className="text-[1.0625rem] font-semibold text-text-primary">{faq.question}</dt>
              <dd className="mt-2 max-w-3xl text-[1.0625rem] leading-[1.75] text-text-secondary">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section divider>
        <EyebrowLabel>Keep reading</EyebrowLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/scorecard" className="block rounded-2xl border border-border bg-bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active">
            <span className="block text-sm font-semibold text-text-primary">All {meta.universe_size} rated tokens</span>
            <span className="mt-1.5 block text-xs leading-relaxed text-text-secondary">The full ranking table.</span>
          </Link>
          <Link href="/scorecard/signal" className="block rounded-2xl border border-border bg-bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active">
            <span className="block text-sm font-semibold text-text-primary">The 25 variables</span>
            <span className="mt-1.5 block text-xs leading-relaxed text-text-secondary">Ranked by what the market pays for.</span>
          </Link>
          <Link href="/scorecard/compare" className="block rounded-2xl border border-border bg-bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active">
            <span className="block text-sm font-semibold text-text-primary">Head to head</span>
            <span className="mt-1.5 block text-xs leading-relaxed text-text-secondary">Two tokens on all 25 variables.</span>
          </Link>
        </div>
      </Section>

      <p className="mt-16 max-w-3xl text-xs leading-relaxed text-text-tertiary">
        Research and analysis, not investment advice.
      </p>
    </div>
  );
}
