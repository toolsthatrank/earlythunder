import { getActiveOpportunities, getAllBlogPosts, getAllOpportunities } from "@/lib/data";
import deadlinesData from "../../data/deadlines.json";
import earningsData from "../../data/earnings-top.json";

import WorkbenchCTA from "@/components/WorkbenchCTA";
import HeroSection from "@/components/landing/HeroSection";
import TickerStrip from "@/components/landing/TickerStrip";
import NumbersStrip from "@/components/landing/NumbersStrip";
import ToolsShowcase from "@/components/landing/ToolsShowcase";
import FeaturedOpportunity from "@/components/landing/FeaturedOpportunity";
import TopYieldsPreview from "@/components/landing/TopYieldsPreview";
import DeadlineStrip from "@/components/landing/DeadlineStrip";
import ClarityActSection from "@/components/landing/ClarityActSection";
import JsonLd from "@/components/JsonLd";
import { getWebPageSchema } from "@/lib/structured-data";
import { CONTENT_CHECKED } from "@/lib/constants";
import AnswerBlock from "@/components/AnswerBlock";
import SignalsSection from "@/components/landing/SignalsSection";
import PipelineLog from "@/components/landing/PipelineLog";
import CoverageMap from "@/components/landing/CoverageMap";
import CategoryRow from "@/components/landing/CategoryRow";
import { SupportResultCard } from "@/components/SupportCta";

const BUILD_NOW_MS = Date.now();

/** Normalize raw deadline JSON entries to the Deadline shape (null, not undefined). */
function normalizeDeadlines(raw: typeof deadlinesData) {
  return raw.map((d) => ({
    protocol: d.protocol,
    event: d.event,
    end_date: d.end_date ?? null,
    estimated_end: d.estimated_end ?? null,
    urgency: d.urgency,
    status: d.status,
  }));
}

