/**
 * Site-wide constants for Early Thunder.
 * Single source of truth for URLs, brand copy, and configuration.
 */

export const SITE_URL = 'https://earlythunder.com' as const;
export const SITE_NAME = 'Early Thunder' as const;
export const SITE_TAGLINE = 'Follow the money that cannot lie' as const;

export const SITE_DESCRIPTION =
  'Autonomous intelligence pipeline scanning 154+ protocols for convergence signals, earnings yield, and deadline catalysts. 58 convergence events detected across crypto and emerging markets.' as const;

/**
 * Date the facts on the key pages were last checked, written as an ISO date.
 * It renders the visible "Updated" line and the JSON-LD `dateModified`, so the
 * two can never disagree. Change it only in the same edit as the facts.
 */
export const CONTENT_CHECKED = '2026-10-28' as const;

export const OG_IMAGE_PATH = '/og-default.svg' as const;
export const OG_IMAGE_WIDTH = 1200 as const;
export const OG_IMAGE_HEIGHT = 630 as const;

export const TWITTER_HANDLE = '@earlythunder' as const;

export const STATIC_PAGES = [
  '/',
  '/opportunities',
  '/methodology',
  '/how-it-works',
  '/graveyard',
  '/pricing',
  '/performance',
  '/discoveries',
  '/scorecard',
  '/scorecard/signal',
  '/scorecard/compare',
  '/scorecard/screen',
  '/scorecard/mispriced',
  '/revenue-distribution',
  '/portfolio',
  '/blog',
  '/guides',
  '/api-pricing',
  '/scorecard-vs-opportunity-score',
  '/crypto-profit-calculator',
  '/altcoin-season-index',
  '/crypto-market-cap-calculator',
  '/crypto-staking-calculator',
  '/impermanent-loss-calculator',
  '/crypto-liquidation-price-calculator',
  '/crypto-compound-interest-calculator',
  '/crypto-dca-calculator',
  '/crypto-average-price-calculator',
  '/crypto-fee-calculator',
  '/crypto-apy-calculator',
  '/crypto-position-size-calculator',
  '/crypto-stop-loss-calculator',
  '/crypto-risk-reward-calculator',
  '/crypto-investment-calculator',
  '/crypto-buy-the-dip-calculator',
  '/crypto-tax-calculator',
  '/crypto-volatility-calculator',
  '/crypto-drawdown-calculator',
  '/cite-my-own-translation-mla',
  '/intelligence',
  '/deadlines',
  '/earnings',
  '/research',
  '/clarity-act',
  '/bitcoin-halving-schedule',
  '/bitcoin-transaction-fee-calculator',
  '/bitcoin-difficulty-adjustment-calculator',
  '/bitcoin-mining-profitability-calculator',
  '/terms',
  '/privacy',
  '/disclaimer',
] as const;

/** Research article slugs for sitemap and metadata generation. */
export const RESEARCH_SLUGS = [
  'kelp-exploit-analysis',
  'airdrop-performance-data',
  'tokenless-protocols-tvl-2026',
  'lqty-v2-value-break',
  'crypto-intelligence-brief-week-of-2026-05-09',
  'commonware-analysis-potential-1000x-2500x-roi-opportunity',
  'gains-network-analysis-smart-money-score-86-with-40-tvl-surge',
  'commonware-deep-alpha',
  'the-23-billion-divergence',
  'genius-act-countdown',
  'ai-crypto-convergence',
  'rwa-tokenization-tripled',
  'infrastructure-monopoly-map',
] as const;

/** Sitemap priority map by page path */
export const PRIORITY_MAP: Readonly<Record<string, number>> = {
  '/': 1.0,
  '/opportunities': 0.9,
  '/intelligence': 0.9,
  '/deadlines': 0.8,
  '/earnings': 0.8,
  '/methodology': 0.5,
  '/how-it-works': 0.6,
  '/graveyard': 0.5,
  '/pricing': 0.5,
  '/performance': 0.6,
  '/api-pricing': 0.6,
  '/scorecard-vs-opportunity-score': 0.6,
  '/discoveries': 0.7,
  '/scorecard': 0.9,
  '/scorecard/signal': 0.9,
  '/scorecard/compare': 0.9,
  '/scorecard/screen': 0.9,
  '/scorecard/mispriced': 0.9,
  '/revenue-distribution': 0.8,
  '/portfolio': 0.9,
  '/blog': 0.7,
  '/guides': 0.8,
  '/crypto-profit-calculator': 0.8,
  '/altcoin-season-index': 0.8,
  '/crypto-market-cap-calculator': 0.8,
  '/crypto-staking-calculator': 0.8,
  '/impermanent-loss-calculator': 0.8,
  '/crypto-liquidation-price-calculator': 0.8,
  '/crypto-compound-interest-calculator': 0.8,
  '/crypto-dca-calculator': 0.8,
  '/crypto-average-price-calculator': 0.8,
  '/crypto-fee-calculator': 0.8,
  '/crypto-apy-calculator': 0.8,
  '/crypto-position-size-calculator': 0.8,
  '/crypto-stop-loss-calculator': 0.8,
  '/crypto-risk-reward-calculator': 0.8,
  '/crypto-investment-calculator': 0.8,
  '/crypto-buy-the-dip-calculator': 0.8,
  '/crypto-tax-calculator': 0.8,
  '/crypto-volatility-calculator': 0.8,
  '/crypto-drawdown-calculator': 0.8,
  '/research': 0.8,
  '/clarity-act': 0.9,
  '/bitcoin-halving-schedule': 0.8,
  '/bitcoin-transaction-fee-calculator': 0.8,
  '/bitcoin-difficulty-adjustment-calculator': 0.8,
  '/bitcoin-mining-profitability-calculator': 0.8,
  '/terms': 0.3,
  '/privacy': 0.3,
  '/disclaimer': 0.3,
} as const;

export const RESEARCH_ARTICLE_PRIORITY = 0.7 as const;

export const OPPORTUNITY_PRIORITY = 0.8 as const;
export const BLOG_POST_PRIORITY = 0.7 as const;
export const GUIDE_PRIORITY = 0.8 as const;
export const CLARITY_TOPIC_PRIORITY = 0.8 as const;

/** Per-token scorecard leaves. Below opportunity notes, which go deeper. */
export const SCORECARD_TOKEN_PRIORITY = 0.7 as const;
/** Verdict and chain hubs, which are the crawl path into the leaves. */
export const SCORECARD_HUB_PRIORITY = 0.8 as const;
/** Per-variable leaderboards. One page per scored variable, whole universe ranked. */
export const SCORECARD_SIGNAL_PRIORITY = 0.8 as const;
/** Curated head-to-head comparisons. Below the token leaves they draw from. */
export const SCORECARD_COMPARE_PRIORITY = 0.6 as const;
/** Screens are shortlists with commercial intent, so they sit with the hubs. */
export const SCORECARD_SCREEN_PRIORITY = 0.8 as const;

export const AUTHOR_NAME = 'Early Thunder Research' as const;
