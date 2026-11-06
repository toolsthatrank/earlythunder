"use client";

import { useState } from "react";

/* --- Types --- */

interface Protocol {
  readonly name: string;
  readonly score: number;
  readonly category: string;
}

interface CoverageMapProps {
  readonly protocols: readonly Protocol[];
}

interface TierInfo {
  readonly label: string;
  readonly color: string;
  readonly count: number;
}

/* --- Helpers --- */

function tierColor(score: number): string {
  if (score >= 85) return "var(--color-score-elite, #F5A623)";
  if (score >= 70) return "var(--color-score-high, #22C55E)";
  if (score >= 50) return "var(--color-score-mid, #3B82F6)";
  return "var(--color-score-low, #6B7280)";
}

function tierLabel(score: number): string {
  if (score >= 85) return "ELITE";
  if (score >= 70) return "HIGH";
  if (score >= 50) return "MID";
  return "LOW";
}

function cellOpacity(score: number): number {
  return 0.4 + (score / 100) * 0.6;
}

/* --- HeatmapCell --- */

function HeatmapCell({
  protocol,
  index,
  onHover,
  onLeave,
}: {
  readonly protocol: Protocol;
  readonly index: number;
  readonly onHover: (idx: number) => void;
  readonly onLeave: () => void;
}) {
  return (
    <button
      className="cov-cell"
      style={{
        backgroundColor: tierColor(protocol.score),
        opacity: cellOpacity(protocol.score),
      }}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={onLeave}
      type="button"
    >
      <span className="sr-only">{protocol.name} scores {protocol.score}</span>
    </button>
  );
}

/* --- DetailPanel --- */

function DetailPanel({
  protocol,
  index,
  total,
}: {
  readonly protocol: Protocol | null;
  readonly index: number;
  readonly total: number;
}) {
  if (!protocol) {
    return (
      <aside className="coverage__detail">
        <span className="coverage__detail-tag">COVERAGE MAP</span>
        <span className="coverage__detail-name">Hover any cell</span>
        <span className="coverage__detail-meta">{total} protocols tracked</span>
      </aside>
    );
  }

  return (
    <aside className="coverage__detail">
      <span className="coverage__detail-tag">PROTOCOL #{String(index + 1).padStart(3, "0")}</span>
      <span className="coverage__detail-name">{protocol.name}</span>
      <span className="coverage__detail-cat">{protocol.category}</span>
      <span className="coverage__detail-score" style={{ color: tierColor(protocol.score) }}>
        {protocol.score}
      </span>
      <span className="coverage__detail-meta">{tierLabel(protocol.score)}</span>
    </aside>
  );
}

/* --- Legend --- */

function Legend({ protocols }: { readonly protocols: readonly Protocol[] }) {
  const tiers: readonly TierInfo[] = [
    { label: "85\u2013100", color: "var(--color-score-elite, #F5A623)", count: protocols.filter((p) => p.score >= 85).length },
    { label: "70\u201384", color: "var(--color-score-high, #22C55E)", count: protocols.filter((p) => p.score >= 70 && p.score < 85).length },
    { label: "50\u201369", color: "var(--color-score-mid, #3B82F6)", count: protocols.filter((p) => p.score >= 50 && p.score < 70).length },
    { label: "<50", color: "var(--color-score-low, #6B7280)", count: protocols.filter((p) => p.score < 50).length },
  ];

  return (
    <div className="coverage-legend mono">
      {tiers.map((tier) => (
        <div key={tier.label} className="coverage-legend__item">
          <span
            className="coverage-legend__swatch"
            style={{ backgroundColor: tier.color }}
          />
          <span>{tier.label} &middot; {tier.count}</span>
        </div>
      ))}
    </div>
  );
}

/* --- CoverageMap (main export) --- */

export default function CoverageMap({ protocols }: CoverageMapProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const bounded = protocols.slice(0, 154);
  const hoveredProtocol = hoveredIdx !== null ? bounded[hoveredIdx] : null;

  return (
    <section className="section">
      <div className="section__head">
        <div>
          <div className="section__eyebrow mono">07, COVERAGE</div>
          <h2 className="section__title">Every protocol on one screen</h2>
          <p className="section__sub">
            {bounded.length} active protocols. Each cell is a current conviction score.
            Hover to inspect.
          </p>
        </div>
        <Legend protocols={bounded} />
      </div>
      <div className="coverage">
        <div className="coverage__grid">
          {bounded.map((protocol, idx) => (
            <HeatmapCell
              key={protocol.name}
              protocol={protocol}
              index={idx}
              onHover={setHoveredIdx}
              onLeave={() => setHoveredIdx(null)}
            />
          ))}
        </div>
        <DetailPanel
          protocol={hoveredProtocol}
          index={hoveredIdx ?? 0}
          total={bounded.length}
        />
      </div>
    </section>
  );
}
