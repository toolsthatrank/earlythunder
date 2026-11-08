"use client";

import { useMemo, useState } from "react";
import {
  miningResult,
  projections,
  validateInputs,
  type MiningInputs,
} from "@/lib/bitcoin-mining";

/**
 * Mining profitability form. All state is the reader's own input; the only
 * market data on the page is passed in as dated default props and is fully
 * editable. No fetch happens here.
 */

export interface MiningDefaults {
  /** Difficulty-implied network hashrate, TH/s (from the fetched difficulty). */
  networkThsDefault: string;
  /** Difficulty itself, shown for provenance. */
  difficultyDefault: string;
  /** BTC spot price at the fetch instant, USD. */
  priceUsdDefault: string;
  /** Post-April-2024 halving subsidy plus recent fees, BTC per block. */
  rewardBtcDefault: string;
  /** Machine presets a reader can load (specs only, no prices). */
  presets: { name: string; hashrateThs: number; watts: number }[];
  /** UTC fetch time of the network constants and the price, ISO minute. */
  fetchedAt: string;
  /** Chain tip height at the fetch time. */
  tipHeight: number;
  /** mempool.space difficultyChange estimate at the fetch time, percent. */
  difficultyChangeDefault: string;
}

/** Whole-string number parse. "3,510" and "236abc" are rejected, not cut to 3 and 236. */
function parseStrict(s: string): number {
  const t = s.trim();
  return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t) ? Number(t) : Number.NaN;
}

function fmtUsd(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-$" : "$";
  return sign + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 2 });
}

