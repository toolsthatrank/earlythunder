import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import WorkbenchCTA from "@/components/WorkbenchCTA";
import { PageHeader, SectionLabel, Prose, EyebrowLabel, Section } from "@/components/PageChrome";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getScorecardMeta, type ScorecardToken } from "@/lib/scorecard-analytics";
import {
  getAllPairs,
  getPairRef,
  getPairsFor,
  buildHeadToHead,
  buildPairFindings,
  buildPairFaqs,
  type HeadToHead,
  type VariableDuel,
} from "@/lib/scorecard-pairs";
import {
  ordinal,
  formatUsd,
  formatPrice,
  formatDate,
  formatMultiple,
} from "@/lib/scorecard-insight";
import { getBreadcrumbListSchema, getFaqPageSchema } from "@/lib/structured-data";

/** Variables are grouped into these six themes on the head-to-head table. */
const GROUP_ORDER = ["Cash flow", "Supply", "Ownership", "Traction", "Position", "Risk"] as const;
const RELATED_LIMIT = 7;

interface PageParams {
  readonly params: Promise<{ readonly pair: string }>;
}

/** One static route per curated pair. */
export function generateStaticParams(): { pair: string }[] {
  const pairs = getAllPairs();
  if (pairs.length === 0) return [];
  return pairs.map((pair) => ({ pair: pair.slug }));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { pair: slug } = await params;
  const ref = getPairRef(slug);
  if (ref === null) return { title: "Comparison Not Found" };
  const h2h = buildHeadToHead(ref.a, ref.b);
  if (h2h === null) return { title: "Comparison Not Found" };

  const { a, b } = h2h;
  const leader = a.score >= b.score ? a : b;
  // The name form reads better, but a long pair of names pushes the rendered
  // title past what a result page shows, so it falls back to the ticker form.
  const named = `${a.symbol} vs ${b.symbol}, ${a.name} or ${b.name}`;
  const title = named.length <= 52 ? named : `${a.symbol} vs ${b.symbol} compared on 25 variables`;
  const description =
    `${a.symbol} scores ${a.score} of ${a.max_score} against ${b.score} for ${b.symbol} across 25 ` +
    `fundamental variables. ${a.symbol} wins ${h2h.aWins}, ${b.symbol} wins ${h2h.bWins}. ` +
    `${leader.symbol} is rated ${leader.verdict}` +
    (h2h.divergences.length > 0
      ? `, and the largest gap between them is ${h2h.divergences[0].label}.`
      : ", and no single variable separates them by three points.");

  return {
    title,
    description,
    keywords: [
      `${a.symbol} vs ${b.symbol}`,
      `${b.symbol} vs ${a.symbol}`,
      `${a.name} vs ${b.name}`,
      `${a.symbol} or ${b.symbol}`,
      `is ${a.symbol} better than ${b.symbol}`,
      `${a.symbol} ${b.symbol} comparison`,
    ],
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: `${SITE_URL}/scorecard/compare/${ref.slug}`,
      type: "article",
    },
    twitter: { card: "summary_large_image", title: `${title} | ${SITE_NAME}`, description },
    alternates: { canonical: `${SITE_URL}/scorecard/compare/${ref.slug}` },
  };
}

/** Colour for a 1-10 variable score. */
function scoreTone(value: number): string {
  if (value >= 7) return "text-positive";
  if (value >= 4) return "text-warning";
  return "text-negative";
}

/** One variable, scored on both sides, with the gap called. */
function DuelRow({ duel, aSymbol, bSymbol }: {
  readonly duel: VariableDuel;
  readonly aSymbol: string;
  readonly bSymbol: string;
}) {
  const winner = duel.diff > 0 ? aSymbol : duel.diff < 0 ? bSymbol : null;
  return (
    <tr className="border-b border-border/40">
      <td className="w-56 py-3 pr-5 text-sm leading-snug text-text-secondary md:whitespace-nowrap">
        {duel.label}
      </td>
      <td className={`w-14 py-3 text-right font-mono text-sm font-semibold ${scoreTone(duel.a)}`}>
        {duel.a}
      </td>
      <td className="w-full px-4 py-3">
        <div className="flex h-2 items-center gap-1">
          <div className="flex flex-1 justify-end">
            <div
              className={`h-2 rounded-l-full ${duel.diff > 0 ? "bg-positive" : "bg-text-tertiary/40"}`}
              style={{ width: `${(duel.a / 10) * 100}%` }}
            />
          </div>
          <span className="h-3 w-px bg-border" aria-hidden="true" />
          <div className="flex flex-1 justify-start">
            <div
              className={`h-2 rounded-r-full ${duel.diff < 0 ? "bg-positive" : "bg-text-tertiary/40"}`}
              style={{ width: `${(duel.b / 10) * 100}%` }}
            />
          </div>
        </div>
      </td>
      <td className={`w-14 py-3 text-left font-mono text-sm font-semibold ${scoreTone(duel.b)}`}>
        {duel.b}
      </td>
      <td className="whitespace-nowrap py-3 pl-4 text-right font-mono text-[11px] text-text-tertiary">
        {winner === null ? "level" : `${winner} +${Math.abs(duel.diff)}`}
      </td>
    </tr>
  );
}

