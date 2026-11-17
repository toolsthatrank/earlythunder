import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import BitcoinTxFeeCalculator from "@/components/BitcoinTxFeeCalculator";
import { feeSats, feeUsd, dustThresholdSats, satPerVbyteFromUsd, OUTPUT_SIZES } from "@/lib/bitcoin-tx-fee";

const URL = "https://earlythunder.com/bitcoin-transaction-fee-calculator";
const title = "Bitcoin Transaction Fee Calculator (sat/vB, vsize, USD)";
const FETCHED = "2026-10-29"; // UTC date of the source fetch (2026-10-29T05:03Z to 05:05Z)
const BTC_USD = 80154; // mempool.space /api/v1/prices, USD field
const PRICE_TIME = "2026-10-29 05:00 UTC"; // time field 1793250004 of that response
const description = "Count Bitcoin transaction inputs and outputs by script type to get weight and vsize, then the fee in sats and BTC at your sat/vB rate, plus dust limits per output type.";

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
    datePublished: "2026-10-29", dateModified: "2026-10-29", author: AUTHOR, publisher: PUBLISHER,
  },
  {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://earlythunder.com/" },
      { "@type": "ListItem", position: 2, name: title, item: URL },
    ],
  },
];

const SOURCES = [
  { title: "BIP 141 (Segregated Witness)", href: "https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki", note: `Defines transaction weight as base transaction size × 3 + total transaction size, virtual transaction size as weight / 4 rounded up to the next integer, and the block rule block weight ≤ 4,000,000. Sets the marker byte 0x00 and the flag byte 0x01. Fetched ${FETCHED}.` },
  { title: "BIP 144 (Segwit serialization)", href: "https://github.com/bitcoin/bips/blob/master/bip-0144.mediawiki", note: `Defines the witness serialization: a marker byte, a flag byte, and for each input a var_int item count followed by each item with a var_int length. An empty witness is one zero byte. Fetched ${FETCHED}.` },
  { title: "BIP 341 (Taproot)", href: "https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki", note: `A P2TR output has a 32-byte witness program. A key path spend has one witness element, a 64-byte Schnorr signature with SIGHASH_DEFAULT, or 65 bytes with a sighash byte. Fetched ${FETCHED}.` },
  { title: "BIP 66 (Strict DER signatures)", href: "https://github.com/bitcoin/bips/blob/master/bip-0066.mediawiki", note: `An ECDSA signature has the format 0x30 [total-length] 0x02 [R-length] [R] 0x02 [S-length] [S] [sighash], so its length changes with R and S. The check rejects a signature above 73 bytes with the sighash byte. Fetched ${FETCHED}.` },
  { title: "Bitcoin Core v32.1 src/policy/feerate.cpp", href: "https://github.com/bitcoin/bitcoin/blob/v32.1/src/policy/feerate.cpp", note: `CFeeRate::GetFee(virtual_bytes) returns EvaluateFeeUp(virtual_bytes). FeeRateFormat::SAT_VB prints a rate in sat/vB with 3 decimals. Fetched ${FETCHED}.` },
  { title: "Bitcoin Core v32.1 src/util/feefrac.h", href: "https://github.com/bitcoin/bitcoin/blob/v32.1/src/util/feefrac.h", note: `EvaluateFeeUp multiplies the fee rate by the size and divides with CeilDiv, so the fee rounds up to the next whole satoshi. Fetched ${FETCHED}.` },
  { title: "Bitcoin Core v32.1 src/policy/policy.h", href: "https://github.com/bitcoin/bitcoin/blob/v32.1/src/policy/policy.h", note: `DUST_RELAY_TX_FEE is 3000 (sat/kvB), DEFAULT_MIN_RELAY_TX_FEE is 100 (sat/kvB) and MAX_STANDARD_TX_WEIGHT is 400,000. Fetched ${FETCHED}.` },
  { title: "Bitcoin Core v32.1 src/policy/policy.cpp", href: "https://github.com/bitcoin/bitcoin/blob/v32.1/src/policy/policy.cpp", note: `GetDustThreshold returns dustRelayFee.GetFee(output size + spend size), with a spend size of 32 + 4 + 1 + 107 + 4 = 148 bytes, or 32 + 4 + 1 + 107 / 4 + 4 = 67 bytes for a witness program (107 / 4 is 26 in integer division). IsStandardTx rejects a transaction above MAX_STANDARD_TX_WEIGHT (reason tx-size). Fetched ${FETCHED}.` },
  { title: "Bitcoin Core v32.1 src/consensus/tx_check.cpp", href: "https://github.com/bitcoin/bitcoin/blob/v32.1/src/consensus/tx_check.cpp", note: `CheckTransaction rejects a transaction with no inputs (bad-txns-vin-empty) or no outputs (bad-txns-vout-empty). Fetched ${FETCHED}.` },
  { title: "Bitcoin Core v32.1 src/serialize.h", href: "https://github.com/bitcoin/bitcoin/blob/v32.1/src/serialize.h", note: `A CompactSize count is 1 byte below 253 and 3 bytes up to 65,535. Fetched ${FETCHED}.` },
  { title: "Bitcoin Core download page", href: "https://bitcoincore.org/en/download/", note: `Shows Latest version: 32.1. Fetched ${FETCHED}.` },
  { title: "mempool.space price API", href: "https://mempool.space/api/v1/prices", note: `Response with time ${PRICE_TIME} and USD ${BTC_USD.toLocaleString("en-US")}. Fetched ${FETCHED}. The calculator uses this stored value and does not fetch it live.` },
] as const;

