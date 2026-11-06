import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import WorkbenchCTA from "@/components/WorkbenchCTA";
import ScreenTable from "@/components/ScreenTable";
import { PageHeader, SectionLabel, Prose, EyebrowLabel, Section } from "@/components/PageChrome";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import {
  getAllScreens,
  getScreen,
  getScreenMembers,
  getScreensMeta,
} from "@/lib/scorecard-screens";
import { getScreenCopy } from "@/lib/screen-copy";
import { formatUsd, formatDate } from "@/lib/scorecard-insight";
import { getBreadcrumbListSchema, getFaqPageSchema } from "@/lib/structured-data";

interface PageParams {
  readonly params: Promise<{ readonly screen: string }>;
}

export function generateStaticParams(): { screen: string }[] {
  const screens = getAllScreens();
  if (screens.length === 0) return [];
  return screens.map((screen) => ({ screen: screen.slug }));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { screen: slug } = await params;
  const screen = getScreen(slug);
  if (screen === null) return { title: "Screen Not Found" };
  const copy = getScreenCopy(screen.slug);
  const top = screen.members.slice(0, 3).map((m) => m.symbol).join(", ");

  // The question reads best, but with the site suffix a long one runs past what
  // a result page shows, so it falls back to the screen name.
  const asked = copy ? copy.question.replace(/\?$/, "") : screen.name;
  const title = asked.length <= 52 ? asked : screen.name;
  // The rule text can run long, so the description carries only its first
  // sentence. The full rule is on the page.
  const shortRule = copy ? `${copy.rule.split(". ")[0]}.` : "";
  const description =
    `${screen.count} of ${screen.universe} rated tokens pass this screen. ${shortRule} ` +
    `${top} lead on composite score, median ${screen.median_score} of 250.`;
  const url = `${SITE_URL}/scorecard/screen/${screen.slug}`;

  return {
    title,
    description,
    keywords: [
      copy ? copy.question.toLowerCase().replace("?", "") : screen.name.toLowerCase(),
      "crypto screener",
      "altcoin screener fundamentals",
      "crypto tokens filtered by fundamentals",
      "best crypto by the numbers",
    ],
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url, type: "article" },
    twitter: { card: "summary_large_image", title: `${title} | ${SITE_NAME}`, description },
    alternates: { canonical: url },
  };
}