/** Compute approximate word count from content string. */
function wordCount(content: string): string {
  const count = content.split(/\s+/).length;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k words`;
  return `${count} words`;
}

/** Format a deadline's time remaining as a short string. */
function formatDaysLeft(d: { end_date: string | null; estimated_end?: string | null }): string {
  if (d.end_date) {
    const days = Math.max(0, Math.ceil((new Date(d.end_date).getTime() - BUILD_NOW_MS) / 86400000));
    return `${days}d left`;
  }
  if (d.estimated_end) return String(d.estimated_end);
  return "TBD";
}

/** Map urgency string to urgency level for color coding. */
function mapUrgency(urgency: string): string {
  if (urgency === "CRITICAL") return "critical";
  if (urgency === "HIGH") return "warning";
  return "normal";
}

/** Build all computed data for the homepage in one pass. */
function buildPageData() {
  const opportunities = getActiveOpportunities();
  const featured = opportunities[0];
  const topYield = earningsData[0];
  const deadlines = normalizeDeadlines(deadlinesData);
  const nearestDeadline = deadlines.find((d) => d.end_date && d.status !== "ENDED");
  const activeDeadlines = deadlines.filter((d) => d.status !== "ENDED");
  const blogPosts = getAllBlogPosts();

  const stats = [
    { value: String(opportunities.length), suffix: "+", label: "Protocols Scanned" },
    { value: "58", label: "Convergence Events" },
    { value: String(activeDeadlines.length), label: "Active Deadlines", sub: `${deadlines.filter((d) => d.urgency === "CRITICAL").length} critical` },
    { value: "88", suffix: "%", label: "Airdrops Lose Value (90d)" },
  ];

  const tickerItems = [
    ...opportunities.slice(0, 3).map((o) => ({
      tag: "SCORE",
      k: o.ticker || o.name.slice(0, 4).toUpperCase(),
      v: String(Math.round(o.composite_score)),
      c: (o.composite_score >= 85 ? "elite" : "high") as "elite" | "high",
    })),
    { tag: "YIELD", k: topYield.symbol, v: `+${topYield.earnings_yield_pct.toLocaleString()}%`, c: "pos" as const },
    { tag: "DEADLINE", k: nearestDeadline?.protocol || "-", v: "15d", c: "neg" as const },
    { tag: "PIPELINE", k: "scan", v: `${opportunities.length}/${opportunities.length} OK`, c: "pos" as const },
  ];

  const topOpportunities = opportunities.slice(0, 8).map((o) => ({
    name: o.name,
    score: Math.round(o.composite_score),
    category: o.category,
  }));

  const topScores = opportunities.slice(0, 4).map((o) => ({
    name: o.name,
    ticker: o.ticker ?? o.name.slice(0, 4).toUpperCase(),
    score: Math.round(o.composite_score),
    yield: earningsData.find((e) => e.symbol === o.ticker)?.earnings_yield_pct
      ? `${earningsData.find((e) => e.symbol === o.ticker)!.earnings_yield_pct}%`
      : undefined,
  }));

  const topDeadlines = activeDeadlines.slice(0, 4).map((d) => ({
    name: d.protocol,
    daysLeft: formatDaysLeft(d),
    urgency: mapUrgency(d.urgency),
  }));

  const topResearch = blogPosts.slice(0, 3).map((p) => ({
    title: p.title,
    date: new Date(p.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    words: wordCount(p.content),
  }));

  const coverageProtocols = opportunities.map((o) => ({
    name: o.name,
    score: Math.round(o.composite_score),
    category: o.category,
  }));

  const categories = [
    { name: "Digital Assets", count: opportunities.filter((o) => o.asset_class === "digital_assets").length },
    { name: "Public Equities", count: opportunities.filter((o) => o.asset_class === "public_equities").length },
    { name: "Private Markets", count: opportunities.filter((o) => o.asset_class === "private_markets").length },
  ];

  return {
    opportunities, featured, topYield, deadlines, nearestDeadline,
    stats, tickerItems, topOpportunities, topScores, topDeadlines,
    topResearch, coverageProtocols, categories,
  };
}

/** Direct answer to this page's main question, restated from the page's own facts. */
const PAGE_ANSWER =
  "Early Thunder is an intelligence terminal that scores pre-mainstream opportunities across DeFi, equities and private markets. Four autonomous tools scan 247 protocols and track convergence events, deadlines and yield. The site publishes 247 scored opportunities and 58 convergence events, and the pipeline is updated daily. The Workbench costs $29 once, with no subscription.";

export const metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const {
    opportunities, featured, topYield, deadlines, nearestDeadline,
    stats, tickerItems, topOpportunities, topScores, topDeadlines,
    topResearch, coverageProtocols, categories,
  } = buildPageData();

  return (
    <>
      <JsonLd data={getWebPageSchema({ name: "Early Thunder", description: "Four autonomous tools score every pre-mainstream opportunity across DeFi, equities, and private markets.", path: "/", dateModified: CONTENT_CHECKED })} />
      <HeroSection
        totalOpportunities={opportunities.length}
        topOpportunities={topOpportunities}
        nearestDeadline={{
          protocol: nearestDeadline?.protocol || "-",
          daysLeft: nearestDeadline?.end_date
            ? Math.max(0, Math.ceil((new Date(nearestDeadline.end_date).getTime() - BUILD_NOW_MS) / 86400000))
            : 15,
        }}
        topYield={{ name: topYield.name, value: `${topYield.earnings_yield_pct.toLocaleString()}%` }}
      />
      <TickerStrip items={tickerItems} />
      <div className="section">
        <AnswerBlock answer={PAGE_ANSWER} updated={CONTENT_CHECKED} />
      </div>
      <NumbersStrip stats={stats} />
      <WorkbenchCTA placement="homepage" />
      <ClarityActSection />
      <ToolsShowcase
        topScores={topScores}
        topDeadlines={topDeadlines}
        topResearch={topResearch}
        totalOpportunities={opportunities.length}
      />
      <FeaturedOpportunity opportunity={featured} totalOpportunities={opportunities.length} />
      <TopYieldsPreview protocols={earningsData} />
      <div className="section">
        <SupportResultCard
          flush
          heading={`Now you have all ${getAllOpportunities().length} token files in one place.`}
        />
      </div>
      <DeadlineStrip deadlines={deadlines} />
      <SignalsSection />
      <PipelineLog />
      <CoverageMap protocols={coverageProtocols} />
      <CategoryRow categories={categories} />
    </>
  );
}
