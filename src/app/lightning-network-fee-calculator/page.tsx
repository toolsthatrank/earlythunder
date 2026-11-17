import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { PageHeader, SectionLabel } from "@/components/PageChrome";
import { SITE_URL } from "@/lib/constants";
import LightningFeeCalculator from "@/components/LightningFeeCalculator";
import { formatInt, formatMsatAsSats, msatToSatsRoundUp, routeBackwards } from "@/lib/lightning-fee";

const URL = `${SITE_URL}/lightning-network-fee-calculator`;
const title = "Lightning Network fee calculator";
const description =
  "Calculate Lightning Network routing fees with the BOLT 7 formula. Price each hop backward from the recipient. Compare LND, Core Lightning and Eclair defaults.";

export const metadata: Metadata = {
  title: { absolute: "Lightning Network fee calculator with BOLT 7 routing math" },
  description,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { type: "article", title, description, url: URL },
  twitter: { card: "summary_large_image", title, description },
};

/** All sources below were fetched 2026-11-16 between 23:08:59Z and 23:09:08Z (UTC). */
const FETCHED = "2026-11-16";
/** Coinbase /v2/prices/BTC-USD/spot amount. Cross-check CoinGecko simple/price 65215 at the same minute (gap 0.06%). */
const PRICE_TIME = "2026-11-16T23:09:08Z";
const BTC_USD = 65251.845;

const AUTHOR = { "@type": "Person", name: "Michael Lip", url: "https://earlythunder.com/about", sameAs: ["https://github.com/theluckystrike"] };
const PUBLISHER = { "@type": "Organization", name: "AUTOM8 LLC", url: "https://earlythunder.com" };

const DATE_PUBLISHED = "2026-11-17";
const DATE_MODIFIED = "2026-11-17";

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
  { href: "/bitcoin-transaction-fee-calculator", label: "Bitcoin transaction fee calculator" },
  { href: "/bitcoin-halving-schedule", label: "Bitcoin halving schedule" },
  { href: "/crypto-fee-calculator", label: "Crypto fee calculator" },
];

const linkCls = "text-amber hover:text-accent-hover";

// Worked example, computed at build time with the same BigInt code as the calculator:
// the recipient must receive 100,000 sats (100,000,000 msat), 3 hops, each 500 msat + 100 ppm.
const EXAMPLE = routeBackwards(BigInt(100000000), Array.from({ length: 3 }, () => ({ baseFeeMsat: BigInt(500), ratePpm: BigInt(100) })));
const EXAMPLE_ROWS = EXAMPLE.ok
  ? EXAMPLE.legs.map((leg, i) => ({ hop: i + 1, ...leg, proportional: leg.feeMsat - BigInt(500) })).reverse()
  : [];