/** Side-by-side market and supply facts. */
function FactRow({ label, a, b }: { readonly label: string; readonly a: string; readonly b: string }) {
  return (
    <tr className="border-b border-border/50">
      <td className="px-5 py-3.5 text-text-tertiary">{label}</td>
      <td className="px-5 py-3.5 text-right font-mono text-text-primary">{a}</td>
      <td className="px-5 py-3.5 text-right font-mono text-text-primary">{b}</td>
    </tr>
  );
}

/** Catalyst and risk for one side of the comparison. */
function SideNotes({ token }: { readonly token: ScorecardToken }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-6">
      <EyebrowLabel>
        {token.symbol} &middot; {token.verdict}
      </EyebrowLabel>
      {token.key_catalyst && (
        <>
          <div className="font-mono text-[11px] uppercase tracking-wider text-text-tertiary">
            Catalyst
          </div>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-text-secondary">
            {token.key_catalyst}
          </p>
        </>
      )}
      {token.key_risk && (
        <>
          <div className="mt-5 font-mono text-[11px] uppercase tracking-wider text-text-tertiary">
            Principal risk
          </div>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-text-secondary">{token.key_risk}</p>
        </>
      )}
    </div>
  );
}

/** Headline comparison stat. */
function Stat({ label, value, note }: {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-5">
      <div className="font-mono text-xs uppercase tracking-wider text-text-tertiary">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold text-text-primary">{value}</div>
      {note && <div className="mt-1 text-xs leading-snug text-text-tertiary">{note}</div>}
    </div>
  );
}

