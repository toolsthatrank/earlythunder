import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import DifficultyRetargetCalculator from "@/components/DifficultyRetargetCalculator";

const URL = "https://earlythunder.com/bitcoin-difficulty-adjustment-calculator";
const title = "Bitcoin Difficulty Adjustment Calculator (nBits, hashrate)";
const description = "Project the next Bitcoin difficulty retarget from your own inputs with the Bitcoin Core v32.1 rules: the 4x clamp, the powLimit cap and exact nBits math.";

export const metadata: Metadata = { title: { absolute: title }, description, alternates: { canonical: URL }, robots: { index: true, follow: true }, openGraph: { type: "article", title, description, url: URL }, twitter: { card: "summary_large_image", title, description } };

const AUTHOR = { "@type": "Person", name: "Michael Lip", url: "https://earlythunder.com/about", sameAs: ["https://github.com/theluckystrike"] };
const PUBLISHER = { "@type": "Organization", name: "AUTOM8 LLC", url: "https://earlythunder.com" };

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
    datePublished: "2026-10-30", dateModified: "2026-10-30", author: AUTHOR, publisher: PUBLISHER,
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
  { href: "/bitcoin-halving-schedule", label: "Bitcoin halving schedule" },
  { href: "/bitcoin-transaction-fee-calculator", label: "Bitcoin transaction fee calculator" },
  { href: "/crypto-profit-calculator", label: "Profit calculator" },
  { href: "/crypto-dca-calculator", label: "DCA calculator" },
];

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {schemas.map((schema, index) => <JsonLd key={index} data={schema} />)}
      <p className="font-mono text-sm uppercase tracking-widest text-amber">Bitcoin network rules</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-text-primary md:text-5xl">Bitcoin Difficulty Adjustment Calculator</h1>
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-text-secondary">Enter how long the last difficulty period took and the current nBits. This page applies the Bitcoin Core retarget formula exactly: the target scales by measured time over expected time. Bitcoin Core clamps the measured timespan before it scales the target. The result is capped at the proof-of-work limit. Everything is computed in your browser from your inputs; the page does not fetch difficulty, hashrate or price data live.</p>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-text-secondary">
        The rules are for mainnet only. The testnet rules (fPowAllowMinDifficultyBlocks, BIP94) do not apply.
      </p>
      <DifficultyRetargetCalculator />

      <section className="mt-20 border-t border-border-subtle pt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary md:text-[2rem]">How this page calculates</h2>
        <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-text-secondary">
          <p>Every 2,016 blocks Bitcoin Core retargets. The measured timespan is actual = time(block N+2015) − time(block N), with N = pindexLast-&gt;nHeight − 2015: 2016 blocks, 2015 intervals; clamped to [302,400 s, 4,838,400 s]. The new target is the old target times that clamped ratio, capped at the powLimit target 0x00000000ffff...ffffffff, and re-encoded through GetCompact. That is the whole retarget rule. A separate quantity is used for the hashrate: expected hashes per block (GetBitsProof) = 2²⁵⁶ / (target + 1), integer division. At nBits 0x1d00ffff that is 4,295,032,833, not exactly 2³². This page keeps the 256-bit target in big-integer form so the scaling is exact, and shows the floating-point difficulty readout separately because that is what the getdifficulty RPC prints. To turn an implied hashrate into revenue per machine, use the <Link className="text-amber hover:text-accent-hover" href="/bitcoin-mining-profitability-calculator">Bitcoin mining profitability calculator</Link>.</p>
          <p>
            At a retarget boundary the new target must lie between old target / 4 and old target × 4, each capped at powLimit and rounded through GetCompact. Bitcoin Core uses this check in headers presync (src/headerssync.cpp). Consensus itself requires nBits to equal GetNextWorkRequired exactly (bad-diffbits in src/validation.cpp).
          </p>
          <ul className="list-disc space-y-2 pl-6 font-mono text-sm">
            <li>target = (nBits &amp; 0x007fffff) × 256^(size − 3), rounded down when size &lt; 3, size = nBits &gt;&gt; 24. Not valid: sign bit 0x00800000, zero, overflow, or above powLimit (arith_uint256.cpp SetCompact, pow.cpp DeriveTarget).</li>
            <li>nBits = size × 2^24 + the top 3 bytes of the target, size = the byte length of the target. If those 3 bytes have bit 0x00800000 set, they move 1 byte right and size grows by 1 (arith_uint256.cpp GetCompact).</li>
            <li>difficulty = 0xffff / (nBits &amp; 0x00ffffff) × 256^(29 − size) (rpc/blockchain.cpp GetDifficulty).</li>
            <li>new target = floor(old target × clamp(actual, 302,400, 4,838,400) / 1,209,600), capped at powLimit (pow.cpp CalculateNextWorkRequired, kernel/chainparams.cpp).</li>
            <li>projected actual = elapsed seconds × 2015 / (blocks mined − 1), rounded to whole seconds. This is a projection from your inputs, not a Bitcoin Core rule.</li>
            <li>expected hashes per block = floor(2²⁵⁶ / (target + 1)) (chain.cpp GetBitsProof).</li>
            <li>implied hashrate = floor(expected hashes per block / your block interval in seconds).</li>
          </ul>
          <p>Sources, all from the Bitcoin Core v32.1 tag, fetched on 2026-10-30 (UTC):</p>
          <ul className="list-disc space-y-1 pl-6 text-sm">
            <li><a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/src/pow.cpp">src/pow.cpp</a>: GetNextWorkRequired, CalculateNextWorkRequired, PermittedDifficultyTransition, DeriveTarget.</li>
            <li><a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/src/kernel/chainparams.cpp">src/kernel/chainparams.cpp</a>: mainnet powLimit, nPowTargetTimespan = 14 × 24 × 60 × 60, nPowTargetSpacing = 10 × 60.</li>
            <li><a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/src/consensus/params.h">src/consensus/params.h</a>: DifficultyAdjustmentInterval() = nPowTargetTimespan / nPowTargetSpacing.</li>
            <li><a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/src/arith_uint256.cpp">src/arith_uint256.cpp</a>: SetCompact and GetCompact.</li>
            <li><a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/src/chain.cpp">src/chain.cpp</a>: GetBitsProof.</li>
            <li><a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/src/rpc/blockchain.cpp">src/rpc/blockchain.cpp</a>: GetDifficulty and the getdifficulty RPC.</li>
            <li><a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/src/test/pow_tests.cpp">src/test/pow_tests.cpp</a>: the four retarget test vectors.</li>
            <li><a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/src/headerssync.cpp">src/headerssync.cpp</a> and <a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/src/validation.cpp">src/validation.cpp</a>: where the checks are used.</li>
            <li><a className="text-amber hover:text-accent-hover" href="https://bitcoincore.org/en/download/">Bitcoin Core download page</a>: shows Latest version: 32.1.</li>
          </ul>
          <p>The download page is not part of the v32.1 tag. It is listed to show that 32.1 is the latest release.</p>
        </div>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary md:text-[2rem]">Worked example from the Core test suite</h2>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-text-secondary">The period from block 30240 (2009-12-18 UTC) to block 32255 (2009-12-30 UTC) ran at the minimum difficulty, nBits 0x1d00ffff, and took 1,022,578 seconds, 15.46% less than two weeks. The retarget multiplied the target by 1,022,578 / 1,209,600 (about 0.8454) and re-encoded it as 0x1d00d86a, difficulty about 1.18. Enter those numbers above and the table reproduces the test vector.</p>
        <ul className="mt-4 max-w-3xl list-disc space-y-1 pl-6 font-mono text-sm text-text-secondary break-words">
          <li>get_next_work: 0x1d00ffff, 1,022,578 s, new nBits 0x1d00d86a (no clamp, no cap).</li>
          <li>get_next_work_pow_limit: 0x1d00ffff, 2,055,491 s, new nBits 0x1d00ffff (capped at powLimit).</li>
          <li>get_next_work_lower_limit_actual: 0x1c05a3f4, 289,434 s clamped to 302,400 s, new nBits 0x1c0168fd.</li>
          <li>get_next_work_upper_limit_actual: 0x1c387f6f, 6,048,000 s clamped to 4,838,400 s, new nBits 0x1d00e1fd.</li>
        </ul>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-text-secondary">
          The first period (blocks 0 to 2015) took 2,055,491 seconds, but the target stayed at 0x1d00ffff because the powLimit cap applies, not the clamp.
        </p>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <h2 className="text-xl font-semibold text-text-primary">Research disclosure</h2>
        <div className="mt-4 max-w-3xl space-y-3 text-base leading-relaxed text-text-secondary">
          <p>Written by <Link className="text-amber hover:text-accent-hover" href="/about">Michael Lip</Link>.</p>
          <p>The formula, constants and clamps on this page come from the Bitcoin Core v32.1 sources listed in How this page calculates, fetched on 2026-10-30 (UTC), and the four expected nBits vectors in src/test/pow_tests.cpp. The calculator reproduces all four vectors exactly.</p>
          <p>A next difficulty on this page is a projection from your inputs. It is a model of the retarget formula, not a forecast of the market, and it assumes the block pace you enter holds for the rest of the period.</p>
        </div>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary md:text-[2rem]">Related</h2>
        <ul className="mt-6 flex flex-wrap gap-3">
          {RELATED.map((r) => (
            <li key={r.href}><Link className="inline-flex rounded-full border border-border-subtle bg-bg-secondary px-4 py-2 font-mono text-sm text-text-secondary hover:text-text-primary" href={r.href}>{r.label}</Link></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
