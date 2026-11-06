import type { Metadata } from "next";
import Link from "next/link";
import scorecardData from "../../../data/altcoin-scorecard.json";
import { PageHeader, SectionLabel, Prose, Section } from "@/components/PageChrome";
import JsonLd from "@/components/JsonLd";
import AnswerBlock from "@/components/AnswerBlock";
import { CONTENT_CHECKED } from "@/lib/constants";
import { getWebPageSchema } from "@/lib/structured-data";

const TOKEN_COUNT = scorecardData.tokens.length;

/** Direct answer to this page's main question, restated from the page's own facts. */
const PAGE_ANSWER =
  "Research on Early Thunder is free and needs no account. The Token Evidence Workbench is $29 once, with no subscription. The research API charges per call: each request answers with an HTTP 402 payment challenge, the agent pays in USDC on Base or Solana, and the live challenge is the authoritative price.";

export const metadata: Metadata = {
  title: "Pricing: Free Research, $29 Workbench, Pay-per-call API",
  description: `The research on Early Thunder is free: the ${TOKEN_COUNT}-token scorecard, token research pages, the CLARITY Act tracker and the calculators. The Token Evidence Workbench is $29 once. The research API for agents is pay per call from $0.01.`,
  openGraph: {
    title: "Pricing: Free Research, $29 Workbench, Pay-per-call API",
    description: `Free research, a $29 one-time Workbench, and a pay-per-call API from $0.01.`,
  },
};

const WORKBENCH_URL =
  "https://workbench.earlythunder.com/workbench/?utm_source=earlythunder&utm_medium=website&utm_content=pricing";

interface Plan {
  readonly name: string;
  readonly price: string;
  readonly priceNote: string;
  readonly summary: string;
  readonly items: readonly string[];
  readonly cta: { readonly label: string; readonly href: string; readonly external: boolean };
}

const PLANS: readonly Plan[] = [
  {
    name: "Research",
    price: "$0",
    priceNote: "free, no account",
    summary: "Everything you can read on this site.",
    items: [
      `Altcoin scorecard: ${TOKEN_COUNT} tokens scored on 25 variables`,
      "Token research pages with sources, risks and supply data",
      "CLARITY Act tracker and regulatory deadlines",
      "Crypto calculators: profit, DCA, fees, staking, tax and more",
      "Blog and methodology notes",
    ],
    cta: { label: "Open the scorecard", href: "/scorecard", external: false },
  },
  {
    name: "Token Evidence Workbench",
    price: "$29",
    priceNote: "once, no subscription",
    summary: "An offline browser app for doing your own token research.",
    items: [
      "Keep each claim next to its source and date",
      "Compare projects on fees, protocol revenue and holder revenue",
      "Export a printable memo, CSV data and a JSON backup",
      "Downloadable ZIP, runs in a desktop browser",
      "No live data feeds and no buy or sell signals. You enter the evidence",
    ],
    cta: { label: "Get the Workbench, $29", href: WORKBENCH_URL, external: true },
  },
  {
    name: "Research API for agents",
    price: "from $0.01",
    priceNote: "per call, paid in USDC via x402",
    summary: "The same research as JSON, for AI agents and scripts.",
    items: [
      "Scores for every covered asset: $0.01 per call",
      "Earnings yields: $0.01 per call",
      "Catalysts and deadlines: $0.03 per call",
      "Full scorecard with methodology: $0.05 per call",
      "One full cited thesis: $0.25 per call",
    ],
    cta: { label: "See the API prices", href: "/api-pricing", external: false },
  },
];

const FAQ_ITEMS = [
  {
    question: "Do I need an account?",
    answer:
      "No. Early Thunder has no accounts. The research pages are open to everyone, and the Workbench is a one-time download.",
  },
  {
    question: "What does the $29 Workbench include?",
    answer:
      "Version 1 of an offline browser app, a fictional example workspace, CSV templates, a source checklist and a quick-start guide. It does not include live token data, alerts or investment recommendations. You can try the working preview before you buy.",
  },
  {
    question: "How does the API charge?",
    answer:
      "Each request answers with an HTTP 402 payment challenge (x402). An agent pays the listed price in USDC on Base or Solana and gets the data back. You need no key, no subscription and no minimum. The live 402 challenge is the authoritative price.",
  },
  {
    question: "Is any of this investment advice?",
    answer:
      "No. Early Thunder publishes research and tools. Do your own checks before you buy or sell anything.",
  },
] as const;

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-28 pb-20">
      <JsonLd data={getWebPageSchema({ name: "Pricing: Free Research, $29 Workbench, Pay-per-call API", description: "Research is free. Tools cost once. Agents pay per call.", path: "/pricing", dateModified: CONTENT_CHECKED })} />
      <AnswerBlock answer={PAGE_ANSWER} updated={CONTENT_CHECKED} />
      <PageHeader
        title="Pricing"
        lead="Research is free. Tools cost once. Agents pay per call."
      />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.name} plan={plan} />
        ))}
      </div>
      <Section divider>
        <SectionLabel number="01" title="Questions" />
        <div className="max-w-3xl divide-y divide-border/50">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question} className="py-6">
              <h3 className="text-base font-medium text-text-primary">{item.question}</h3>
              <Prose>{item.answer}</Prose>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function PlanCard({ plan }: { readonly plan: Plan }) {
  const ctaClass =
    "block rounded-full border border-border py-3 text-center text-sm font-semibold text-text-primary transition-all duration-200 hover:border-border-active hover:-translate-y-0.5";
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-bg-card p-6">
      <h2 className="text-lg font-semibold tracking-tight text-text-primary">{plan.name}</h2>
      <div className="mt-4 flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-4xl font-semibold text-text-primary">{plan.price}</span>
        <span className="text-sm text-text-secondary">{plan.priceNote}</span>
      </div>
      <p className="mt-3 text-sm text-text-secondary">{plan.summary}</p>
      <ul className="mt-6 space-y-3">
        {plan.items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm text-text-secondary">
            <CheckIcon />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">
        {plan.cta.external ? (
          <a href={plan.cta.href} className={ctaClass} data-cta="pricing_workbench" data-placement="pricing">
            {plan.cta.label}
          </a>
        ) : (
          <Link href={plan.cta.href} className={ctaClass}>
            {plan.cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="mt-0.5 shrink-0 text-score-high"
      aria-hidden="true"
    >
      <path
        d="M3 8.5L6.5 12L13 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
