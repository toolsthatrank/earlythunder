import pairsData from "../../data/scorecard-pairs.json";
import {
  getScorecardToken,
  type ScorecardToken,
} from "./scorecard-analytics";
import { ordinal, formatUsd, formatMultiple } from "./scorecard-insight";

/**
 * Typed access to data/scorecard-pairs.json plus the head-to-head arithmetic
 * that /scorecard/compare/[pair] renders.
 *
 * The pair list is curated by scripts/build-longtail-layer.mjs: nearest
 * fundamental profiles, the market-cap head within a bounded span of places,
 * and the strongest members of each chain. Nothing is paired at random, and no
 * comparison states anything the two token records do not already contain.
 */

const MAX_PAIRS = 1200;

/** A variable gap this size or larger is the difference between the two. */
const DECISIVE_GAP = 3;
/** Both at or above this is agreement on a strength. */
const SHARED_STRENGTH = 7;
/** Both at or below this is agreement on a weakness. */
const SHARED_WEAKNESS = 3;
const MAX_DIVERGENCES = 5;
/** Overhang shares closer than this are the same supply position. */
const MATERIAL_OVERHANG_GAP = 15;
/** Drawdowns closer than this are the same position in the cycle. */
const MATERIAL_DRAWDOWN_GAP = 20;
/** Composite gaps at or below this are noise against a 250-point scale. */
const NARROW_GAP = 10;
/** Above this the framework is stating a clear preference. */
const MODERATE_GAP = 25;
/** Winning at least this share of the variables is a broad, consistent lead. */
const SWEEP_SHARE = 0.6;
/** Shared weaknesses listed before the rest are summarised as a count. */
const MAX_LISTED_WEAKNESSES = 6;

export interface PairRef {
  readonly slug: string;
  readonly a: string;
  readonly b: string;
  /** Why the pair is on the list: "profile", "market-cap" or "chain". */
  readonly reason: string;
}

interface PairsFile {
  readonly generated_at: string;
  readonly source_updated_at: string | null;
  readonly universe_size: number;
  readonly max_score: number;
  readonly market_fetched_at: string | null;
  readonly pairs: readonly PairRef[];
}

const FILE = pairsData as unknown as PairsFile;

/** Every curated pair, bounded. */
export function getAllPairs(): readonly PairRef[] {
  if (!FILE || !Array.isArray(FILE.pairs)) return [];
  return FILE.pairs.length > MAX_PAIRS ? FILE.pairs.slice(0, MAX_PAIRS) : FILE.pairs;
}

/** One pair reference by slug. Null when the slug is not on the curated list. */
export function getPairRef(slug: string): PairRef | null {
  if (typeof slug !== "string" || slug.length === 0) return null;
  const all = getAllPairs();
  if (all.length === 0) return null;
  const wanted = slug.toLowerCase();
  for (let i = 0; i < all.length && i < MAX_PAIRS; i += 1) {
    if (all[i].slug === wanted) return all[i];
  }
  return null;
}

/** Every curated pair that includes one token, for cross-linking. */
export function getPairsFor(tokenSlug: string, limit: number): readonly PairRef[] {
  if (typeof tokenSlug !== "string" || tokenSlug.length === 0) return [];
  if (!Number.isInteger(limit) || limit < 1) return [];
  const all = getAllPairs();
  const out: PairRef[] = [];
  for (let i = 0; i < all.length && i < MAX_PAIRS && out.length < limit; i += 1) {
    if (all[i].a === tokenSlug || all[i].b === tokenSlug) out.push(all[i]);
  }
  return out;
}

export interface VariableDuel {
  readonly key: string;
  readonly label: string;
  readonly group: string;
  readonly a: number;
  readonly b: number;
  readonly aRank: number;
  readonly bRank: number;
  /** Positive when A leads, negative when B leads, zero on a tie. */
  readonly diff: number;
}

export interface HeadToHead {
  readonly a: ScorecardToken;
  readonly b: ScorecardToken;
  readonly duels: readonly VariableDuel[];
  readonly aWins: number;
  readonly bWins: number;
  readonly ties: number;
  /** Largest gaps either way, biggest first. */
  readonly divergences: readonly VariableDuel[];
  readonly sharedStrengths: readonly VariableDuel[];
  readonly sharedWeaknesses: readonly VariableDuel[];
}

