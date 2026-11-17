import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { PageHeader, SectionLabel } from "@/components/PageChrome";
import { SITE_URL } from "@/lib/constants";
import CpfpRbfCalculator from "@/components/CpfpRbfCalculator";
import { BTC_PRICE_TIME } from "@/lib/fee-bump";

const URL = `${SITE_URL}/bitcoin-cpfp-calculator`;
const title = "CPFP and RBF fee bump calculator";
const description =
  "Find the child fee that lifts a stuck Bitcoin transaction by CPFP, and the minimum RBF fee under rules 3 and 4 of the Bitcoin Core v32.1 policy.";

export const metadata: Metadata = {
  title: { absolute: "Bitcoin CPFP and RBF fee bump calculator, Bitcoin Core v32.1 rules" },
  description,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { type: "article", title, description, url: URL },
  twitter: { card: "summary_large_image", title, description },
};

const FETCHED = "2026-11-17";

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
  { href: "/lightning-network-fee-calculator", label: "Lightning Network fee calculator" },
  { href: "/bitcoin-mining-profitability-calculator", label: "Bitcoin mining profitability calculator" },
];

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <PageHeader
        title="CPFP and RBF fee bump calculator"
        lead="A transaction stuck below the feerate the network is mining can be rescued two ways: child-pays-for-parent attaches a high-fee spend of its output, and replace-by-fee rebroadcasts it with a bigger fee. This page computes the exact child fee a package needs and the minimum replacement fee under rules 3 and 4 of the Bitcoin Core v32.1 replacement policy."
        eyebrow="Calculator"
        meta={`By Michael Lip · Rules from the Bitcoin Core v32.1 policy docs, fetched ${FETCHED} · All fee math runs in integer satoshis in your browser`}
      />

      <section className="mt-12">
        <CpfpRbfCalculator />
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="01" title="How this page calculates" />
        <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-text-secondary">
          <p>
            CPFP needs an output of the stuck transaction that you can spend, for example your change. You spend it in
            a child transaction with a high fee. Bitcoin Core{" "}
            <a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/doc/policy/packages.md">packages.md</a>{" "}
            defines the package feerate as the total fees divided by the total virtual size of all transactions in the
            package. A package has at most 25 transactions and 404,000 weight units. For package RBF, a package is 1
            parent and 1 child, and the parent feerate must be lower than the package feerate. The package feerate is
          </p>
        </div>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-border-subtle bg-bg-primary p-4 font-mono text-sm text-text-primary"><code>( parent_fee + child_fee ) / ( parent_size + child_size )</code></pre>
        <div className="mt-4 max-w-3xl space-y-4 text-base leading-relaxed text-text-secondary">
          <p>
            The calculator solves package feerate &gt;= target for the child fee: the smallest fee that puts the package at your
            target feerate, rounded up so you never land a fraction of a satoshi short. The arithmetic is integer
            satoshi math scaled by 1000, so large packages never drift the way floating point would.
          </p>
          <p>
            If the parent alone already pays your target feerate, a miner can take the parent without a child. The
            calculator then tells you that no child is needed. A child only helps when the parent pays less than the
            target, and the child then pays a higher feerate than the parent. The calculator assumes that the parent
            has no other unconfirmed parents.
          </p>
        </div>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="02" title="RBF rules in Bitcoin Core v32.1" />
        <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-text-secondary">
          <p>
            The current replacement policy is in the Bitcoin Core v32.1 file{" "}
            <a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/doc/policy/mempool-replacements.md">mempool-replacements.md</a>.
            Rules 1 and 2 of that file are marked as removed. These rules stay.
          </p>
          <ol className="list-decimal space-y-2 pl-6" start={3}>
            <li>The replacement pays an absolute fee of at least the sum paid by the original transactions.</li>
            <li>The additional fee pays for the size of the replacement at the incremental relay feerate. The default is 0.1 sat/vB (100 sat/kvB). Bitcoin Core rounds this fee up to a whole satoshi.</li>
            <li>The number of distinct clusters of the conflicting transactions does not exceed 100.</li>
            <li>The replacement must strictly improve the feerate diagram of the mempool.</li>
          </ol>
          <p>
            Full replace-by-fee is the default policy as of v28.0. Signaling for replace-by-fee is no longer required.
            The feerate diagram rule applies since v31.0. BIP 125 describes the older opt-in rules.
          </p>
          <p>
            The RBF tab checks rules 3 and 4 and your target feerate. It does not check rules 5 and 6. These values are
            Bitcoin Core v32.1 defaults. Other nodes and miners can run other versions or settings, for example{" "}
            <code className="font-mono text-sm text-text-primary">-incrementalrelayfee</code>. No fee guarantees a
            confirmation time.
          </p>
        </div>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="03" title="Which bump to pick" />
        <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-text-secondary">
          <p>
            For the same stuck transaction and the same target, RBF usually costs less extra fee than CPFP. Near the
            lowest feerates, rule 4 can make RBF cost more. A replacement of
            the same size pays the target feerate on the parent size only. A child must also pay the target feerate on
            its own size. The CPFP tab shows both amounts. CPFP needs an output of the stuck transaction that you can
            spend, for example your change. RBF needs the keys of the inputs of the stuck transaction.
          </p>
          <p>
            Both tabs use integer arithmetic and the Bitcoin Core v32.1 default policy values. They do not submit
            anything to the network. Use the numbers to plan a fee before you broadcast from your wallet.
          </p>
        </div>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="04" title="Sources and author" />
        <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-text-secondary">
          <p>
            Written by <Link className="text-amber hover:text-accent-hover" href="/about">Michael Lip</Link>.
          </p>
          <p className="[overflow-wrap:anywhere]">
            The replacement rules are from{" "}
            <a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/doc/policy/mempool-replacements.md">mempool-replacements.md</a>.
            The package feerate and the package limits are from{" "}
            <a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/doc/policy/packages.md">packages.md</a>.
            The 100 sat/kvB default is DEFAULT_INCREMENTAL_RELAY_FEE in{" "}
            <a className="text-amber hover:text-accent-hover" href="https://github.com/bitcoin/bitcoin/blob/v32.1/src/policy/policy.h">policy.h</a>.
            All are Bitcoin Core v32.1, the latest version on{" "}
            <a className="text-amber hover:text-accent-hover" href="https://bitcoincore.org/en/download/">bitcoincore.org</a>,
            fetched on {FETCHED} (UTC). The BTC price is from{" "}
            <a className="text-amber hover:text-accent-hover" href="https://mempool.space/api/v1/prices">mempool.space</a>{" "}
            at {BTC_PRICE_TIME} UTC. It is a dated figure, not a live feed.
          </p>
        </div>
      </section>

      <section className="mt-20 border-t border-border-subtle pt-12">
        <SectionLabel number="05" title="Related calculators" />
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
