import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { PageHeader, SectionLabel } from "@/components/PageChrome";
import MiningProfitabilityCalculator from "@/components/MiningProfitabilityCalculator";

const URL = "https://earlythunder.com/bitcoin-mining-profitability-calculator";
const title = "Bitcoin mining profitability calculator";
const description =
  "Estimate Bitcoin mining profit per day from hashrate, watts, electricity price and pool fee, with every network constant dated, sourced and editable.";

export const metadata: Metadata = {
  title: { absolute: "Bitcoin mining profitability calculator and hashprice" },
  description,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { type: "article", title, description, url: URL },
  twitter: { card: "summary_large_image", title, description },
};

const AUTHOR = { "@type": "Person", name: "Michael Lip", url: "https://earlythunder.com/about", sameAs: ["https://github.com/theluckystrike"] };
const PUBLISHER = { "@type": "Organization", name: "AUTOM8 LLC", url: "https://earlythunder.com" };

const DATE_PUBLISHED = "2026-11-08";
const DATE_MODIFIED = "2026-11-08";
/** All live values fetched 2026-11-08 between 03:41:57Z and 03:42:28Z (UTC). Raw responses are saved with the fetch time. */
const DATA_FETCHED_AT = "2026-11-08T03:42Z";
/** mempool.space /api/v1/mining/hashrate/3d currentDifficulty. */
const DIFFICULTY_FETCHED = "148364561003867.4";
/** Coinbase /v2/prices/BTC-USD/spot amount. */
const PRICE_FETCHED = "75752.435";
const PRICE_FETCHED_AT = DATA_FETCHED_AT;
/** mempool.space /api/v1/mining/reward-stats/144: totalReward 45277852291 sat, totalFee 277852291 sat, blocks 974874 to 975017. */
const REWARD_TOTAL_BTC = "452.77852291";
const REWARD_FEES_BTC = "2.77852291";
const REWARD_PER_BLOCK = "3.1442953";
/** mempool.space /api/blocks/tip/height. */
const TIP_HEIGHT = 975017;
/** mempool.space /api/v1/difficulty-adjustment difficultyChange (an estimate). */
const DIFFICULTY_CHANGE_ESTIMATE = "-4.21";

const schemas = [
  {
    "@context": "https://schema.org", "@type": "WebApplication", name: title,
    url: URL, description, applicationCategory: "FinanceApplication",
    operatingSystem: "Web", isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, author: AUTHOR, publisher: PUBLISHER,
  },
  {
    "@context": "https://schema.org", "@type": "Article", headline: title,
    description, url: URL, mainEntityOfPage: URL,
    datePublished: DATE_PUBLISHED, dateModified: DATE_MODIFIED, author: AUTHOR, publisher: PUBLISHER,
  },
  {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://earlythunder.com/" },
      { "@type": "ListItem", position: 2, name: title, item: URL },
    ],
  },
];

const RELATED = [
  { href: "/bitcoin-difficulty-adjustment-calculator", label: "Difficulty adjustment calculator" },
  { href: "/bitcoin-halving-schedule", label: "Bitcoin halving schedule" },
  { href: "/crypto-profit-calculator", label: "Profit calculator" },
  { href: "/crypto-dca-calculator", label: "DCA calculator" },
];

function impliedNetworkThs(difficulty: string): string {
  const hs = (Number.parseFloat(difficulty) * 4294967296) / 600;
  return (hs / 1e12).toFixed(0);
}