/** The 25-variable table, split into its six themes. */
function DuelTable({ h2h }: { readonly h2h: HeadToHead }) {
  return (
    <div className="mt-8 max-w-5xl space-y-9">
      {GROUP_ORDER.map((group) => {
        const rows = h2h.duels.filter((d) => d.group === group);
        if (rows.length === 0) return null;
        return (
          <div key={group}>
            <EyebrowLabel>{group}</EyebrowLabel>
            <table className="w-full table-auto">
              <caption className="sr-only">
                {group} variables compared between {h2h.a.symbol} and {h2h.b.symbol}
              </caption>
              <tbody>
                {rows.map((duel) => (
                  <DuelRow
                    key={duel.key}
                    duel={duel}
                    aSymbol={h2h.a.symbol}
                    bSymbol={h2h.b.symbol}
                  />
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <p className="text-xs leading-relaxed text-text-tertiary">
        Bars read outward from the centre, with {h2h.a.symbol} to the left, {h2h.b.symbol} to the right.
        The side that leads a variable is filled. Each score is 1 to 10 against the same definition
        applied to all {h2h.a.universe_size} rated tokens.
      </p>
    </div>
  );
}

export default async function ComparePage({ params }: PageParams) {
  const { pair: slug } = await params;
  const ref = getPairRef(slug);
  if (ref === null) notFound();
  const h2h = buildHeadToHead(ref.a, ref.b);
  if (h2h === null) notFound();

  const { a, b } = h2h;
  const meta = getScorecardMeta();
  const findings = buildPairFindings(h2h);
  const faqs = buildPairFaqs(h2h);
  const leader = a.score >= b.score ? a : b;
  const renamed = [a, b].filter(
    (token) => typeof token.market.renamed_to === "string" && token.market.renamed_to.length > 0,
  );
  const related = [...getPairsFor(a.slug, RELATED_LIMIT), ...getPairsFor(b.slug, RELATED_LIMIT)]
    .filter((p) => p.slug !== ref.slug)
    .slice(0, RELATED_LIMIT);

  const breadcrumbs = getBreadcrumbListSchema([
    { name: "Home", path: "/" },
    { name: "Scorecard", path: "/scorecard" },
    { name: "Compare", path: "/scorecard/compare" },
    { name: `${a.symbol} vs ${b.symbol}`, path: `/scorecard/compare/${ref.slug}` },
  ]);
  const faqSchema = getFaqPageSchema(faqs);

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <JsonLd data={breadcrumbs} />
      {faqSchema && <JsonLd data={faqSchema} />}

      <nav aria-label="Breadcrumb" className="mb-8 font-mono text-xs text-text-tertiary">
        <Link href="/" className="hover:text-text-secondary">
          Home
        </Link>
        <span className="px-2">/</span>
        <Link href="/scorecard" className="hover:text-text-secondary">
          Scorecard
        </Link>
        <span className="px-2">/</span>
        <Link href="/scorecard/compare" className="hover:text-text-secondary">
          Compare
        </Link>
        <span className="px-2">/</span>
        <span className="text-text-secondary">
          {a.symbol} vs {b.symbol}
        </span>
      </nav>

      <PageHeader
        eyebrow={
          ref.reason === "profile"
            ? "Similar fundamental profile"
            : ref.reason === "chain"
              ? `Both on ${a.chain ?? b.chain}`
              : "Market-cap peers"
        }
        title={`${a.symbol} vs ${b.symbol}`}
        lead={`${a.name} and ${b.name} scored on the same 25 variables, ranked against the same ${a.universe_size} tokens, with every gap between them shown.`}
        meta={`Scoring pass ${formatDate(meta.source_updated_at)}. Market snapshot ${formatDate(meta.market_data.fetched_at)}.`}
      />

      <Section>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat
            label={`${a.symbol} score`}
            value={`${a.score}/${a.max_score}`}
            note={`${ordinal(a.rank_overall)} of ${a.universe_size} · ${a.verdict}`}
          />
          <Stat
            label={`${b.symbol} score`}
            value={`${b.score}/${b.max_score}`}
            note={`${ordinal(b.rank_overall)} of ${b.universe_size} · ${b.verdict}`}
          />
          <Stat
            label="Variables won"
            value={`${h2h.aWins} to ${h2h.bWins}`}
            note={`${h2h.ties} level of ${h2h.duels.length}`}
          />
          <Stat
            label="Framework prefers"
            value={a.score === b.score ? "tie" : leader.symbol}
            note={
              a.score === b.score
                ? "identical composite"
                : `by ${Math.abs(a.score - b.score)} points`
            }
          />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/scorecard/${a.slug}`}
            className="rounded-full border border-border px-4 py-1.5 font-mono text-xs text-text-secondary transition-colors duration-200 hover:border-border-active hover:text-text-primary"
          >
            {a.name} scorecard
          </Link>
          <Link
            href={`/scorecard/${b.slug}`}
            className="rounded-full border border-border px-4 py-1.5 font-mono text-xs text-text-secondary transition-colors duration-200 hover:border-border-active hover:text-text-primary"
          >
            {b.name} scorecard
          </Link>
        </div>
      </Section>

      <Section>
        <SectionLabel number="01" title="What separates them" />
        <div className="mt-8 max-w-3xl space-y-7">
          {findings.map((finding) => (
            <p key={finding.label} className="text-[1.0625rem] leading-[1.8] text-text-secondary">
              {finding.text}
            </p>
          ))}
        </div>
      </Section>

      <Section>
        <SectionLabel number="02" title="All 25 variables, head to head" />
        <Prose>
          Both tokens were scored by the same framework in the same pass, so the numbers are directly
          comparable. What a comparison adds over two separate pages is the gap: a 6 against a 6 is a
          non-event, a 9 against a 3 is the reason to hold one and not the other.
        </Prose>
        <DuelTable h2h={h2h} />
      </Section>

      <WorkbenchCTA
        placement="compare"
        heading={`Compare ${a.symbol} and ${b.symbol} with your own sources.`}
        body={`The scores above are ours. The Workbench is where you check them. Record each revenue figure for ${a.symbol} and ${b.symbol} with its source and date. Keep fees apart from holder revenue and see which evidence is getting old.`}
      />

      <Section>
        <SectionLabel number="03" title="Market and supply" />
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Market and supply figures for {a.symbol} and {b.symbol}
            </caption>
            <thead>
              <tr className="border-b border-border text-right font-mono text-xs uppercase tracking-wider text-text-tertiary">
                <th className="px-5 py-3 text-left"> </th>
                <th className="px-5 py-3">{a.symbol}</th>
                <th className="px-5 py-3">{b.symbol}</th>
              </tr>
            </thead>
            <tbody>
              <FactRow
                label="Price"
                a={formatPrice(a.market.price)}
                b={formatPrice(b.market.price)}
              />
              <FactRow
                label="Market cap"
                a={formatUsd(a.market.market_cap)}
                b={formatUsd(b.market.market_cap)}
              />
              <FactRow
                label="Circulating"
                a={a.dilution.circ_pct === null ? "n/a" : `${a.dilution.circ_pct}%`}
                b={b.dilution.circ_pct === null ? "n/a" : `${b.dilution.circ_pct}%`}
              />
              <FactRow
                label="Dilution to full supply"
                a={a.dilution.dilution_x === null ? "n/a" : `${a.dilution.dilution_x}x`}
                b={b.dilution.dilution_x === null ? "n/a" : `${b.dilution.dilution_x}x`}
              />
              <FactRow
                label="Off all-time high"
                a={a.drawdown.distance_pct === null ? "n/a" : `${a.drawdown.distance_pct}%`}
                b={b.drawdown.distance_pct === null ? "n/a" : `${b.drawdown.distance_pct}%`}
              />
              <FactRow
                label="To recover the high"
                a={formatMultiple(a.drawdown.recovery_x)}
                b={formatMultiple(b.drawdown.recovery_x)}
              />
              <FactRow
                label="Total value locked"
                a={a.tvl.tvl === null || a.tvl.tvl === 0 ? "not published" : formatUsd(a.tvl.tvl)}
                b={b.tvl.tvl === null || b.tvl.tvl === 0 ? "not published" : formatUsd(b.tvl.tvl)}
              />
              <FactRow label="Network" a={a.chain ?? "n/a"} b={b.chain ?? "n/a"} />
            </tbody>
          </table>
        </div>
        {renamed.length > 0 && (
          <p className="mt-4 max-w-3xl text-[0.95rem] leading-relaxed text-warning">
            {renamed
              .map((t) => `${t.symbol} now trades as ${t.market.renamed_to}`)
              .join(", and ")}
            . The scoring pass ran under the old {renamed.length === 1 ? "ticker" : "tickers"}, so the
            scores above are filed there while the market figures track the new one.
          </p>
        )}
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-text-tertiary">
          Price, market cap and all-time high from the CoinGecko snapshot fetched{" "}
          {formatDate(meta.market_data.fetched_at)}. Supply shares are derived from circulating and
          eventual supply counts, which do not move with price. The 25 scores come from the research
          pass dated {formatDate(meta.source_updated_at)}.
        </p>
      </Section>

      {(a.key_catalyst || a.key_risk || b.key_catalyst || b.key_risk) && (
        <Section>
          <SectionLabel number="04" title="Catalyst and risk on each side" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <SideNotes token={a} />
            <SideNotes token={b} />
          </div>
        </Section>
      )}

      {faqs.length > 0 && (
        <Section>
          <SectionLabel number="05" title="Common questions" />
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
      )}

      {related.length > 0 && (
        <Section>
          <SectionLabel number="06" title="Related comparisons" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((pair) => (
              <Link
                key={pair.slug}
                href={`/scorecard/compare/${pair.slug}`}
                className="block rounded-xl border border-border bg-bg-card px-5 py-4 font-mono text-sm text-text-secondary transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active hover:text-text-primary"
              >
                {pair.a.toUpperCase()} vs {pair.b.toUpperCase()}
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section divider>
        <EyebrowLabel>Keep reading</EyebrowLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/scorecard/compare"
            className="block rounded-2xl border border-border bg-bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active"
          >
            <span className="block text-sm font-semibold text-text-primary">All comparisons</span>
            <span className="mt-1.5 block text-xs leading-relaxed text-text-secondary">
              Every curated head-to-head across the rated universe.
            </span>
          </Link>
          <Link
            href="/scorecard/signal"
            className="block rounded-2xl border border-border bg-bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active"
          >
            <span className="block text-sm font-semibold text-text-primary">
              The 25 variables, ranked
            </span>
            <span className="mt-1.5 block text-xs leading-relaxed text-text-secondary">
              Which of them the market pays for, and which it ignores.
            </span>
          </Link>
          <Link
            href="/scorecard"
            className="block rounded-2xl border border-border bg-bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active"
          >
            <span className="block text-sm font-semibold text-text-primary">
              All {a.universe_size} rated tokens
            </span>
            <span className="mt-1.5 block text-xs leading-relaxed text-text-secondary">
              The full ranking table and the method behind the scores.
            </span>
          </Link>
        </div>
      </Section>

      <p className="mt-16 max-w-3xl text-xs leading-relaxed text-text-tertiary">
        Research and analysis, not investment advice. A higher score is one framework applied
        consistently to {a.universe_size} tokens, not a prediction that one asset will outperform the
        other.
      </p>
    </div>
  );
}