/**
 * Resolves both tokens and computes every per-variable duel between them.
 * Returns null when either side is missing from the scored universe.
 */
export function buildHeadToHead(aSlug: string, bSlug: string): HeadToHead | null {
  if (typeof aSlug !== "string" || typeof bSlug !== "string") return null;
  if (aSlug === bSlug) return null;

  const a = getScorecardToken(aSlug);
  const b = getScorecardToken(bSlug);
  if (a === null || b === null) return null;
  if (!Array.isArray(a.variables) || a.variables.length === 0) return null;

  const duels: VariableDuel[] = [];
  for (let i = 0; i < a.variables.length && i < 60; i += 1) {
    const av = a.variables[i];
    const bv = b.variables.find((v) => v.key === av.key);
    if (bv === undefined) continue;
    duels.push({
      key: av.key,
      label: av.label,
      group: av.group,
      a: av.value,
      b: bv.value,
      aRank: av.rank,
      bRank: bv.rank,
      diff: av.value - bv.value,
    });
  }
  if (duels.length === 0) return null;

  const byGap = [...duels].sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));

  return {
    a,
    b,
    duels,
    aWins: duels.filter((d) => d.diff > 0).length,
    bWins: duels.filter((d) => d.diff < 0).length,
    ties: duels.filter((d) => d.diff === 0).length,
    divergences: byGap.filter((d) => Math.abs(d.diff) >= DECISIVE_GAP).slice(0, MAX_DIVERGENCES),
    sharedStrengths: duels.filter((d) => d.a >= SHARED_STRENGTH && d.b >= SHARED_STRENGTH),
    sharedWeaknesses: duels.filter((d) => d.a <= SHARED_WEAKNESS && d.b <= SHARED_WEAKNESS),
  };
}

export interface PairFinding {
  readonly label: string;
  readonly text: string;
}

