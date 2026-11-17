"use client";

import { useMemo, useState } from "react";
import {
  CLN_DEFAULT_BASE_FEE_MSAT,
  CLN_DEFAULT_FEE_RATE_PPM,
  ECLAIR_DEFAULT_BASE_FEE_MSAT,
  ECLAIR_DEFAULT_FEE_RATE_PPM,
  LND_DEFAULT_BASE_FEE_MSAT,
  LND_DEFAULT_FEE_RATE_PPM,
  MAX_AMOUNT_SATS,
  MAX_BASE_FEE_MSAT,
  MAX_FEE_RATE_PPM,
  MAX_HOPS,
  COMMA_RE,
  effectivePercent,
  effectivePpm,
  formatInt,
  formatMsatAsBtc,
  formatMsatAsSats,
  hopFeeMsat,
  msatToSatsRoundUp,
  msatToUsd,
  parseUnits,
  ppmToPercent,
  routeBackwards,
  type ParseResult,
} from "@/lib/lightning-fee";

const fmtUsd = (usd: number) =>
  usd.toLocaleString("en-US", { maximumFractionDigits: usd < 1 ? 4 : 2, minimumFractionDigits: usd < 1 ? 4 : 2 });

const ZERO = BigInt(0);
const ONE = BigInt(1);

// Amounts are typed in sats with up to 3 decimals (1 msat). Base fee and fee rate are
// whole numbers, as in BOLT 7 channel_update (fee_base_msat, fee_proportional_millionths).
const DECIMALS = { amount: 3, hops: 0, base: 0, rate: 0 } as const;

const COMMA_MSG =
  "Remove the comma. The calculator does not guess whether a comma is a thousands separator or a decimal mark. Type 1000 for one thousand, or 28.5 for twenty-eight and a half.";
const BAD_AMOUNT =
  "Enter a payment amount above 0 and up to 1000000000 sats, using digits and at most one dot, with at most 3 decimals (3 decimals of a sat = 1 msat). Example 28.5.";
const BAD_BASE = "Enter a whole base fee from 0 to 10000000 msat, using digits only.";
const BAD_RATE = "Enter a whole fee rate from 0 to 1000000 ppm, using digits only.";
const BAD_HOPS = "Enter a whole number of hops from 1 to 20.";
const BAD_PPM = "Enter a whole fee rate from 0 to 1000000 ppm, using digits only.";

type Tab = "route" | "compare" | "drag";
type Field = { p: ParseResult; comma: boolean };

function amountField(raw: string): Field {
  const p = parseUnits(raw, DECIMALS.amount, MAX_AMOUNT_SATS);
  return { p: p.ok && p.value > ZERO ? p : { ok: false }, comma: COMMA_RE.test(raw) };
}
function wholeField(raw: string, max: bigint): Field {
  return { p: parseUnits(raw, 0, max), comma: COMMA_RE.test(raw) };
}
function hopsField(raw: string): Field {
  const s = raw.trim();
  if (!/^\d{1,3}$/.test(s)) return { p: { ok: false }, comma: COMMA_RE.test(raw) };
  const v = BigInt(s);
  return { p: v >= ONE && v <= MAX_HOPS ? { ok: true, value: v } : { ok: false }, comma: false };
}
const bad = (f: Field) => !f.p.ok || f.comma;
const val = (f: Field) => (f.p.ok ? f.p.value : ZERO);
const msg = (f: Field, otherwise: string) => (f.comma ? COMMA_MSG : otherwise);

const inputCls =
  "mt-2 w-full rounded-lg border border-border-subtle bg-bg-primary px-4 py-3 font-mono text-base text-text-primary outline-none transition-colors focus:border-amber";
const outCls = "mt-5 rounded-xl border border-border-subtle bg-bg-primary p-4 font-mono text-sm text-text-primary";
const presetCls =
  "rounded-lg border border-border-subtle px-3 py-1 font-mono text-sm text-text-secondary hover:border-amber focus:border-amber";

const IMPLEMENTATIONS = [
  { key: "lnd", name: "LND", settings: "bitcoin.basefee, bitcoin.feerate", base: LND_DEFAULT_BASE_FEE_MSAT, rate: LND_DEFAULT_FEE_RATE_PPM },
  { key: "cln", name: "Core Lightning", settings: "fee-base, fee-per-satoshi", base: CLN_DEFAULT_BASE_FEE_MSAT, rate: CLN_DEFAULT_FEE_RATE_PPM },
  { key: "eclair", name: "Eclair (public channels)", settings: "fee-base-msat, fee-proportional-millionths", base: ECLAIR_DEFAULT_BASE_FEE_MSAT, rate: ECLAIR_DEFAULT_FEE_RATE_PPM },
] as const;