const RELATED = [
  { href: "/crypto-fee-calculator", label: "Crypto fee calculator" },
  { href: "/lightning-network-fee-calculator", label: "Lightning Network fee calculator" },
  { href: "/bitcoin-halving-schedule", label: "Bitcoin halving schedule" },
  { href: "/opportunities/bitcoin", label: "Bitcoin thesis" },
] as const;

const fmtInt = (n: number) => n.toLocaleString("en-US");
const fmtUsd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EXAMPLE_TXS = [
  { label: "Legacy, P2PKH", vsize: 226 },
  { label: "Segwit, P2WPKH", vsize: 141 },
  { label: "Taproot, P2TR key path", vsize: 154 },
];

function workedExampleRows() {
  return [5, 20, 100].map((rate) => ({
    rate,
    rows: EXAMPLE_TXS.map((r) => ({ ...r, sats: feeSats(rate, r.vsize), usd: feeUsd(feeSats(rate, r.vsize), BTC_USD) })),
  }));
}

const BUDGET_SATS = Math.floor((1 / BTC_USD) * 100_000_000);
const BUDGET_RATE = satPerVbyteFromUsd(1, 141, BTC_USD);

export default function BitcoinTransactionFeeCalculatorPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20 md:py-24">
      {schemas.map((schema, index) => <JsonLd key={index} data={schema} />)}
      <nav aria-label="Breadcrumb" className="mb-8 font-mono text-sm text-text-secondary"><Link href="/" className="hover:text-text-primary">Home</Link><span className="px-2" aria-hidden="true">/</span><span>{title}</span></nav>
      <header>
        <span className="inline-flex items-center gap-2 font-mono text-sm uppercase tracking-[0.08em] text-text-secondary"><span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-positive" />Fee math reference</span>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-tighter text-text-primary md:text-6xl">{title}</h1>
        <p className="mt-8 max-w-3xl text-lg leading-relaxed text-text-secondary">At a fee rate in satoshis per virtual byte, Bitcoin Core computes the fee as that rate times the transaction&apos;s vsize, rounded up to the next whole satoshi. This page counts the inputs and outputs of a transaction by script type to get its weight and vsize, then converts your fee rate to satoshis, BTC and dollars. It also gives the dust limit of each output type. The rules come from Bitcoin Core v32.1 and BIPs 141, 144 and 341.</p>
        <p className="mt-5 inline-flex max-w-3xl rounded-xl border border-border-subtle bg-bg-secondary px-4 py-3 font-mono text-sm leading-relaxed text-text-secondary">You enter the fee rate. This page does not give a current or recommended fee rate. BTC/USD = ${fmtInt(BTC_USD)} from the mempool.space price API, price time {PRICE_TIME}. The page does not fetch price or fee data live. Sources fetched {FETCHED}.</p>
      </header>

      <BitcoinTxFeeCalculator btcUsd={BTC_USD} priceDate={PRICE_TIME} />

      <section className="mt-20 border-t border-border-subtle pt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary md:text-[2rem]">How this page calculates</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border-subtle bg-bg-secondary p-6 font-mono text-sm leading-relaxed text-text-primary">base_size = 4 (version) + 4 (locktime) + CompactSize(input count) + CompactSize(output count) + input base bytes + output bytes</div>
          <div className="rounded-2xl border border-border-subtle bg-bg-secondary p-6 font-mono text-sm leading-relaxed text-text-primary">total_size = base_size + 2 (marker, flag) + witness bytes + 1 per P2PKH input, only when an input has witness data. Else total_size = base_size</div>
          <div className="rounded-2xl border border-border-subtle bg-bg-secondary p-6 font-mono text-sm leading-relaxed text-text-primary">weight = base_size &times; 3 + total_size, vsize = weight / 4 rounded up one time for the whole transaction. Standard limit 400,000 weight units, block limit 4,000,000</div>
          <div className="rounded-2xl border border-border-subtle bg-bg-secondary p-6 font-mono text-sm leading-relaxed text-text-primary">fee_sats = ceil(sat/kvB &times; vsize / 1,000), sat/kvB = sat/vB &times; 1,000</div>
          <div className="rounded-2xl border border-border-subtle bg-bg-secondary p-6 font-mono text-sm leading-relaxed text-text-primary md:col-span-2">dust if value &lt; ceil(3,000 sat/kvB &times; (output_size + spend_size) / 1,000), spend_size = 148, or 67 for a witness program (P2WPKH, P2TR)</div>
        </div>
        <div className="mt-6 max-w-3xl space-y-4 text-[1.0625rem] leading-[1.75] text-text-secondary">
          <p>BIP 141 defines transaction weight as the base transaction size times 3 plus the total transaction size. It defines virtual size as the weight divided by 4, rounded up to the next integer. So a witness byte adds 1 weight unit and a base byte adds 4. Example: a transaction with 1 P2WPKH input and 2 P2WPKH outputs has 113 base bytes and 223 total bytes, so its weight is 562 and its vsize is 141. The same counts with P2PKH have 226 bytes and no witness, so the weight is 904 and the vsize is 226.</p>
          <p>A CompactSize count is 1 byte for fewer than 253 items and 3 bytes up to 65,535 (serialize.h). The calculator accepts at most 10,000 of each type, so a count uses 1 or 3 bytes.</p>
          <p>CFeeRate::GetFee returns EvaluateFeeUp(virtual_bytes). For a rate set in sat/kvB, the fee is the rate times the size in vbytes, divided by 1,000 and rounded up to the next whole satoshi. Bitcoin Core prints a rate in sat/vB with 3 decimals (FeeRateFormat::SAT_VB), so the calculator accepts at most 3 decimals. One sat/vB equals 1,000 sat/kvB.</p>
          <p>GetDustThreshold in src/policy/policy.cpp prices an output at the dust relay fee, 3,000 sat/kvB by default, over the output size plus the size of an input that spends it. An output with a value below that fee is dust. An unspendable output, such as OP_RETURN, has a threshold of 0.</p>
        </div>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary md:text-[2rem]">Worked examples at three fee rates</h2>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-text-secondary">Each row is a transaction with 1 input and 2 outputs of the same type. Fee = sat/vB &times; vsize, rounded up to the next whole satoshi, priced at ${fmtInt(BTC_USD)}/BTC (price time {PRICE_TIME}).</p>
        <div className="mt-8 overflow-x-auto" tabIndex={0} role="region" aria-label="Fee examples table">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">Fee in satoshis and USD for three transaction types at 5, 20 and 100 sat/vB</caption>
            <thead>
              <tr className="border-b border-border-subtle font-mono text-sm text-text-secondary">
                <th scope="col" className="py-3 pr-4">Fee rate</th>
                <th scope="col" className="py-3 pr-4">Transaction type</th>
                <th scope="col" className="py-3 pr-4">vsize (vB)</th>
                <th scope="col" className="py-3 pr-4">Fee (sats)</th>
                <th scope="col" className="py-3">Fee (USD)</th>
              </tr>
            </thead>
            <tbody className="text-text-primary">
              {workedExampleRows().flatMap((group) =>
                group.rows.map((row) => (
                  <tr key={`${group.rate}-${row.label}`} className="border-b border-border-subtle">
                    <td className="py-3 pr-4 font-mono">{group.rate} sat/vB</td>
                    <td className="py-3 pr-4">{row.label}</td>
                    <td className="py-3 pr-4 font-mono">{row.vsize}</td>
                    <td className="py-3 pr-4 font-mono">{fmtInt(row.sats)}</td>
                    <td className="py-3 font-mono">${fmtUsd(row.usd)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-text-secondary">At each rate in the table, the taproot transaction (154 vB) pays about 68% of the fee of the legacy transaction (226 vB).</p>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary md:text-[2rem]">Dust limits at the default relay policy</h2>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-text-secondary">Bitcoin Core v32.1 sets DUST_RELAY_TX_FEE to 3,000 sat/kvB (3 sat/vB) in policy.h. GetDustThreshold adds the output size to the size of an input that spends it. For a P2PKH or P2SH output that input is 32 + 4 + 1 + 107 + 4 = 148 bytes. For a witness program (P2WPKH, P2TR) the code divides the 107 bytes of signature and key data by 4 with integer division, so the input is 32 + 4 + 1 + 26 + 4 = 67 vbytes. A comment in policy.cpp says that a P2TR key path spend is smaller, but the code keeps this size so that the dust level does not go down further.</p>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {(["P2PKH", "P2SH", "P2WPKH", "P2TR"] as const).map((t) => {
            const spendBytes = t === "P2WPKH" || t === "P2TR" ? 67 : 148;
            return (
              <li key={t} className="rounded-xl border border-border-subtle bg-bg-card p-5 font-mono text-sm text-text-primary">
                {t} output {OUTPUT_SIZES[t]} + spend {spendBytes} = {OUTPUT_SIZES[t] + spendBytes} bytes, dust below {fmtInt(dustThresholdSats(t))} sats
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-20 rounded-2xl border border-amber/30 bg-bg-secondary p-6 md:p-8"><span className="font-mono text-sm uppercase tracking-wider text-amber">Worked example</span><h2 className="mt-3 text-2xl font-semibold text-text-primary">A 141 vB segwit payment at 20 sat/vB</h2><p className="mt-4 max-w-3xl text-base leading-relaxed text-text-secondary">fee = 20 &times; 141 = {fmtInt(feeSats(20, 141))} satoshis. At ${fmtInt(BTC_USD)}/BTC that is ${fmtUsd(feeUsd(feeSats(20, 141), BTC_USD))}. With a $1.00 budget, 1.00 &divide; {fmtInt(BTC_USD)} &times; 100,000,000 gives {fmtInt(BUDGET_SATS)} whole satoshis. {fmtInt(BUDGET_SATS)} &divide; 141 vB, rounded down to 0.001, is {BUDGET_RATE.toFixed(3)} sat/vB, and at that rate the fee is {fmtInt(feeSats(BUDGET_RATE, 141))} satoshis. The calculator above does both directions.</p></section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <span className="font-mono text-sm uppercase tracking-wider text-text-secondary">Primary references</span>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary md:text-[2rem]">Where these numbers come from</h2>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-text-secondary">The constants below are stored in the page source. The calculator does not fetch data from an outside service at run time.</p>
        <ol className="mt-6 grid gap-4 md:grid-cols-2">
          {SOURCES.map((source) => <li key={source.href} className="rounded-xl border border-border-subtle bg-bg-card p-5"><a className="font-medium text-amber hover:text-accent-hover" href={source.href}>{source.title}<span aria-hidden="true"> ↗</span></a><p className="mt-2 text-sm leading-relaxed text-text-secondary">{source.note}</p></li>)}
        </ol>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12"><h2 className="text-2xl font-semibold tracking-tight text-text-primary md:text-[2rem]">Related pages</h2><div className="mt-6 flex flex-wrap gap-3">{RELATED.map((item) => <Link key={item.href} href={item.href} className="ghost-btn">{item.label}<span className="arr">&rarr;</span></Link>)}</div></section>

      <section className="mt-20 rounded-2xl border border-border-subtle bg-bg-secondary p-6"><h2 className="text-xl font-semibold text-text-primary">Research disclosure</h2><p className="mt-4 max-w-3xl text-sm leading-relaxed text-text-secondary">This page describes fee arithmetic and relay policy defaults. It is not investment advice, and it does not give a current or recommended fee rate. Check a live fee estimator before you broadcast a transaction.</p><p className="mt-4 text-sm text-text-secondary">Written by <Link className="text-amber hover:text-accent-hover" href="/about">Michael Lip</Link>.</p></section>
    </div>
  );
}
