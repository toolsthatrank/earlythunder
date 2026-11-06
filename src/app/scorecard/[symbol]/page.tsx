import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import WorkbenchCTA from "@/components/WorkbenchCTA";
import { PageHeader, SectionLabel, Prose, EyebrowLabel, Section } from "@/components/PageChrome";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import {
  getAllScorecardTokens,
  getScorecardToken,
  getScorecardMeta,
  getScorecardGroups,
  type ScorecardToken,
  type ScoredVariable,
} from "@/lib/scorecard-analytics";
import {
  buildFindings,
  buildFaqs,
  buildSummary,
  splitLead,
  ordinal,
  formatUsd,
  formatPrice,
  formatDate,
  formatMultiple,
} from "@/lib/scorecard-insight";
import { getBreadcrumbListSchema, getFaqPageSchema } from "@/lib/structured-data";
import { signalSlug, buildTokenPricingFinding } from "@/lib/scorecard-signals";
import { getPairsFor } from "@/lib/scorecard-pairs";
import { getAllTiers } from "@/lib/scorecard-tiers";

/** Variables are grouped into these six themes on the breakdown table. */
const GROUP_ORDER = ["Cash flow", "Supply", "Ownership", "Traction", "Position", "Risk"] as const;

const MAX_CITATIONS = 12;
/** Head-to-head pages surfaced from a token page. */
const MAX_COMPARISONS = 8;

interface PageParams {
  readonly params: Promise<{ readonly symbol: string }>;
}

/** One static route per rated token. */
export function generateStaticParams(): { symbol: string }[] {
  const tokens = getAllScorecardTokens();
  if (tokens.length === 0) return [];
  return tokens.map((token) => ({ symbol: token.slug }));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { symbol } = await params;
  const token = getScorecardToken(symbol);
  if (token === null) return { title: "Token Not Found" };

  // Long token names push the rendered title past what a result page shows.
  const named = `${token.name} (${token.symbol}) Score and Fundamentals`;
  const title = named.length <= 52 ? named : `${token.name} (${token.symbol}) Score`;
  const description = buildSummary(token).slice(0, 300);
  const url = `${SITE_URL}/scorecard/${token.slug}`;

  return {
    title,
    description,
    keywords: [
      `${token.symbol} score`,
      `${token.name} fundamentals`,
      `is ${token.symbol} a good investment`,
      `${token.symbol} tokenomics`,
      `${token.symbol} vesting schedule`,
      `${token.symbol} all time high`,
    ],
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url, type: "article" },
    twitter: { card: "summary_large_image", title: `${title} | ${SITE_NAME}`, description },
    alternates: { canonical: url },
  };
}

/** Colour for a 1-10 variable score. */
function scoreTone(value: number): string {
  if (value >= 7) return "text-positive";
  if (value >= 4) return "text-warning";
  return "text-negative";
}