export default function LightningFeeCalculator({ btcUsd }: { btcUsd: number }) {
  const [tab, setTab] = useState<Tab>("route");
  const [amount, setAmount] = useState("100000");
  const [hopsIn, setHopsIn] = useState("3");
  const [baseIn, setBaseIn] = useState("500");
  const [rateIn, setRateIn] = useState("100");

  const amountF = useMemo(() => amountField(amount), [amount]);
  const hopsF = useMemo(() => hopsField(hopsIn), [hopsIn]);
  const baseF = useMemo(() => wholeField(baseIn, MAX_BASE_FEE_MSAT), [baseIn]);
  const rateF = useMemo(() => wholeField(rateIn, MAX_FEE_RATE_PPM), [rateIn]);

  const setPolicy = (base: string, rate: string) => {
    setBaseIn(base); setRateIn(rate);
  };

  const routeError = bad(amountF) ? msg(amountF, BAD_AMOUNT)
    : bad(hopsF) ? msg(hopsF, BAD_HOPS)
    : bad(baseF) ? msg(baseF, BAD_BASE)
    : bad(rateF) ? msg(rateF, BAD_RATE)
    : null;

  // Backward route: the recipient receives exactly the payment amount.
  const route = useMemo(() => {
    if (routeError) return null;
    const r = routeBackwards(
      val(amountF),
      Array.from({ length: Number(val(hopsF)) }, () => ({ baseFeeMsat: val(baseF), ratePpm: val(rateF) })),
    );
    return r.ok ? r : null;
  }, [routeError, amountF, hopsF, baseF, rateF]);

  const compareError = bad(amountF) ? msg(amountF, BAD_AMOUNT) : bad(hopsF) ? msg(hopsF, BAD_HOPS) : null;
  const compare = useMemo(() => {
    if (compareError) return null;
    const amountMsat = val(amountF);
    const hops = Number(val(hopsF));
    return IMPLEMENTATIONS.map((impl) => {
      const r = routeBackwards(amountMsat, Array.from({ length: hops }, () => ({ baseFeeMsat: impl.base, ratePpm: impl.rate })));
      return { ...impl, oneHopMsat: hopFeeMsat(amountMsat, impl.base, impl.rate), routeMsat: r.ok ? r.totalFeeMsat : null };
    });
  }, [compareError, amountF, hopsF]);

  // --- Fee by route length ---
  const [dragAmount, setDragAmount] = useState("100000");
  const [dragHopsIn, setDragHopsIn] = useState("5");
  const [dragBaseIn, setDragBaseIn] = useState("500");
  const [dragRateIn, setDragRateIn] = useState("100");
  const dragAmountF = useMemo(() => amountField(dragAmount), [dragAmount]);
  const dragHopsF = useMemo(() => hopsField(dragHopsIn), [dragHopsIn]);
  const dragBaseF = useMemo(() => wholeField(dragBaseIn, MAX_BASE_FEE_MSAT), [dragBaseIn]);
  const dragRateF = useMemo(() => wholeField(dragRateIn, MAX_FEE_RATE_PPM), [dragRateIn]);
  const dragError = bad(dragAmountF) ? msg(dragAmountF, BAD_AMOUNT)
    : bad(dragHopsF) ? msg(dragHopsF, BAD_HOPS)
    : bad(dragBaseF) ? msg(dragBaseF, BAD_BASE)
    : bad(dragRateF) ? msg(dragRateF, BAD_RATE)
    : null;

  // Total route fee for k = 1..limit hops, all hops at the same base + rate.
  const dragRows = useMemo(() => {
    if (dragError) return null;
    const recipientMsat = val(dragAmountF);
    const rows: { hops: number; feeMsat: bigint }[] = [];
    for (let k = 1; k <= Number(val(dragHopsF)); k++) {
      const r = routeBackwards(recipientMsat, Array.from({ length: k }, () => ({ baseFeeMsat: val(dragBaseF), ratePpm: val(dragRateF) })));
      if (r.ok) rows.push({ hops: k, feeMsat: r.totalFeeMsat });
    }
    return { recipientMsat, rows };
  }, [dragError, dragAmountF, dragHopsF, dragBaseF, dragRateF]);

  // --- ppm to percent converter ---
  const [ppmIn, setPpmIn] = useState("1000");
  const ppmF = useMemo(() => wholeField(ppmIn, MAX_FEE_RATE_PPM), [ppmIn]);

  const tabBtn = (id: Tab, label: string) => (
    <button type="button" aria-pressed={tab === id} onClick={() => setTab(id)}
      className={`rounded-lg px-4 py-2 font-mono text-sm ${tab === id ? "bg-amber text-bg-primary" : "border border-border-subtle text-text-secondary"}`}>
      {label}
    </button>
  );

  const last = route ? route.legs[route.legs.length - 1] : null;

  return (
    <section className="mt-12 rounded-2xl border border-border-subtle bg-bg-secondary p-6" aria-labelledby="ln-fee-heading">
      <h2 id="ln-fee-heading" className="text-2xl font-semibold tracking-tight text-text-primary md:text-[2rem]">
        Calculate the routing fees
      </h2>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Calculator modes">
        {tabBtn("route", "Route cost")}
        {tabBtn("compare", "Implementation defaults")}
        {tabBtn("drag", "Fee by route length")}
      </div>

      {tab === "route" && (
        <div className="mt-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="block text-sm text-text-secondary">
              Amount the recipient must receive (sats)
              <input className={inputCls} inputMode="decimal" autoComplete="off" value={amount}
                onChange={(e) => setAmount(e.target.value)} data-testid="amount-in" aria-invalid={bad(amountF) || undefined} />
            </label>
            <label className="block text-sm text-text-secondary">
              Routing hops (intermediate nodes, 1 to 20)
              <input className={inputCls} inputMode="numeric" autoComplete="off" value={hopsIn}
                onChange={(e) => setHopsIn(e.target.value)} data-testid="hops-in" aria-invalid={bad(hopsF) || undefined} />
            </label>
            <label className="block text-sm text-text-secondary">
              Base fee per hop (fee_base_msat, in msat)
              <input className={inputCls} inputMode="numeric" autoComplete="off" value={baseIn}
                onChange={(e) => setBaseIn(e.target.value)} data-testid="base-in" aria-invalid={bad(baseF) || undefined} />
            </label>
            <label className="block text-sm text-text-secondary">
              Fee rate per hop (fee_proportional_millionths, in ppm)
              <input className={inputCls} inputMode="numeric" autoComplete="off" value={rateIn}
                onChange={(e) => setRateIn(e.target.value)} data-testid="rate-in" aria-invalid={bad(rateF) || undefined} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-text-secondary">Fee policy for every hop</span>
            <button type="button" onClick={() => setPolicy("500", "100")} className={presetCls}>Example 500 + 100</button>
            <button type="button" onClick={() => setPolicy("1000", "1")} className={presetCls}>LND default 1000 + 1</button>
            <button type="button" onClick={() => setPolicy("1000", "10")} className={presetCls}>Core Lightning default 1000 + 10</button>
            <button type="button" onClick={() => setPolicy("1000", "200")} className={presetCls}>Eclair default 1000 + 200</button>
            <button type="button" onClick={() => { setAmount("4999.999"); setHopsIn("1"); setPolicy("200", "2000"); }} className={presetCls}>BOLT 7 example</button>
          </div>
          <p aria-live="polite" className={outCls} data-testid="route-out" {...(routeError ? { role: "alert" } : {})}>
            {routeError
              ? routeError
              : route && last && (
                <>
                  Recipient receives {formatMsatAsSats(route.recipientMsat)} sats (exactly). The sender sends{" "}
                  {formatMsatAsSats(route.senderAmountMsat)} sats. Total routing fees {formatInt(route.totalFeeMsat)} msat
                  = {formatMsatAsSats(route.totalFeeMsat)} sats = {formatMsatAsBtc(route.totalFeeMsat)} BTC, about $
                  {fmtUsd(msatToUsd(route.totalFeeMsat, btcUsd))} at the stored BTC price
                  ({formatInt(msatToSatsRoundUp(route.totalFeeMsat))} sats rounded up to whole sats). Effective cost{" "}
                  {effectivePercent(route.totalFeeMsat, route.recipientMsat)}% ({effectivePpm(route.totalFeeMsat, route.recipientMsat)} ppm
                  of the amount the recipient receives) across {route.legs.length} {route.legs.length === 1 ? "hop" : "hops"}.
                  {route.legs.length === 1 ? (
                    <>
                      {" "}The hop receives {formatMsatAsSats(last.amountInMsat)} sats, keeps a fee of {formatMsatAsSats(last.feeMsat)} sats
                      and forwards {formatMsatAsSats(last.amountOutMsat)} sats.
                    </>
                  ) : (
                    <>
                      {" "}Hop 1 (closest to the sender) receives {formatMsatAsSats(route.legs[0].amountInMsat)} sats, keeps a fee of{" "}
                      {formatMsatAsSats(route.legs[0].feeMsat)} sats and forwards {formatMsatAsSats(route.legs[0].amountOutMsat)} sats.
                      The last hop (closest to the recipient) receives {formatMsatAsSats(last.amountInMsat)} sats and forwards{" "}
                      {formatMsatAsSats(last.amountOutMsat)} sats.
                    </>
                  )}
                </>
              )}
          </p>
          {route && (
            <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Per-hop route table">
              <table className="w-full min-w-[30rem] border-collapse text-left text-sm" data-testid="route-table">
                <caption className="sr-only">Amount each hop receives, keeps as its fee and forwards, in millisatoshis, from the sender side to the recipient side</caption>
                <thead>
                  <tr className="border-b border-border-subtle font-mono text-sm text-text-secondary">
                    <th scope="col" className="py-3 pr-4">Hop</th>
                    <th scope="col" className="py-3 pr-4">Receives (msat)</th>
                    <th scope="col" className="py-3 pr-4">Fee (msat)</th>
                    <th scope="col" className="py-3 pr-4">Forwards (msat)</th>
                  </tr>
                </thead>
                <tbody className="text-text-primary">
                  {route.legs.map((leg, i) => (
                    <tr key={i} className="border-b border-border-subtle">
                      <td className="py-3 pr-4 font-mono">{i + 1}</td>
                      <td className="py-3 pr-4 font-mono">{formatInt(leg.amountInMsat)}</td>
                      <td className="py-3 pr-4 font-mono">{formatInt(leg.feeMsat)}</td>
                      <td className="py-3 pr-4 font-mono">{formatInt(leg.amountOutMsat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "compare" && (
        <div className="mt-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="block text-sm text-text-secondary">
              Amount forwarded or received (sats)
              <input className={inputCls} inputMode="decimal" autoComplete="off" value={amount}
                onChange={(e) => setAmount(e.target.value)} data-testid="compare-amount-in" aria-invalid={bad(amountF) || undefined} />
            </label>
            <label className="block text-sm text-text-secondary">
              Routing hops (intermediate nodes, 1 to 20)
              <input className={inputCls} inputMode="numeric" autoComplete="off" value={hopsIn}
                onChange={(e) => setHopsIn(e.target.value)} data-testid="compare-hops-in" aria-invalid={bad(hopsF) || undefined} />
            </label>
          </div>
          {compareError && (
            <p role="alert" aria-live="polite" className={outCls} data-testid="compare-out">{compareError}</p>
          )}
          {compare && (
            <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label="Implementation default comparison table">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm" data-testid="compare-table">
                <caption className="sr-only">Default forwarding fee policy of each implementation, the fee one hop earns on the amount, and the total fee of a route where every hop uses that default</caption>
                <thead>
                  <tr className="border-b border-border-subtle font-mono text-sm text-text-secondary">
                    <th scope="col" className="py-3 pr-4">Implementation (settings)</th>
                    <th scope="col" className="py-3 pr-4">Base (msat)</th>
                    <th scope="col" className="py-3 pr-4">Rate (ppm)</th>
                    <th scope="col" className="py-3 pr-4">Rate (%)</th>
                    <th scope="col" className="py-3 pr-4">One hop earns (sats)</th>
                    <th scope="col" className="py-3 pr-4">Route of {formatInt(val(hopsF))} {val(hopsF) === ONE ? "hop" : "hops"} (sats)</th>
                  </tr>
                </thead>
                <tbody className="text-text-primary">
                  {compare.map((row) => (
                    <tr key={row.key} className="border-b border-border-subtle">
                      <td className="py-3 pr-4">{row.name} <span className="font-mono text-xs text-text-tertiary">({row.settings})</span></td>
                      <td className="py-3 pr-4 font-mono">{formatInt(row.base)}</td>
                      <td className="py-3 pr-4 font-mono">{formatInt(row.rate)}</td>
                      <td className="py-3 pr-4 font-mono">{ppmToPercent(row.rate)}%</td>
                      <td className="py-3 pr-4 font-mono" data-testid={`${row.key}-hop-out`}>{formatMsatAsSats(row.oneHopMsat)}</td>
                      <td className="py-3 pr-4 font-mono" data-testid={`${row.key}-out`}>{row.routeMsat === null ? "n/a" : formatMsatAsSats(row.routeMsat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-sm leading-relaxed text-text-secondary">
            One hop earns its fee on the amount it forwards. The route column applies the same default to every hop and
            walks backward from the amount the recipient receives. These are shipped defaults only. Each node operator sets
            its own fees, and a real route costs what the channel_update of each hop says.
          </p>
        </div>
      )}

      {tab === "drag" && (
        <div className="mt-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="block text-sm text-text-secondary">
              Amount the recipient must receive (sats)
              <input className={inputCls} inputMode="decimal" autoComplete="off" value={dragAmount}
                onChange={(e) => setDragAmount(e.target.value)} data-testid="drag-amount-in" aria-invalid={bad(dragAmountF) || undefined} />
            </label>
            <label className="block text-sm text-text-secondary">
              Longest route to show (hops, 1 to 20)
              <input className={inputCls} inputMode="numeric" autoComplete="off" value={dragHopsIn}
                onChange={(e) => setDragHopsIn(e.target.value)} data-testid="drag-hops-in" aria-invalid={bad(dragHopsF) || undefined} />
            </label>
            <label className="block text-sm text-text-secondary">
              Base fee per hop (msat)
              <input className={inputCls} inputMode="numeric" autoComplete="off" value={dragBaseIn}
                onChange={(e) => setDragBaseIn(e.target.value)} data-testid="drag-base-in" aria-invalid={bad(dragBaseF) || undefined} />
            </label>
            <label className="block text-sm text-text-secondary">
              Fee rate per hop (ppm)
              <input className={inputCls} inputMode="numeric" autoComplete="off" value={dragRateIn}
                onChange={(e) => setDragRateIn(e.target.value)} data-testid="drag-rate-in" aria-invalid={bad(dragRateF) || undefined} />
            </label>
          </div>
          {dragError && (
            <p role="alert" aria-live="polite" className={outCls} data-testid="drag-out">{dragError}</p>
          )}
          {dragRows && (
            <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label="Fee by route length table">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm" data-testid="drag-table">
                <caption className="sr-only">Total routing fee as the route grows from 1 hop to the chosen length, every hop at the same fee policy</caption>
                <thead>
                  <tr className="border-b border-border-subtle font-mono text-sm text-text-secondary">
                    <th scope="col" className="py-3 pr-4">Hops</th>
                    <th scope="col" className="py-3 pr-4">Total fee (msat)</th>
                    <th scope="col" className="py-3 pr-4">Total fee (sats)</th>
                    <th scope="col" className="py-3 pr-4">% of amount received</th>
                    <th scope="col" className="py-3 pr-4">Effective ppm</th>
                  </tr>
                </thead>
                <tbody className="text-text-primary">
                  {dragRows.rows.map((row) => (
                    <tr key={row.hops} className="border-b border-border-subtle">
                      <td className="py-3 pr-4 font-mono">{row.hops}</td>
                      <td className="py-3 pr-4 font-mono">{formatInt(row.feeMsat)}</td>
                      <td className="py-3 pr-4 font-mono">{formatMsatAsSats(row.feeMsat)}</td>
                      <td className="py-3 pr-4 font-mono">{effectivePercent(row.feeMsat, dragRows.recipientMsat)}%</td>
                      <td className="py-3 pr-4 font-mono">{effectivePpm(row.feeMsat, dragRows.recipientMsat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 border-t border-border-subtle pt-6">
        <h3 className="text-lg font-semibold text-text-primary">Convert ppm to percent</h3>
        <label className="mt-3 block text-sm text-text-secondary">
          Fee rate (ppm, millionths of the amount)
          <input className={inputCls} inputMode="numeric" autoComplete="off" value={ppmIn}
            onChange={(e) => setPpmIn(e.target.value)} data-testid="ppm-in" aria-invalid={bad(ppmF) || undefined} />
        </label>
        <p aria-live="polite" className={outCls} data-testid="ppm-out" {...(bad(ppmF) ? { role: "alert" } : {})}>
          {bad(ppmF)
            ? msg(ppmF, BAD_PPM)
            : `${val(ppmF).toString()} ppm = ${ppmToPercent(val(ppmF))}% of the amount forwarded (1,000,000 ppm = 100%).`}
        </p>
      </div>
    </section>
  );
}