/** "AAA leads on X, Y and Z" from a list of duels, from one side's view. */
function leadList(duels: readonly VariableDuel[], forA: boolean, cap: number): string {
  const side = duels.filter((d) => (forA ? d.diff > 0 : d.diff < 0)).slice(0, cap);
  if (side.length === 0) return "";
  const labels = side.map((d) => `${d.label} (${forA ? d.a : d.b} against ${forA ? d.b : d.a})`);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/** Composite scores, ranks and the running count of variables each side wins. */
function standingFinding(h2h: HeadToHead): PairFinding {
  const { a, b, duels } = h2h;
  const gap = a.score - b.score;
  const leader = gap >= 0 ? a : b;
  const size = Math.abs(gap);
  const margin =
    size <= NARROW_GAP
      ? "inside the range where the individual variables matter more than the total"
      : size <= MODERATE_GAP
        ? "a real gap, though small enough that one variable moving would close much of it"
        : "a wide enough margin that the framework is not ambivalent";
  const ties =
    h2h.ties === 0 ? "none are level" : h2h.ties === 1 ? "one is level" : `${h2h.ties} are level`;
  return {
    label: "Standing",
    text:
      `${a.symbol} scores ${a.score} of ${a.max_score} and ranks ${ordinal(a.rank_overall)} of ${a.universe_size}. ` +
      `${b.symbol} scores ${b.score} and ranks ${ordinal(b.rank_overall)}. ` +
      (gap === 0
        ? "They tie on the composite, so the whole difference is in which variables each one wins."
        : `${leader.symbol} leads by ${Math.abs(gap)} points, which is ${margin}.`) +
      ` ${a.symbol} takes ${h2h.aWins} of the ${duels.length} variables, ${b.symbol} takes ${h2h.bWins}, and ${ties}.`,
  };
}

/** Only rendered when the framework put the two in different bands. */
function verdictFinding(h2h: HeadToHead): PairFinding | null {
  const { a, b } = h2h;
  if (a.verdict === b.verdict) return null;
  return {
    label: "Verdicts differ",
    text:
      `The framework rates ${a.symbol} ${a.verdict} and ${b.symbol} ${b.verdict}. ` +
      `Two tokens close enough to compare do not have to land in the same band, and where they do not, ` +
      `the divergence table below is where the split comes from.`,
  };
}

/** The variables that actually separate them, or a statement that none do. */
function splitFinding(h2h: HeadToHead): PairFinding {
  const { a, b } = h2h;
  if (h2h.divergences.length === 0) {
    const total = h2h.duels.length;
    const sweeper = h2h.aWins >= total * SWEEP_SHARE ? a : h2h.bWins >= total * SWEEP_SHARE ? b : null;
    return {
      label: "Where they split",
      text:
        `No single variable separates ${a.symbol} and ${b.symbol} by as much as ${DECISIVE_GAP} points. ` +
        (sweeper === null
          ? `They are close on the framework's terms, which makes price, liquidity and the supply ` +
            `position below the only grounds for choosing.`
          : `The lead is broad rather than concentrated: ${sweeper.symbol} is ahead on ` +
            `${sweeper === a ? h2h.aWins : h2h.bWins} of ${total} variables by one or two points each, ` +
            `which is what produces the composite gap without any one variable carrying it.`),
    };
  }
  const aSide = leadList(h2h.divergences, true, 3);
  const bSide = leadList(h2h.divergences, false, 3);
  const opener =
    h2h.divergences.length === 1
      ? "One variable separates them by"
      : `${h2h.divergences.length} variables separate them by`;
  return {
    label: "Where they split",
    text:
      `${opener} ${DECISIVE_GAP} points or more. ` +
      (aSide ? `${a.symbol} is clear on ${aSide}. ` : "") +
      (bSide ? `${b.symbol} is clear on ${bSide}.` : ""),
  };
}

/** Weakness labels, truncated to a readable list with a remainder count. */
function listWeaknesses(weaknesses: readonly VariableDuel[]): string {
  if (!Array.isArray(weaknesses) || weaknesses.length === 0) return "";
  const labels = weaknesses.map((d) => d.label);
  if (labels.length <= MAX_LISTED_WEAKNESSES) return labels.join(", ");
  const shown = labels.slice(0, MAX_LISTED_WEAKNESSES).join(", ");
  return `${shown} and ${labels.length - MAX_LISTED_WEAKNESSES} more`;
}

/** Only rendered when both sides fail the same variables. */
function sharedWeaknessFinding(h2h: HeadToHead): PairFinding | null {
  if (h2h.sharedWeaknesses.length === 0) return null;
  return {
    label: "Agreed weakness",
    text:
      `Both score ${SHARED_WEAKNESS} or below on ${listWeaknesses(h2h.sharedWeaknesses)}. ` +
      `A weakness both sides share is not a reason to prefer either. It is a reason to check whether the ` +
      `category itself carries the problem.`,
  };
}

/** Only rendered when the vesting positions are materially different. */
function supplyFinding(h2h: HeadToHead): PairFinding | null {
  const { a, b } = h2h;
  const aDil = a.dilution.overhang_pct;
  const bDil = b.dilution.overhang_pct;
  if (aDil === null || bDil === null) return null;
  if (Math.abs(aDil - bDil) < MATERIAL_OVERHANG_GAP) return null;
  const heavier = aDil > bDil ? a : b;
  const lighter = aDil > bDil ? b : a;
  return {
    label: "Supply position",
    text:
      `${heavier.symbol} still has ${Math.max(aDil, bDil)}% of its eventual supply to enter circulation against ` +
      `${Math.min(aDil, bDil)}% for ${lighter.symbol}. On the same market capitalisation, a buyer of ` +
      `${heavier.symbol} is taking the ${formatMultiple(heavier.dilution.dilution_x)} dilution path and a buyer ` +
      `of ${lighter.symbol} the ${formatMultiple(lighter.dilution.dilution_x)} one.`,
  };
}

/** Relative size, and whether the market and the framework agree on order. */
function sizeFinding(h2h: HeadToHead): PairFinding | null {
  const { a, b } = h2h;
  const aCap = a.market.market_cap;
  const bCap = b.market.market_cap;
  if (aCap === null || bCap === null || aCap <= 0 || bCap <= 0) return null;
  const bigger = aCap > bCap ? a : b;
  const smaller = aCap > bCap ? b : a;
  const ratio = aCap > bCap ? aCap / bCap : bCap / aCap;
  const closing =
    bigger.score < smaller.score
      ? "The smaller of the two scores higher on fundamentals, which is the disagreement worth understanding before either position is taken."
      : "The larger of the two also scores higher, so the market and the framework agree on the ordering here.";
  return {
    label: "Size",
    text:
      `${bigger.symbol} is valued at ${formatUsd(bigger.market.market_cap)} against ` +
      `${formatUsd(smaller.market.market_cap)} for ${smaller.symbol}, a ${ratio.toFixed(1)}x difference. ${closing}`,
  };
}

/** Only rendered when the two sit at genuinely different distances from the high. */
function drawdownFinding(h2h: HeadToHead): PairFinding | null {
  const { a, b } = h2h;
  const aDraw = a.drawdown.distance_pct;
  const bDraw = b.drawdown.distance_pct;
  if (aDraw === null || bDraw === null) return null;
  if (Math.abs(aDraw - bDraw) < MATERIAL_DRAWDOWN_GAP) return null;
  const deeper = aDraw < bDraw ? a : b;
  const shallower = aDraw < bDraw ? b : a;
  return {
    label: "Distance from the high",
    text:
      `${deeper.symbol} trades ${Math.abs(Math.min(aDraw, bDraw))}% below its all-time high and ` +
      `${shallower.symbol} ${Math.abs(Math.max(aDraw, bDraw))}% below its own. ` +
      `Recovering the high needs ${formatMultiple(deeper.drawdown.recovery_x)} from ${deeper.symbol} and ` +
      `${formatMultiple(shallower.drawdown.recovery_x)} from ${shallower.symbol}, which is the same statement ` +
      `read as the return each one has to produce.`,
  };
}

/**
 * The findings shown on a comparison page. Every paragraph is conditional on
 * the data, so two comparisons produce structurally different pages: a pair
 * that agrees everywhere renders no divergence block, a pair with no shared
 * weakness renders no agreement block.
 */
export function buildPairFindings(h2h: HeadToHead): readonly PairFinding[] {
  if (!h2h || !h2h.a || !h2h.b) return [];
  if (!Array.isArray(h2h.duels) || h2h.duels.length === 0) return [];
  return [
    standingFinding(h2h),
    verdictFinding(h2h),
    splitFinding(h2h),
    sharedWeaknessFinding(h2h),
    supplyFinding(h2h),
    sizeFinding(h2h),
    drawdownFinding(h2h),
  ].filter((finding): finding is PairFinding => finding !== null);
}

export interface PairFaq {
  readonly question: string;
  readonly answer: string;
}

/** FAQ entries for the comparison page and its FAQPage schema. */
export function buildPairFaqs(h2h: HeadToHead): readonly PairFaq[] {
  if (!h2h || !h2h.a || !h2h.b) return [];
  const { a, b } = h2h;
  const out: PairFaq[] = [];
  const leader = a.score >= b.score ? a : b;
  const trailer = a.score >= b.score ? b : a;

  out.push({
    question: `Is ${a.symbol} or ${b.symbol} the better investment?`,
    answer:
      `On this framework ${leader.symbol} scores higher, ${leader.score} against ${trailer.score} of ` +
      `${a.max_score}, and it is rated ${leader.verdict} against ${trailer.verdict}. That is a ranking of ` +
      `fundamentals as recorded at the last scoring pass, not a price forecast, and ${a.symbol} still wins ` +
      `${h2h.aWins} of the ${h2h.duels.length} individual variables against ${b.symbol}.`,
  });

  out.push({
    question: `What is the biggest difference between ${a.symbol} and ${b.symbol}?`,
    answer:
      h2h.divergences.length > 0
        ? `${h2h.divergences[0].label}. ${a.symbol} scores ${h2h.divergences[0].a} of 10 there and ${b.symbol} ` +
          `scores ${h2h.divergences[0].b}, a gap of ${Math.abs(h2h.divergences[0].diff)} points on a single variable.`
        : `Nothing separates them by more than ${DECISIVE_GAP - 1} points on any of the ${h2h.duels.length} ` +
          `variables, which is unusual and means the two are close substitutes on fundamentals.`,
  });

  if (a.market.market_cap !== null && b.market.market_cap !== null) {
    out.push({
      question: `Which is bigger, ${a.symbol} or ${b.symbol}?`,
      answer:
        `${a.symbol} is valued at ${formatUsd(a.market.market_cap)} and ${b.symbol} at ` +
        `${formatUsd(b.market.market_cap)} on the latest market snapshot.`,
    });
  }

  return out;
}