function fmtNum(n: number, digits = 8): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export default function MiningProfitabilityCalculator({ defaults }: { readonly defaults: MiningDefaults }) {
  const [hashrateThs, setHashrateThs] = useState("234");
  const [watts, setWatts] = useState("3510");
  const [usdPerKwh, setUsdPerKwh] = useState("0.05");
  const [poolFeePct, setPoolFeePct] = useState("1");
  const [hardwareUsd, setHardwareUsd] = useState("4000");
  const [rewardBtc, setRewardBtc] = useState(defaults.rewardBtcDefault);
  const [networkThs, setNetworkThs] = useState(defaults.networkThsDefault);
  const [priceUsd, setPriceUsd] = useState(defaults.priceUsdDefault);
  const [difficultyChangePct, setDifficultyChangePct] = useState(defaults.difficultyChangeDefault);

  const inputs: MiningInputs = useMemo(
    () => ({
      hashrateThs: parseStrict(hashrateThs),
      watts: parseStrict(watts),
      usdPerKwh: parseStrict(usdPerKwh),
      poolFeePct: parseStrict(poolFeePct),
      hardwareUsd: parseStrict(hardwareUsd),
      rewardBtc: parseStrict(rewardBtc),
      networkThs: parseStrict(networkThs),
      priceUsd: parseStrict(priceUsd),
    }),
    [hashrateThs, watts, usdPerKwh, poolFeePct, hardwareUsd, rewardBtc, networkThs, priceUsd],
  );

  const error = useMemo(() => validateInputs(inputs), [inputs]);
  const result = useMemo(() => (error === null ? miningResult(inputs) : null), [error, inputs]);
  const proj = useMemo(
    () => (error === null ? projections(inputs, parseStrict(difficultyChangePct), defaults.tipHeight) : null),
    [error, inputs, difficultyChangePct, defaults.tipHeight],
  );

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Hashrate, TH/s</span>
          <input className="mt-1 w-full rounded-md border border-border-subtle bg-bg-secondary px-3 py-2 font-mono text-text-primary" inputMode="decimal" value={hashrateThs} onChange={(e) => setHashrateThs(e.target.value)} />
        </label>
        <label className="block">
          <span className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Power draw, watts</span>
          <input className="mt-1 w-full rounded-md border border-border-subtle bg-bg-secondary px-3 py-2 font-mono text-text-primary" inputMode="decimal" value={watts} onChange={(e) => setWatts(e.target.value)} />
        </label>
        <label className="block">
          <span className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Electricity, $ per kWh</span>
          <input className="mt-1 w-full rounded-md border border-border-subtle bg-bg-secondary px-3 py-2 font-mono text-text-primary" inputMode="decimal" value={usdPerKwh} onChange={(e) => setUsdPerKwh(e.target.value)} />
        </label>
        <label className="block">
          <span className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Pool fee, %</span>
          <input className="mt-1 w-full rounded-md border border-border-subtle bg-bg-secondary px-3 py-2 font-mono text-text-primary" inputMode="decimal" value={poolFeePct} onChange={(e) => setPoolFeePct(e.target.value)} />
        </label>
        <label className="block">
          <span className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Hardware cost, $</span>
          <input className="mt-1 w-full rounded-md border border-border-subtle bg-bg-secondary px-3 py-2 font-mono text-text-primary" inputMode="decimal" value={hardwareUsd} onChange={(e) => setHardwareUsd(e.target.value)} />
        </label>
      </div>
      <p className="font-mono text-xs text-text-tertiary">The defaults of 0.05 $ per kWh, a 1% pool fee and a 4,000 $ hardware cost are examples, not market data. Enter your own terms.</p>

      <details className="rounded-md border border-border-subtle bg-bg-secondary p-4">
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-text-tertiary">Network constants (dated, editable)</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Network hashrate, TH/s</span>
            <input className="mt-1 w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 font-mono text-text-primary" inputMode="decimal" value={networkThs} onChange={(e) => setNetworkThs(e.target.value)} />
            <span className="mt-1 block font-mono text-xs text-text-tertiary">The default is the difficulty-implied hashrate, difficulty {defaults.difficultyDefault} × 2^32 ÷ 600 s, with the difficulty fetched {defaults.fetchedAt} UTC. Replace it with a current reading for live numbers.</span>
          </label>
          <label className="block">
            <span className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Block reward, BTC</span>
            <input className="mt-1 w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 font-mono text-text-primary" inputMode="decimal" value={rewardBtc} onChange={(e) => setRewardBtc(e.target.value)} />
            <span className="mt-1 block font-mono text-xs text-text-tertiary">The default is the mean reward of the last 144 blocks (3.125 BTC subsidy plus fees), fetched {defaults.fetchedAt} UTC.</span>
          </label>
          <label className="block">
            <span className="font-mono text-xs uppercase tracking-wider text-text-tertiary">BTC price, $</span>
            <input className="mt-1 w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 font-mono text-text-primary" inputMode="decimal" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} />
            <span className="mt-1 block font-mono text-xs text-text-tertiary">The default is the Coinbase spot price fetched {defaults.fetchedAt} UTC.</span>
          </label>
          <label className="block">
            <span className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Difficulty change, % (projection input)</span>
            <input className="mt-1 w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 font-mono text-text-primary" inputMode="decimal" value={difficultyChangePct} onChange={(e) => setDifficultyChangePct(e.target.value)} />
            <span className="mt-1 block font-mono text-xs text-text-tertiary">The default is the mempool.space estimate for the next retarget, fetched {defaults.fetchedAt} UTC. It is an estimate, not a forecast.</span>
          </label>
        </div>
      </details>

      {defaults.presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Load a machine</span>
          {defaults.presets.map((p) => (
            <button
              key={p.name}
              type="button"
              className="rounded-full border border-border-subtle bg-bg-secondary px-3 py-1 font-mono text-xs text-text-secondary hover:text-text-primary"
              onClick={() => {
                setHashrateThs(String(p.hashrateThs));
                setWatts(String(p.watts));
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {error !== null ? (
        <p className="rounded-md border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-text-primary" role="alert">{error}</p>
      ) : result === null ? (
        <p className="text-sm text-text-tertiary" role="status">Enter your machine and electricity terms above.</p>
      ) : (
        <div className="overflow-x-auto" role="status" aria-live="polite">
          <table className="w-full max-w-3xl border-collapse font-mono text-sm">
            <tbody>
              <tr><td className="border-b border-border-subtle py-2 pr-6 text-text-secondary">Share of network hashrate</td><td className="border-b border-border-subtle py-2 text-right text-text-primary">{result.sharePct.toExponential(2)}%</td></tr>
              <tr><td className="border-b border-border-subtle py-2 pr-6 text-text-secondary">BTC mined per day</td><td className="border-b border-border-subtle py-2 text-right text-text-primary">{fmtNum(result.btcPerDay)}</td></tr>
              <tr><td className="border-b border-border-subtle py-2 pr-6 text-text-secondary">Gross revenue per day</td><td className="border-b border-border-subtle py-2 text-right text-text-primary">{fmtUsd(result.revenueUsdPerDay)}</td></tr>
              <tr><td className="border-b border-border-subtle py-2 pr-6 text-text-secondary">Electricity cost per day</td><td className="border-b border-border-subtle py-2 text-right text-text-primary">{fmtUsd(result.electricityUsdPerDay)}</td></tr>
              <tr><td className="border-b border-border-subtle py-2 pr-6 text-text-secondary">Pool fee per day</td><td className="border-b border-border-subtle py-2 text-right text-text-primary">{fmtUsd(result.poolFeeUsdPerDay)}</td></tr>
              <tr><td className="border-b border-border-subtle py-2 pr-6 text-text-secondary">Net result per day</td><td className={"border-b border-border-subtle py-2 text-right font-semibold " + (result.netUsdPerDay >= 0 ? "text-text-primary" : "text-amber")}>{fmtUsd(result.netUsdPerDay)}</td></tr>
              <tr><td className="border-b border-border-subtle py-2 pr-6 text-text-secondary">Net result per 30 days</td><td className="border-b border-border-subtle py-2 text-right text-text-primary">{fmtUsd(result.netUsdPer30d)}</td></tr>
              <tr><td className="border-b border-border-subtle py-2 pr-6 text-text-secondary">Breakeven on hardware</td><td className="border-b border-border-subtle py-2 text-right text-text-primary">{result.breakevenDays === null ? "never at these inputs" : `${Math.ceil(result.breakevenDays).toLocaleString("en-US")} days`}</td></tr>
              <tr><td className="border-b border-border-subtle py-2 pr-6 text-text-secondary">Net change for +1% price</td><td className="border-b border-border-subtle py-2 text-right text-text-primary">{fmtUsd(result.netPer1PctPriceUsd)}/day</td></tr>
              <tr><td className="border-b border-border-subtle py-2 pr-6 text-text-secondary">Net change for +$0.01 per kWh</td><td className="border-b border-border-subtle py-2 text-right text-text-primary">{fmtUsd(result.netPerCentKwhUsd)}/day</td></tr>
              <tr><td className="border-b border-border-subtle py-2 pr-6 text-text-secondary">Efficiency</td><td className="border-b border-border-subtle py-2 text-right text-text-primary">{fmtNum(result.joulesPerTh, 2)} J/TH</td></tr>
              <tr><td className="border-b border-border-subtle py-2 pr-6 text-text-secondary">Break-even electricity price</td><td className="border-b border-border-subtle py-2 text-right text-text-primary">{result.breakevenUsdPerKwh === null ? "no power cost" : `${fmtUsd(result.breakevenUsdPerKwh, 4)} per kWh`}</td></tr>
              <tr><td className="border-b border-border-subtle py-2 pr-6 text-text-secondary">Hashprice (per PH/s per day)</td><td className="border-b border-border-subtle py-2 text-right text-text-primary">{fmtNum(result.hashpriceBtcPerPhDay, 8)} BTC, {fmtUsd(result.hashpriceUsdPerPhDay)} (per TH/s {fmtUsd(result.hashpriceUsdPerPhDay / 1000, 4)})</td></tr>
              {proj !== null && (
                <>
                  <tr><td className="border-b border-border-subtle py-2 pr-6 text-text-secondary">Projection, net per day after a {difficultyChangePct}% difficulty change</td><td className="border-b border-border-subtle py-2 text-right text-text-primary">{fmtUsd(proj.netUsdPerDayAfterDifficulty)}</td></tr>
                  <tr><td className="py-2 pr-6 text-text-secondary">Projection, net per day after the halving at block {proj.nextHalvingHeight.toLocaleString("en-US")} (subsidy {proj.nextSubsidyBtc} BTC)</td><td className="py-2 text-right text-text-primary">{fmtUsd(proj.netUsdPerDayAfterHalving)}</td></tr>
                </>
              )}
            </tbody>
          </table>
          <p className="mt-3 max-w-3xl font-mono text-xs text-text-tertiary">All arithmetic runs in your browser from the inputs above and the dated network constants. Nothing is sent anywhere. Results assume a constant price, difficulty and fee level. The difficulty projection changes only the difficulty. The halving projection changes only the subsidy. A projection is not a forecast.</p>
        </div>
      )}
    </div>
  );
}