export default function Page() {
  if (!EXAMPLE.ok) return null;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <PageHeader
        title="Lightning Network fee calculator"
        lead="A routing fee is what each intermediate node charges to forward your payment. BOLT 7 gives the formula for one hop. This page applies it backward from the amount the recipient must receive and shows every intermediate number, so you can check the arithmetic hop by hop."
        eyebrow="Calculator"
        meta={`By Michael Lip · Fee formula and default fee policies quoted from the specification and the shipped configuration files, fetched ${FETCHED} · Price ${BTC_USD.toLocaleString("en-US")} USD from Coinbase spot at ${PRICE_TIME} UTC, a stored value, not a live quote`}
      />

      <section className="mt-12">
        <LightningFeeCalculator btcUsd={BTC_USD} />
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="01" title="How this page calculates" />
        <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-text-secondary">
          <p>
            The one-hop formula comes from BOLT 7, the part of the Lightning specification that covers
            routing gossip and HTLC fees. Each node announces two numbers per channel in its channel_update.
            BOLT 7 says the node &quot;MUST set fee_base_msat to the base fee (in millisatoshi) it will
            charge for any HTLC&quot; and &quot;MUST set fee_proportional_millionths to the amount (in
            millionths of a satoshi) it will charge per transferred satoshi&quot;. The second number is a rate
            in parts per million (ppm), so 1,000 ppm is 0.1%.
          </p>
          <p>
            The fee math runs in your browser with integer arithmetic in millisatoshis (1 sat = 1,000 msat),
            so no millisatoshi is lost to floating point. Only the dollar figure uses a stored BTC price
            ({BTC_USD.toLocaleString("en-US")} USD at {PRICE_TIME} UTC), and it is an approximation.
          </p>
        </div>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="02" title="The formula, one hop at a time" />
        <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-text-secondary">
          <p>For a single hop, the BOLT 7 HTLC Fees section gives the fee as</p>
        </div>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-border-subtle bg-bg-primary p-4 font-mono text-sm text-text-primary"><code>fee_base_msat + ( amount_to_forward * fee_proportional_millionths / 1000000 )</code></pre>
        <div className="mt-4 max-w-3xl space-y-4 text-base leading-relaxed text-text-secondary">
          <p>
            The division is integer division, which drops any fraction of a millisatoshi. BOLT 7 shows this in
            its own example, <code className="font-mono text-sm text-text-primary">200 + ( 4999999 * 2000 / 1000000 ) = 10199</code>,
            where exact division would give 10,199.998. <em>amount_to_forward</em> is the amount the hop passes on. Fees are carried inside
            the payment, so a hop near the sender charges on an amount that already includes every later
            hop&apos;s fee. That is why the total grows slightly faster than linearly with route length, and why
            the calculator walks the route backward. It starts from the amount the recipient must receive and
            adds each hop&apos;s fee on the way to the sender.
          </p>

          <h3 className="mt-8 text-lg font-semibold text-text-primary">A worked example you can recompute by hand</h3>
          <p>
            The recipient must receive exactly 100,000 sats (100,000,000 msat). The route has 3 hops, and every
            hop charges 500 msat + 100 ppm. Working backward, each hop receives the amount it forwards plus its
            own fee, and the amount it forwards is what the next hop receives. Hop 3 is next to the recipient.
          </p>
        </div>
        <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Worked example per-hop table">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <caption className="sr-only">Worked example, 3 hops at 500 msat + 100 ppm, recipient receives 100,000,000 msat</caption>
            <thead>
              <tr className="border-b border-border-subtle font-mono text-sm text-text-secondary">
                <th scope="col" className="py-3 pr-4">Hop</th>
                <th scope="col" className="py-3 pr-4">Forwards (msat)</th>
                <th scope="col" className="py-3 pr-4">Fee arithmetic (msat)</th>
                <th scope="col" className="py-3 pr-4">Fee (msat)</th>
                <th scope="col" className="py-3 pr-4">Receives (msat)</th>
              </tr>
            </thead>
            <tbody className="text-text-primary">
              {EXAMPLE_ROWS.map((row) => (
                <tr key={row.hop} className="border-b border-border-subtle">
                  <td className="py-3 pr-4 font-mono">{row.hop}</td>
                  <td className="py-3 pr-4 font-mono">{formatInt(row.amountOutMsat)}</td>
                  <td className="py-3 pr-4 font-mono">500 + floor({row.amountOutMsat.toString()} × 100 ÷ 1000000) = 500 + {formatInt(row.proportional)}</td>
                  <td className="py-3 pr-4 font-mono">{formatInt(row.feeMsat)}</td>
                  <td className="py-3 pr-4 font-mono">{formatInt(row.amountInMsat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 max-w-3xl space-y-4 text-base leading-relaxed text-text-secondary">
          <p>
            The sender sends {formatInt(EXAMPLE.senderAmountMsat)} msat so that {formatInt(EXAMPLE.recipientMsat)} msat
            arrive. The fees are {formatInt(EXAMPLE.totalFeeMsat)} msat, which is {formatMsatAsSats(EXAMPLE.totalFeeMsat)} sats.
            The calculator also shows this total rounded up to {formatInt(msatToSatsRoundUp(EXAMPLE.totalFeeMsat))} whole sats.
            These are the default inputs of the calculator, so its per-hop table shows the same rows.
          </p>
          <p>
            BOLT 7 has a one-hop example of its own. A pays C 4,999,999 msat through B, and B asks for
            fee_base_msat 200 and fee_proportional_millionths 2000 in its channel_update for the B to C channel.
            The fee is 10,199 msat, and the HTLC from A to B carries an amount_msat of 5010198. The BOLT 7 example
            button in the calculator loads these inputs (4999.999 sats, 1 hop, 200 + 2000) and gives the same
            5,010.198 sats.
          </p>
        </div>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="03" title="Default fee policies for node operators" />
        <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-text-secondary">
          <p>
            The Implementation defaults tab of the calculator uses the defaults that three implementations ship.
            They apply only when an operator does not set fees, and each node can set its own. The real fee of a
            route depends on the channel_update of each hop.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              LND names the two numbers bitcoin.basefee and bitcoin.feerate. Its sample-lnd.conf lists
              &quot;; bitcoin.basefee=1000&quot; and &quot;; bitcoin.feerate=1&quot;, and says the total fee
              &quot;charged is basefee + (amount * feerate / 1000000), where amount is the forwarded amount.&quot;
              The file also says &quot;If only one value is specified for an option, then this is also the
              default value used by lnd.&quot; That is 1,000 msat + 1 ppm (0.0001%).
            </li>
            <li>
              Core Lightning names them fee-base and fee-per-satoshi. Its lightningd-config(5) page gives the
              fee-base default as 1000 (&quot;The base fee to charge for every payment which passes through&quot;)
              and the fee-per-satoshi default as &quot;10 (0.001%)&quot;. It adds that the rate is &quot;in
              millionths, so 10000 is 1%, 1000 is 0.1%.&quot;
            </li>
            <li>
              Eclair names them fee-base-msat and fee-proportional-millionths. Its reference.conf sets
              &quot;fee-base-msat = 1000&quot; and &quot;fee-proportional-millionths = 200&quot; for public
              channels, with the comment &quot;(200 = 0.02%)&quot;. Private channels get 1000 and 100.
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="04" title="What this page cannot tell you" />
        <ul className="mt-4 max-w-3xl list-disc space-y-1 pl-6 text-base leading-relaxed text-text-secondary">
          <li>It does not know the fee policy of any real node. It applies the base fee and rate that you type to every hop.</li>
          <li>
            It accepts at most 20 hops. That is a limit of this calculator. BOLT 4 sizes its attribution data for
            &quot;the maximum supported number of hops in a route (20)&quot;, and it tells the sender to repeat error
            decryption &quot;27 times (maximum route length of tlv payload type)&quot;.
          </li>
          <li>It shows the fees of a payment that reaches the recipient. It does not model time locks (CLTV), channel liquidity or failed attempts.</li>
          <li>It does not model blinded paths, which BOLT 4 prices with its own route formula.</li>
          <li>The dollar figure uses one stored BTC price from {PRICE_TIME} UTC. The price changes all the time.</li>
        </ul>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="05" title="Research disclosure" />
        <div className="mt-4 max-w-3xl space-y-3 text-base leading-relaxed text-text-secondary">
          <p>Written by <Link className={linkCls} href="/about">Michael Lip</Link>.</p>
          <p className="[overflow-wrap:anywhere]">
            The fee formula, the field definitions and the A to B to C example are from{" "}
            <a className={linkCls} href="https://github.com/lightning/bolts/blob/master/07-routing-gossip.md">BOLT 7 (07-routing-gossip.md)</a>. The hop counts
            20 and 27 are from <a className={linkCls} href="https://github.com/lightning/bolts/blob/master/04-onion-routing.md">BOLT 4 (04-onion-routing.md)</a>.
            The defaults are from the LND{" "}
            <a className={linkCls} href="https://github.com/lightningnetwork/lnd/blob/master/sample-lnd.conf">sample-lnd.conf</a>, the Core Lightning{" "}
            <a className={linkCls} href="https://github.com/ElementsProject/lightning/blob/master/doc/lightningd-config.5.md">lightningd-config.5.md</a> and the Eclair{" "}
            <a className={linkCls} href="https://github.com/ACINQ/eclair/blob/master/eclair-core/src/main/resources/reference.conf">reference.conf</a>.
            The unit 1 BTC = 100,000,000 sats is COIN in Bitcoin Core{" "}
            <a className={linkCls} href="https://github.com/bitcoin/bitcoin/blob/master/src/consensus/amount.h">amount.h</a>. All were fetched on {FETCHED} (UTC).
            The price is the <a className={linkCls} href="https://api.coinbase.com/v2/prices/BTC-USD/spot">Coinbase spot rate</a> at {PRICE_TIME} UTC.
          </p>
          <p>Every default on this page is a dated figure, not a live feed.</p>
        </div>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="06" title="Related" />
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