export default function Page() {
  const networkThs = impliedNetworkThs(DIFFICULTY_FETCHED);
  const hashpriceBtc = ((Number.parseFloat(REWARD_PER_BLOCK) * 144) / (Number.parseFloat(networkThs) / 1000)).toFixed(8);
  const hashpriceUsd = (Number.parseFloat(hashpriceBtc) * Number.parseFloat(PRICE_FETCHED)).toFixed(2);
  const feeSharePct = ((Number.parseFloat(REWARD_FEES_BTC) / Number.parseFloat(REWARD_TOTAL_BTC)) * 100).toFixed(2);
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <PageHeader
        title={title}
        lead="Enter your machine and electricity terms. The arithmetic runs in your browser, and every network constant it uses is dated, sourced and editable."
        eyebrow="Calculator"
        meta={`By Michael Lip · Difficulty, block reward and chain tip fetched from mempool.space at ${DATA_FETCHED_AT} UTC · Price ${PRICE_FETCHED} USD from Coinbase spot at ${PRICE_FETCHED_AT} UTC`}
      />

      <section className="mt-12">
        <MiningProfitabilityCalculator
          defaults={{
            networkThsDefault: networkThs,
            difficultyDefault: DIFFICULTY_FETCHED,
            priceUsdDefault: PRICE_FETCHED,
            rewardBtcDefault: REWARD_PER_BLOCK,
            fetchedAt: DATA_FETCHED_AT,
            tipHeight: TIP_HEIGHT,
            difficultyChangeDefault: DIFFICULTY_CHANGE_ESTIMATE,
            presets: [
              { name: "Antminer S19 Pro (110 TH/s, 3250 W)", hashrateThs: 110, watts: 3250 },
              { name: "Antminer S21 (200 TH/s, 3550 W)", hashrateThs: 200, watts: 3550 },
              { name: "Antminer S21 Pro (234 TH/s, 3510 W)", hashrateThs: 234, watts: 3510 },
            ],
          }}
        />
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="01" title="How this page calculates" />
        <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-text-secondary">
          <p>Your share of the network is your hashrate divided by the network hashrate. The network pays out the block reward once every ten minutes on average, which is 144 blocks per day, so your BTC per day is share × reward × 144. That times the price is gross revenue. Electricity is watts ÷ 1000 × 24 × your $/kWh. The pool fee takes its percentage of gross. What is left is net.</p>
          <p>The network hashrate default is derived, not measured directly: difficulty × 2<sup>32</sup> ÷ 600 seconds, because difficulty × 2<sup>32</sup> is close to the expected number of hashes per block (the exact value, 2<sup>256</sup> ÷ (target + 1), is about 0.0015% higher). With the fetched difficulty of {DIFFICULTY_FETCHED} that gives about {Number(networkThs).toLocaleString("en-US")} TH/s ({(Number(networkThs) / 1e6).toFixed(2)} EH/s). This is the primary derivation. The mempool.space 3-day currentHashrate estimate was about 4.6% lower at the same fetch time, because it averages recent block times. Other estimators differ too, so this page uses only the difficulty-implied value.</p>
          <p>The reward default is {REWARD_PER_BLOCK} BTC per block. It is the subsidy of 3.125 BTC (since the halving at block 840,000 on 20 April 2024) plus observed fees. Over the 144 blocks before {DATA_FETCHED_AT} UTC, miners earned {REWARD_TOTAL_BTC} BTC in total. Fees were {REWARD_FEES_BTC} BTC of that, which is {feeSharePct}% of the total. Fees change from block to block. Set the field to 3.125 to see the subsidy alone.</p>
          <p>Hashprice is the expected revenue of 1 PH/s for one day, which is reward × 144 ÷ network hashrate in PH/s. With the defaults it is {hashpriceBtc} BTC, or about {hashpriceUsd} USD at the fetched price. The subsidy at a height follows Bitcoin Core GetBlockSubsidy (50 BTC shifted right once per 210,000 blocks). The next halving is at block 1,050,000, and the subsidy then is 1.5625 BTC. The two projection rows keep the price and the fees per block constant. They are projections, not forecasts.</p>
        </div>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="02" title="What this page cannot tell you" />
        <ul className="mt-4 max-w-3xl list-disc space-y-1 pl-6 text-base leading-relaxed text-text-secondary">
          <li>The difficulty will change. It retargets every 2016 blocks, roughly every two weeks, and has been climbing over the long run. A machine that is profitable today may not be after the next adjustments.</li>
          <li>The price was fetched once, and it changes all the time. The row &apos;Net change for +1% price&apos; shows how much one percent of price changes the net result.</li>
          <li>Hardware fails, ships late, and resells for something other than zero. The breakeven figure assumes the machine runs flat out until it pays for itself.</li>
          <li>The pool fee here is a flat percentage of gross revenue. Your pool can use a different payout method and a different fee.</li>
        </ul>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="03" title="Research disclosure" />
        <div className="mt-4 max-w-3xl space-y-3 text-base leading-relaxed text-text-secondary">
          <p>Written by <Link className="text-amber hover:text-accent-hover" href="/about">Michael Lip</Link>.</p>
          <p>
            The difficulty (currentDifficulty) and the 3-day hashrate cross-check are from the mempool.space{" "}
            <a className="text-amber hover:text-accent-hover" href="https://mempool.space/api/v1/mining/hashrate/3d">hashrate API</a>. The difficulty change estimate is from the{" "}
            <a className="text-amber hover:text-accent-hover" href="https://mempool.space/api/v1/difficulty-adjustment">difficulty adjustment API</a>. Both were fetched at {DATA_FETCHED_AT} UTC. The subsidy rule is GetBlockSubsidy in{" "}
            <a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/src/validation.cpp">Bitcoin Core v32.1 validation.cpp</a>. Machine specs are from the asicminervalue.com model pages for the{" "}
            <a className="text-amber hover:text-accent-hover" href="https://www.asicminervalue.com/miners/bitmain/antminer-s19-pro-110th">S19 Pro</a>,{" "}
            <a className="text-amber hover:text-accent-hover" href="https://www.asicminervalue.com/miners/bitmain/antminer-s21-200th">S21</a> and{" "}
            <a className="text-amber hover:text-accent-hover" href="https://www.asicminervalue.com/miners/bitmain/antminer-s21-pro-234th">S21 Pro</a>. The per-block reward comes from the{" "}
            <a className="text-amber hover:text-accent-hover" href="https://mempool.space/api/v1/mining/reward-stats/144">reward-stats endpoint</a> over the last 144 blocks. The price is the{" "}
            <a className="text-amber hover:text-accent-hover" href="https://api.coinbase.com/v2/prices/BTC-USD/spot">Coinbase spot rate</a> at {PRICE_FETCHED_AT} UTC. The retarget cadence and block spacing follow the Bitcoin Core consensus rules documented on our{" "}
            <Link className="text-amber hover:text-accent-hover" href="/bitcoin-difficulty-adjustment-calculator">difficulty adjustment page</Link>.
          </p>
          <p>Every default on this page is a dated figure, not a live feed. The calculator is a snapshot model of mining economics at the stamped constants; replace them with current readings for live estimates.</p>
        </div>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="04" title="Related" />
        <ul className="mt-6 flex flex-wrap gap-3">
          {RELATED.map((r) => (
            <li key={r.href}><Link className="inline-flex rounded-full border border-border-subtle bg-bg-secondary px-4 py-2 font-mono text-sm text-text-secondary hover:text-text-primary" href={r.href}>{r.label}</Link></li>
          ))}
        </ul>
      </section>

      {schemas.map((s, i) => (
        <JsonLd key={i} data={s} />
      ))}
    </div>
  );
}