export default async function ScreenPage({ params }: PageParams) {
  const { screen: slug } = await params;
  const screen = getScreen(slug);
  if (screen === null) notFound();
  const members = getScreenMembers(screen);
  if (members.length === 0) notFound();

  const meta = getScreensMeta();
  const copy = getScreenCopy(screen.slug);
  const passRate = Math.round((screen.count / screen.universe) * 100);
  const withCap = members.filter((m) => m.market_cap !== null);
  const smallest = withCap.length > 0 ? withCap[withCap.length - 1] : null;

  const faqs = [
    {
      question: copy ? copy.question : `What passes the ${screen.name} screen?`,
      answer:
        `${screen.count} of ${screen.universe} rated tokens pass. ` +
        `${members.slice(0, 5).map((m) => `${m.name} (${m.symbol})`).join(", ")} lead on composite score.`,
    },
    {
      question: "How is this screen defined?",
      answer: copy
        ? `${copy.rule} Every variable is scored 1 to 10 against the same definition applied to all ${screen.universe} rated tokens, and higher is always better.`
        : `A filter over the ${screen.universe}-token scored universe.`,
    },
    {
      question: "Does passing this screen mean a token is a buy?",
      answer:
        `No. It means the token clears one filter on fundamentals as recorded at the scoring pass on ` +
        `${formatDate(meta.source_updated_at)}. ${screen.count} tokens pass, which is ${passRate}% of the ` +
        `universe, and the range of composite scores inside the set runs from ${screen.bottom_score} to ` +
        `${screen.top_score}.`,
    },
  ];

  const breadcrumbs = getBreadcrumbListSchema([
    { name: "Home", path: "/" },
    { name: "Scorecard", path: "/scorecard" },
    { name: "Screens", path: "/scorecard/screen" },
    { name: screen.name, path: `/scorecard/screen/${screen.slug}` },
  ]);
  const faqSchema = getFaqPageSchema(faqs);
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: screen.name,
    numberOfItems: members.length,
    itemListElement: members.slice(0, 25).map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${m.name} (${m.symbol})`,
      url: `${SITE_URL}/scorecard/${m.slug}`,
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
        <Link href="/scorecard/screen" className="hover:text-text-secondary">Screens</Link>
        <span className="px-2">/</span>
        <span className="text-text-secondary">{screen.name}</span>
      </nav>

      <PageHeader
        eyebrow={`${screen.count} of ${screen.universe} pass`}
        title={screen.name}
        lead={copy ? copy.question : `Every rated token that clears this filter, ranked by composite score.`}
        meta={`Scoring pass ${formatDate(meta.source_updated_at)}. Market snapshot ${formatDate(meta.market_fetched_at)}.`}
      />

      <Section>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Pass" value={String(screen.count)} note={`${passRate}% of ${screen.universe}`} />
          <Stat label="Median score" value={`${screen.median_score}/250`} note={`range ${screen.bottom_score} to ${screen.top_score}`} />
          <Stat label="Best" value={`${screen.top_score}/250`} note={members[0].symbol} />
          <Stat
            label="Smallest that passes"
            value={smallest === null ? "n/a" : formatUsd(smallest.market_cap)}
            note={smallest === null ? undefined : smallest.symbol}
          />
        </div>
      </Section>

      {copy && (
        <Section>
          <SectionLabel number="01" title="What this screen asks" />
          <Prose>{copy.rule}</Prose>
          <Prose>{copy.why}</Prose>
        </Section>
      )}

      <Section>
        <SectionLabel number="02" title={`The ${members.length} that pass`} />
        <Prose>
          Ranked by composite score, not by how far each one clears the filter. A token near the
          bottom of this table still passes, so read the score column rather than the order alone.
        </Prose>
        <ScreenTable rows={members} caption={`${members.length} tokens passing the ${screen.name} screen`} />
        {screen.impaired_count > 0 && (
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-warning">
            {screen.impaired_count === 1
              ? "One member is marked impaired, meaning its own published text reports the protocol is currently offline or wound down."
              : `${screen.impaired_count} members are marked impaired, meaning their own published text reports the protocol is currently offline or wound down.`}{" "}
            The score predates that, so treat those rows as history rather than a shortlist.
          </p>
        )}
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-text-tertiary">
          Scores come from the research pass dated {formatDate(meta.source_updated_at)} and do not move
          with price. Market capitalisation is from the snapshot fetched {formatDate(meta.market_fetched_at)}.
        </p>
      </Section>

      <WorkbenchCTA
        placement="screen"
        heading="Check this shortlist against your own evidence."
        body="A screen gives you names, not a decision. Put the ones you care about into the Workbench. Record each source and its date, and keep fees apart from holder revenue."
      />

      <Section>
        <SectionLabel number="03" title="Common questions" />
        <dl className="mt-6 space-y-6">
          {faqs.map((faq) => (
            <div key={faq.question}>
              <dt className="text-[1.0625rem] font-semibold text-text-primary">{faq.question}</dt>
              <dd className="mt-2 max-w-3xl text-[1.0625rem] leading-[1.75] text-text-secondary">
                {faq.answer}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section divider>
        <EyebrowLabel>Keep reading</EyebrowLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/scorecard/screen" className="block rounded-2xl border border-border bg-bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active">
            <span className="block text-sm font-semibold text-text-primary">Every screen</span>
            <span className="mt-1.5 block text-xs leading-relaxed text-text-secondary">
              Ten filters over the same rated universe, each answering one question.
            </span>
          </Link>
          <Link href="/scorecard/mispriced" className="block rounded-2xl border border-border bg-bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active">
            <span className="block text-sm font-semibold text-text-primary">Where the market disagrees</span>
            <span className="mt-1.5 block text-xs leading-relaxed text-text-secondary">
              Fundamental rank against market-cap rank, and the widest gaps either way.
            </span>
          </Link>
          <Link href="/scorecard" className="block rounded-2xl border border-border bg-bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active">
            <span className="block text-sm font-semibold text-text-primary">
              All {screen.universe} rated tokens
            </span>
            <span className="mt-1.5 block text-xs leading-relaxed text-text-secondary">
              The full ranking table and the method behind the 25 variables.
            </span>
          </Link>
        </div>
      </Section>

      <p className="mt-16 max-w-3xl text-xs leading-relaxed text-text-tertiary">
        Research and analysis, not investment advice. A screen is one filter applied consistently, not
        a recommendation.
      </p>
    </div>
  );
}

/** A single headline statistic. */
function Stat({ label, value, note }: { readonly label: string; readonly value: string; readonly note?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-5">
      <div className="font-mono text-xs uppercase tracking-wider text-text-tertiary">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold text-text-primary">{value}</div>
      {note && <div className="mt-1 text-xs leading-snug text-text-tertiary">{note}</div>}
    </div>
  );
}