/** A single headline statistic. */
function Stat({
  label,
  value,
  note,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
  readonly tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-5">
      <div className="font-mono text-xs uppercase tracking-wider text-text-tertiary">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-semibold ${tone ?? "text-text-primary"}`}>{value}</div>
      {note && <div className="mt-1 text-xs leading-snug text-text-tertiary">{note}</div>}
    </div>
  );
}

/** Horizontal bar showing a variable's 1-10 value against the universe median. */
function VariableRow({ variable, universe }: { readonly variable: ScoredVariable; readonly universe: number }) {
  const width = Math.max(2, (variable.value / 10) * 100);
  const medianLeft = variable.universe_median !== null ? (variable.universe_median / 10) * 100 : null;

  return (
    <tr className="border-b border-border/40">
      <td className="w-52 whitespace-nowrap py-3 pr-6 text-sm text-text-secondary">
        <Link href={`/scorecard/signal/${signalSlug(variable.key)}`} className="hover:text-info">
          {variable.label}
        </Link>
      </td>
      <td className="w-full py-3 pr-6">
        <div className="relative h-2 rounded-full bg-bg-base">
          <div
            className={`h-2 rounded-full ${variable.value >= 7 ? "bg-positive" : variable.value >= 4 ? "bg-warning" : "bg-negative"}`}
            style={{ width: `${width}%` }}
          />
          {medianLeft !== null && (
            <span
              className="absolute top-[-3px] h-[14px] w-px bg-text-tertiary/70"
              style={{ left: `${medianLeft}%` }}
              aria-hidden="true"
            />
          )}
        </div>
      </td>
      <td className={`py-3 pr-4 text-right font-mono text-sm font-semibold ${scoreTone(variable.value)}`}>
        {variable.value}
      </td>
      <td className="whitespace-nowrap py-3 text-right font-mono text-xs text-text-tertiary">
        {ordinal(variable.rank)} of {universe}
      </td>
    </tr>
  );
}

/** The 25-variable breakdown, split into its six themes. */
function Breakdown({ token }: { readonly token: ScorecardToken }) {
  return (
    <div className="mt-8 max-w-3xl space-y-9">
      {GROUP_ORDER.map((group) => {
        const rows = token.variables.filter((v) => v.group === group);
        if (rows.length === 0) return null;
        return (
          <div key={group}>
            <EyebrowLabel>{group}</EyebrowLabel>
            <table className="w-full table-auto">
              <caption className="sr-only">
                {group} variables for {token.symbol}, scored 1 to 10 and ranked against{" "}
                {token.universe_size} tokens
              </caption>
              <tbody>
                {rows.map((variable) => (
                  <VariableRow key={variable.key} variable={variable} universe={token.universe_size} />
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <p className="text-xs leading-relaxed text-text-tertiary">
        The vertical tick on each bar marks the median score across all {token.universe_size} rated
        tokens, so a bar ending left of the tick is below the universe on that variable.
      </p>
    </div>
  );
}

export default async function ScorecardTokenPage({ params }: PageParams) {
  const { symbol } = await params;
  const token = getScorecardToken(symbol);
  if (token === null) notFound();

  const meta = getScorecardMeta();
  const pricingFinding = buildTokenPricingFinding(token);
  const findings = [...buildFindings(token), ...(pricingFinding === null ? [] : [pricingFinding])];
  const faqs = buildFaqs(token);
  const summary = buildSummary(token);
  const url = `${SITE_URL}/scorecard/${token.slug}`;
  const hasMarket = token.market.source === "coingecko";
  const marketAsOf = formatDate(meta.market_data.fetched_at);
  const deadLinks = token.citations.filter((c) => !c.link_ok).length;
  const catalystExpired = token.catalyst_expired_dates.length > 0;
  const comparisons = getPairsFor(token.slug, MAX_COMPARISONS);
  // A long one-liner is a stack of fragments. The opening sits under the title
  // and the remainder follows it, so the page keeps every fact without a wall.
  const headline = splitLead(token.one_liner ?? summary);
  // Chain hubs exist only for chains with enough rated tokens to aggregate, so
  // linking every chain unconditionally pointed 86 token pages at a 404.
  const chainSlug =
    token.chain === null ? null : token.chain.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const chainHubSlug =
    chainSlug === null
      ? null
      : (getScorecardGroups("chain").find((g) => g.slug === chainSlug)?.slug ?? null);
  const cap = token.market.market_cap;
  const sizeTier =
    cap === null || !Number.isFinite(cap)
      ? null
      : (getAllTiers().find((t) => cap >= t.floor && (t.ceiling === null || cap < t.ceiling)) ?? null);

  const breadcrumbs = getBreadcrumbListSchema([
    { name: "Home", path: "/" },
    { name: "Scorecard", path: "/scorecard" },
    { name: `${token.name} (${token.symbol})`, path: `/scorecard/${token.slug}` },
  ]);
  const faqSchema = getFaqPageSchema(faqs);

  const datasetSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${token.name} (${token.symbol}) 25-variable fundamental scorecard`,
    description: summary,
    url,
    creator: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    isAccessibleForFree: true,
    variableMeasured: token.variables.map((v) => ({
      "@type": "PropertyValue",
      name: v.label,
      value: v.value,
      maxValue: 10,
      minValue: 1,
    })),
    ...(hasMarket
      ? {
          temporalCoverage: meta.market_data.fetched_at,
          distribution: {
            "@type": "DataDownload",
            contentUrl: `https://www.coingecko.com/en/coins/${token.market.coingecko_id}`,
            encodingFormat: "text/html",
          },
        }
      : {}),
    isBasedOn: [
      ...(hasMarket
        ? [
            {
              "@type": "CreativeWork",
              name: "CoinGecko market data",
              url: `https://www.coingecko.com/en/coins/${token.market.coingecko_id}`,
            },
          ]
        : []),
      ...token.citations
        .filter((c) => c.link_ok && typeof c.url === "string" && c.url.length > 0)
        .slice(0, MAX_CITATIONS)
        .map((c) => ({ "@type": "CreativeWork", name: c.source, url: c.url })),
    ],
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <JsonLd data={breadcrumbs} />
      <JsonLd data={datasetSchema} />
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
        <span className="text-text-secondary">{token.symbol}</span>
      </nav>

      <PageHeader
        eyebrow={token.verdict}
        title={`${token.name} (${token.symbol})`}
        lead={headline.lead || summary}
        sub={headline.rest || undefined}
        meta={`Ranked ${ordinal(token.rank_overall)} of ${token.universe_size} rated tokens. Scoring pass ${formatDate(meta.source_updated_at)}.`}
      />

      <Section>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat
            label="Score"
            value={`${token.score}/${token.max_score}`}
            note={`${ordinal(token.rank_overall)} of ${token.universe_size}`}
            tone={scoreTone(token.score / 25)}
          />
          <Stat
            label="Percentile"
            value={token.percentile_overall === null ? "n/a" : `${token.percentile_overall}%`}
            note="of the rated universe"
          />
          <Stat
            label="Circulating"
            value={token.dilution.circ_pct === null ? "n/a" : `${token.dilution.circ_pct}%`}
            note={
              token.dilution.overhang_pct === null
                ? "supply data not published"
                : `${token.dilution.overhang_pct}% of value still to vest`
            }
          />
          <Stat
            label="Off all-time high"
            value={token.drawdown.distance_pct === null ? "n/a" : `${token.drawdown.distance_pct}%`}
            note={token.drawdown.recovery_x === null ? undefined : `${formatMultiple(token.drawdown.recovery_x)} to recover`}
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          {token.chain &&
            (chainHubSlug === null ? (
              <span className="font-mono text-xs text-text-tertiary">{token.chain}</span>
            ) : (
              <Link
                href={`/scorecard/chain/${chainHubSlug}`}
                className="font-mono text-xs text-info hover:underline"
              >
                {token.chain}
              </Link>
            ))}
          {sizeTier !== null && (
            <Link
              href={`/scorecard/size/${sizeTier.slug}`}
              className="font-mono text-xs text-info hover:underline"
            >
              {sizeTier.name}
            </Link>
          )}
          {token.token_standard && (
            <span className="font-mono text-xs text-text-tertiary">{token.token_standard}</span>
          )}
          {token.score_delta !== null && token.score_delta !== 0 && (
            <span
              className={`font-mono text-xs ${token.score_delta > 0 ? "text-positive" : "text-negative"}`}
            >
              {token.score_delta > 0 ? "+" : ""}
              {token.score_delta} since last pass
            </span>
          )}
        </div>
      </Section>

      <Section>
        <SectionLabel number="01" title="What the numbers say" />
        <div className="mt-8 max-w-3xl space-y-7">
          {findings.map((finding) => (
            <p
              key={finding.label}
              className="text-[1.0625rem] leading-[1.8] text-text-secondary"
            >
              {finding.text}
            </p>
          ))}
        </div>
      </Section>

      <Section>
        <SectionLabel number="02" title="25-variable breakdown" />
        <Prose>
          Each variable is scored 1 to 10 and ranked against every other rated token, so a 7 that
          ranks {ordinal(20)} means something different from a 7 that ranks {ordinal(180)}. The rank
          is the part that is hard to get anywhere else.
        </Prose>
        <Breakdown token={token} />
      </Section>

      <WorkbenchCTA
        placement="token"
        heading={`Keep your own ${token.symbol} research next to its sources.`}
        body={`This page gives our score. The Workbench holds your evidence. Record each ${token.symbol} figure with its source and date, and compare it with other projects over the same period.`}
      />

      {(token.key_catalyst || token.key_risk) && (
        <Section>
          <SectionLabel number="03" title="Catalyst and risk" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {token.key_catalyst && (
              <div className="rounded-2xl border border-border bg-bg-card p-6">
                <EyebrowLabel>{catalystExpired ? "Catalyst on the scorecard" : "Next catalyst"}</EyebrowLabel>
                <p className="text-[0.95rem] leading-relaxed text-text-secondary">{token.key_catalyst}</p>
                {catalystExpired && (
                  <p className="mt-3 text-xs leading-relaxed text-warning">
                    {token.catalyst_expired_dates.length === 1
                      ? `The ${token.catalyst_expired_dates[0]} item has already passed.`
                      : `These items have already passed: ${token.catalyst_expired_dates.join(", ")}.`}{" "}
                    This was written as forward-looking at the {formatDate(meta.source_updated_at)}{" "}
                    scoring pass, so read those parts as history. Anything else listed may still be
                    ahead.
                  </p>
                )}
              </div>
            )}
            {token.key_risk && (
              <div className="rounded-2xl border border-border bg-bg-card p-6">
                <EyebrowLabel>Principal risk</EyebrowLabel>
                <p className="text-[0.95rem] leading-relaxed text-text-secondary">{token.key_risk}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section>
        <SectionLabel number="04" title="Market and supply" />
        {token.market.renamed_to && (
          <Prose>
            {token.symbol} now trades as {token.market.renamed_to}. The scoring pass ran under the
            old ticker, so the scores below are filed under {token.symbol} while the market figures
            track {token.market.renamed_to}.
          </Prose>
        )}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border/50">
                <td className="px-5 py-3.5 text-text-tertiary">Price</td>
                <td className="px-5 py-3.5 text-right font-mono text-text-primary">
                  {formatPrice(token.market.price)}
                </td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="px-5 py-3.5 text-text-tertiary">Market cap</td>
                <td className="px-5 py-3.5 text-right font-mono text-text-primary">
                  {formatUsd(token.market.market_cap)}
                  {token.market.market_cap_rank !== null && (
                    <span className="ml-2 text-text-tertiary">
                      rank {token.market.market_cap_rank}
                    </span>
                  )}
                </td>
              </tr>
              {token.drawdown.ath !== null && (
                <tr className="border-b border-border/50">
                  <td className="px-5 py-3.5 text-text-tertiary">All-time high</td>
                  <td className="px-5 py-3.5 text-right font-mono text-text-primary">
                    {formatPrice(token.drawdown.ath)}
                    {token.drawdown.ath_date && (
                      <span className="ml-2 text-text-tertiary">
                        {formatDate(token.drawdown.ath_date)}
                      </span>
                    )}
                  </td>
                </tr>
              )}
              <tr className="border-b border-border/50">
                <td className="px-5 py-3.5 text-text-tertiary">Circulating supply</td>
                <td className="px-5 py-3.5 text-right font-mono text-text-primary">
                  {token.dilution.circulating_supply === null
                    ? "not published"
                    : token.dilution.circulating_supply.toLocaleString("en-US", {
                        maximumFractionDigits: 0,
                      })}
                </td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="px-5 py-3.5 text-text-tertiary">
                  Eventual supply ({token.dilution.basis.replace("_", " ")})
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-text-primary">
                  {token.dilution.eventual_supply === null
                    ? "uncapped"
                    : token.dilution.eventual_supply.toLocaleString("en-US", {
                        maximumFractionDigits: 0,
                      })}
                </td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="px-5 py-3.5 text-text-tertiary">Dilution to full supply</td>
                <td className="px-5 py-3.5 text-right font-mono text-text-primary">
                  {token.dilution.dilution_x === null ? "n/a" : `${token.dilution.dilution_x}x`}
                </td>
              </tr>
              {token.tvl.tvl !== null && token.tvl.tvl > 0 && (
                <tr className="border-b border-border/50">
                  <td className="px-5 py-3.5 text-text-tertiary">Total value locked</td>
                  <td className="px-5 py-3.5 text-right font-mono text-text-primary">{formatUsd(token.tvl.tvl)}</td>
                </tr>
              )}
              {token.where_to_buy.length > 0 && (
                <tr>
                  <td className="px-5 py-3.5 text-text-tertiary">Listed on</td>
                  <td className="px-5 py-3.5 text-right font-mono text-text-secondary">
                    {token.where_to_buy.join(", ")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-text-tertiary">
          {hasMarket ? (
            <>
              Price, market cap, supply and all-time high from{" "}
              <a
                href={`https://www.coingecko.com/en/coins/${token.market.coingecko_id}`}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-info hover:underline"
              >
                CoinGecko
              </a>
              , fetched {marketAsOf}. The 25 scores come from the research pass dated{" "}
              {formatDate(meta.source_updated_at)}{" "}
              and don&apos;t move with price.
            </>
          ) : (
            <>
              We couldn&apos;t match {token.symbol} to a live market row, so no price, market cap or
              all-time high is shown. Publishing the figure recorded at the scoring pass would mean
              putting a months-old number next to analysis that looks current. The 25 scores below
              stand on their own.
            </>
          )}
        </p>
      </Section>

      {token.neighbours.length > 0 && (
        <Section>
          <SectionLabel number="05" title="Tokens with a similar profile" />
          <Prose>
            These are the closest matches to {token.symbol} measured on the shape of all 25 variables
            after removing overall quality, so what they share is a pattern of strengths and
            weaknesses rather than a similar size or price.
          </Prose>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {token.neighbours.map((neighbour) => (
              <Link
                key={neighbour.symbol}
                href={`/scorecard/${neighbour.symbol.toLowerCase()}`}
                className="block rounded-2xl border border-border bg-bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-text-primary">
                    {neighbour.symbol}
                  </span>
                  <span className="font-mono text-xs text-text-tertiary">
                    {neighbour.score}/{token.max_score}
                  </span>
                </div>
                <div className="mt-1 text-xs text-text-secondary">{neighbour.name}</div>
                <div className="mt-2 font-mono text-[11px] text-text-tertiary">
                  {neighbour.verdict} &middot; profile match {Math.round(neighbour.similarity * 100)}%
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {comparisons.length > 0 && (
        <Section>
          <SectionLabel number="06" title={`${token.symbol} compared head to head`} />
          <Prose>
            Both sides of each comparison were scored by the same framework in the same pass, so the
            gap between them is a measurement rather than two readings taken with different rulers.
          </Prose>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {comparisons.map((pair) => {
              const other = pair.a === token.slug ? pair.b : pair.a;
              return (
                <Link
                  key={pair.slug}
                  href={`/scorecard/compare/${pair.slug}`}
                  className="block rounded-xl border border-border bg-bg-card px-5 py-4 font-mono text-sm text-text-secondary transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active hover:text-text-primary"
                >
                  {token.symbol} vs {other.toUpperCase()}
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {token.citations.length > 0 && (
        <Section>
          <SectionLabel number="07" title="Sources" />
          <ul className="mt-6 space-y-3">
            {token.citations.slice(0, MAX_CITATIONS).map((citation, index) => (
              <li key={index} className="text-sm leading-relaxed text-text-secondary">
                {citation.url && citation.link_ok ? (
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="font-mono text-xs text-info hover:underline"
                  >
                    [{citation.source}]
                  </a>
                ) : (
                  <span className="font-mono text-xs text-text-tertiary">[{citation.source}]</span>
                )}{" "}
                {citation.claim}
                {!citation.link_ok && (
                  <span className="ml-1 font-mono text-[11px] text-warning">
                    link dead, claim unverified
                  </span>
                )}
              </li>
            ))}
          </ul>
          {deadLinks > 0 && (
            <p className="mt-4 max-w-3xl text-xs leading-relaxed text-text-tertiary">
              {deadLinks === 1
                ? "One source link above no longer resolves, so we stripped the hyperlink rather than leave something that looks like evidence until you click it."
                : `${deadLinks} of the source links above no longer resolve, so we stripped those hyperlinks rather than leave something that looks like evidence until you click it.`}{" "}
              The claims stay visible because they are part of the research record, but treat them as
              unverified. Every link was rechecked {formatDate(meta.citation_links.checked_at)}.
            </p>
          )}
        </Section>
      )}

      {faqs.length > 0 && (
        <Section>
          <SectionLabel number="08" title="Common questions" />
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

      <Section divider>
        <EyebrowLabel>Keep reading</EyebrowLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {token.opportunity_slug && (
            <Link
              href={`/opportunities/${token.opportunity_slug}`}
              className="block rounded-2xl border border-border bg-bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active"
            >
              <span className="block text-sm font-semibold text-text-primary">
                {token.name} full research note
              </span>
              <span className="mt-1.5 block text-xs leading-relaxed text-text-secondary">
                On-chain detail, team, tokenomics, competitive position and the standing verdict.
              </span>
            </Link>
          )}
          <Link
            href={`/scorecard/verdict/${token.verdict.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            className="block rounded-2xl border border-border bg-bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active"
          >
            <span className="block text-sm font-semibold text-text-primary">
              Every token rated {token.verdict}
            </span>
            <span className="mt-1.5 block text-xs leading-relaxed text-text-secondary">
              The full band ranked by score, with what the group is collectively strong and weak on.
            </span>
          </Link>
          <Link
            href="/scorecard"
            className="block rounded-2xl border border-border bg-bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-active"
          >
            <span className="block text-sm font-semibold text-text-primary">
              All {token.universe_size} rated tokens
            </span>
            <span className="mt-1.5 block text-xs leading-relaxed text-text-secondary">
              The full ranking table and the method behind the 25 variables.
            </span>
          </Link>
        </div>
      </Section>

      <p className="mt-16 max-w-3xl text-xs leading-relaxed text-text-tertiary">
        Research and analysis, not investment advice. Scores are one framework applied
        consistently across {token.universe_size} tokens, not a prediction of price.
      </p>
    </div>
  );
}
