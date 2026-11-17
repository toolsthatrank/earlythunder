"use client";

import { useMemo, useState } from "react";
import {
  MAX_REPLACEMENT_CANDIDATES,
  BTC_PRICE_TIME,
  BTC_USD,
  cpfpViable,
  childOwnFeerate,
  evaluateRbf,
  minChildFeeSat,
  minReplacementFeeSat,
  packageFeerate,
  parseUnits,
  feerateMilli,
} from "@/lib/fee-bump";

const ZERO = BigInt(0);
const COMMA_RE = /,/;

const COMMA_MSG =
  "Remove the comma. The calculator does not guess whether a comma is a thousands separator or a decimal mark. Type 140 for one hundred forty.";
const BAD_SAT = "Enter a whole fee in satoshis from 0 to 100000000, digits only. Example 200.";
const BAD_VB = "Enter a size in virtual bytes as a whole number from 1 to 1000000. Example 141.";
const BAD_RATE = "Enter a target feerate in sat/vB with at most 3 decimals, from 0.001 to 10000. Example 10.";

type ParseResult = { ok: true; value: bigint } | { ok: false };
type Field = { p: ParseResult; comma: boolean };

function satField(raw: string): Field {
  const p = parseUnits(raw, 0, BigInt(100000000));
  return { p, comma: COMMA_RE.test(raw) };
}
function vbField(raw: string): Field {
  const p = parseUnits(raw, 0, BigInt(1000000));
  return { p: p.ok && p.value > ZERO ? p : { ok: false }, comma: COMMA_RE.test(raw) };
}
function rateField(raw: string): Field {
  const p = parseUnits(raw, 3, BigInt(10000));
  return { p: p.ok && p.value > ZERO ? p : { ok: false }, comma: COMMA_RE.test(raw) };
}
const bad = (f: Field) => !f.p.ok || f.comma;
const val = (f: Field) => (f.p.ok ? f.p.value : ZERO);
const msg = (f: Field, otherwise: string) => (f.comma ? COMMA_MSG : otherwise);

const inputCls =
  "mt-2 w-full rounded-lg border border-border-subtle bg-bg-primary px-4 py-3 font-mono text-base text-text-primary outline-none transition-colors focus:border-amber";
const outCls = "mt-5 rounded-xl border border-border-subtle bg-bg-primary p-4 font-mono text-sm text-text-primary";
const labelCls = "block text-sm font-medium text-text-secondary";
const btc = (s: bigint) => `${s / BigInt(100000000)}.${(s % BigInt(100000000)).toString().padStart(8, "0")}`;
const usd = (s: bigint) => ((Number(s) * BTC_USD) / 1e8).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: bigint) => n.toLocaleString("en-US");
// milli-sat/vB to "d.ddd" sat/vB, exact, no float.
const rate = (m: bigint) => `${(m / BigInt(1000)).toLocaleString("en-US")}.${(m % BigInt(1000)).toString().padStart(3, "0")}`;

type Tab = "cpfp" | "rbf";

export default function CpfpRbfCalculator() {
  const [tab, setTab] = useState<Tab>("cpfp");

  // CPFP inputs
  const [parentFee, setParentFee] = useState("200");
  const [parentVb, setParentVb] = useState("140");
  const [childVb, setChildVb] = useState("140");
  const [targetRate, setTargetRate] = useState("10");

  // RBF inputs
  const [rbfFee, setRbfFee] = useState("3000");
  const [rbfVb, setRbfVb] = useState("141");
  const [oldFee, setOldFee] = useState("1000");
  const [oldVb, setOldVb] = useState("141");

  const parentFeeF = useMemo(() => satField(parentFee), [parentFee]);
  const parentVbF = useMemo(() => vbField(parentVb), [parentVb]);
  const childVbF = useMemo(() => vbField(childVb), [childVb]);
  const targetF = useMemo(() => rateField(targetRate), [targetRate]);

  const rbfFeeF = useMemo(() => satField(rbfFee), [rbfFee]);
  const rbfVbF = useMemo(() => vbField(rbfVb), [rbfVb]);
  const oldFeeF = useMemo(() => satField(oldFee), [oldFee]);
  const oldVbF = useMemo(() => vbField(oldVb), [oldVb]);

  const cpfpError =
    bad(parentFeeF) ? msg(parentFeeF, BAD_SAT)
    : bad(parentVbF) ? msg(parentVbF, BAD_VB)
    : bad(childVbF) ? msg(childVbF, BAD_VB)
    : bad(targetF) ? msg(targetF, BAD_RATE)
    : null;

  const rbfError =
    bad(rbfFeeF) ? msg(rbfFeeF, BAD_SAT)
    : bad(rbfVbF) ? msg(rbfVbF, BAD_VB)
    : bad(oldFeeF) ? msg(oldFeeF, BAD_SAT)
    : bad(oldVbF) ? msg(oldVbF, BAD_VB)
    : null;

  let cpfpOut: { targetRate: bigint; pkgRate: bigint | null; minChild: bigint | null; childRate: bigint | null; viable: boolean } | null = null;
  if (!cpfpError) {
    const pf = val(parentFeeF), pvb = val(parentVbF), cvb = val(childVbF), tr = val(targetF);
    // The calculator derives the minimum child fee, then reports the package at that fee.
    const minChild = minChildFeeSat(pf, pvb, cvb, tr);
    const childFee = minChild ?? ZERO;
    cpfpOut = {
      targetRate: tr,
      pkgRate: packageFeerate(pf, pvb, childFee, cvb),
      minChild,
      childRate: childOwnFeerate(childFee, cvb),
      viable: cpfpViable(pf, pvb, childFee, cvb, tr),
    };
  }

  let rbfOut: ReturnType<typeof evaluateRbf> | null = null;
  if (!rbfError) {
    rbfOut = evaluateRbf({
      replacedCount: BigInt(1),
      replacedFeeSat: val(oldFeeF),
      replacedVb: val(oldVbF),
      newFeeSat: val(rbfFeeF),
      newVb: val(rbfVbF),
      newAddsInputs: false,
    });
  }

  return (
    <div>
      <div className="flex gap-2" role="tablist" aria-label="Bump method">
        {(["cpfp", "rbf"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={
              "rounded-lg px-4 py-2 font-mono text-sm transition-colors " +
              (tab === t
                ? "border border-amber bg-bg-primary text-text-primary"
                : "border border-border-subtle text-text-secondary hover:border-amber")
            }
          >
            {t === "cpfp" ? "CPFP (child pays for parent)" : "RBF (replace-by-fee)"}
          </button>
        ))}
      </div>

      {tab === "cpfp" && (
        <div className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="cpfp-parent-fee">Parent fee (satoshis)</label>
              <input id="cpfp-parent-fee" className={inputCls} inputMode="numeric" value={parentFee}
                onChange={(e) => setParentFee(e.target.value)} placeholder="200" />
            </div>
            <div>
              <label className={labelCls} htmlFor="cpfp-parent-vb">Parent size (vbytes)</label>
              <input id="cpfp-parent-vb" className={inputCls} inputMode="decimal" value={parentVb}
                onChange={(e) => setParentVb(e.target.value)} placeholder="140" />
            </div>
            <div>
              <label className={labelCls} htmlFor="cpfp-child-vb">Child size (vbytes)</label>
              <input id="cpfp-child-vb" className={inputCls} inputMode="decimal" value={childVb}
                onChange={(e) => setChildVb(e.target.value)} placeholder="140" />
            </div>
            <div>
              <label className={labelCls} htmlFor="cpfp-target">Target feerate (sat/vB)</label>
              <input id="cpfp-target" className={inputCls} inputMode="decimal" value={targetRate}
                onChange={(e) => setTargetRate(e.target.value)} placeholder="10" />
            </div>
          </div>

          {cpfpError && <p className="mt-4 text-sm text-red-500" role="alert">{cpfpError}</p>}

          {cpfpOut && (
            <div className={outCls} aria-live="polite">
              {cpfpOut.minChild === null ? (
                <p>Parent already clears {rate(cpfpOut.targetRate)} sat/vB on its own. No child is needed.</p>
              ) : (
                <>
                  <p>Minimum child fee to lift the package to {rate(cpfpOut.targetRate)} sat/vB: <strong>{num(cpfpOut.minChild)} sat</strong></p>
                  <p className="mt-2">Package feerate at that fee: {cpfpOut.pkgRate === null ? "n/a" : `${rate(cpfpOut.pkgRate)} sat/vB`}</p>
                  <p className="mt-2">Child&apos;s own feerate: {cpfpOut.childRate === null ? "n/a" : `${rate(cpfpOut.childRate)} sat/vB`}</p>
                  <p className="mt-2">{cpfpOut.viable ? "The bump is viable: a miner including the package earns the target feerate or better." : "Not viable at this fee. The package feerate is below the target."}</p>
                  {(() => {
                    const r = minReplacementFeeSat(val(parentFeeF), val(parentVbF), cpfpOut.targetRate);
                    if (r === null || cpfpOut.minChild === null) return null;
                    const rbfExtra = r.feeSat - val(parentFeeF);
                    return (
                      <p className="mt-2">
                        Extra fee by CPFP: {num(cpfpOut.minChild)} sat ({btc(cpfpOut.minChild)} BTC, {usd(cpfpOut.minChild)} USD).
                        Extra fee by RBF of the same transaction at the same size: {num(rbfExtra)} sat ({btc(rbfExtra)} BTC, {usd(rbfExtra)} USD).
                        USD at {BTC_USD.toLocaleString("en-US")} USD per BTC, mempool.space, {BTC_PRICE_TIME} UTC.
                      </p>
                    );
                  })()}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "rbf" && (
        <div className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="rbf-new-fee">Replacement fee (satoshis)</label>
              <input id="rbf-new-fee" className={inputCls} inputMode="numeric" value={rbfFee}
                onChange={(e) => setRbfFee(e.target.value)} placeholder="3000" />
            </div>
            <div>
              <label className={labelCls} htmlFor="rbf-new-vb">Replacement size (vbytes)</label>
              <input id="rbf-new-vb" className={inputCls} inputMode="decimal" value={rbfVb}
                onChange={(e) => setRbfVb(e.target.value)} placeholder="141" />
            </div>
            <div>
              <label className={labelCls} htmlFor="rbf-old-fee">Replaced fee, all evicted txs (satoshis)</label>
              <input id="rbf-old-fee" className={inputCls} inputMode="numeric" value={oldFee}
                onChange={(e) => setOldFee(e.target.value)} placeholder="1000" />
            </div>
            <div>
              <label className={labelCls} htmlFor="rbf-old-vb">Replaced size, all evicted txs (vbytes)</label>
              <input id="rbf-old-vb" className={inputCls} inputMode="decimal" value={oldVb}
                onChange={(e) => setOldVb(e.target.value)} placeholder="141" />
            </div>
            <div>
              <label className={labelCls} htmlFor="rbf-target">Target feerate (sat/vB)</label>
              <input id="rbf-target" className={inputCls} inputMode="decimal" value={targetRate}
                onChange={(e) => setTargetRate(e.target.value)} placeholder="10" />
            </div>
          </div>

          {rbfError && <p className="mt-4 text-sm text-red-500" role="alert">{rbfError}</p>}
          {!rbfError && bad(targetF) && <p className="mt-4 text-sm text-red-500" role="alert">{msg(targetF, BAD_RATE)}</p>}
          {!rbfError && !bad(targetF) && (() => {
            const m = minReplacementFeeSat(val(oldFeeF), val(rbfVbF), val(targetF));
            return m === null ? null : (
              <p className="mt-4 font-mono text-sm text-text-primary">
                Minimum replacement fee at {rate(val(targetF))} sat/vB: <strong>{num(m.feeSat)} sat</strong>, set by {m.by === "target feerate" ? "the target feerate" : "rules 3 and 4"}.
              </p>
            );
          })()}

          {rbfOut && (
            <div className={outCls} aria-live="polite">
              <p className={rbfOut.ok ? "text-green-600" : "text-red-500"}>
                {rbfOut.ok ? "Passes rules 3 and 4" : "Fails rule 3 or 4"} ({rbfOut.code})
              </p>
              <p className="mt-2">{rbfOut.detail}</p>
              {(() => {
                const oldRate = feerateMilli(val(oldFeeF), val(oldVbF));
                const newRate = feerateMilli(val(rbfFeeF), val(rbfVbF));
                if (oldRate === null || newRate === null) return null;
                const lower = val(rbfFeeF) * val(oldVbF) < val(oldFeeF) * val(rbfVbF);
                return (
                  <p className="mt-2">
                    Feerate of the replaced transactions: {rate(oldRate)} sat/vB. Feerate of the replacement: {rate(newRate)} sat/vB.
                    {lower ? " The replacement has the lower feerate, so it can fail rule 6." : ""}
                  </p>
                );
              })()}
              <p className="mt-2">
                Incremental relay fee applied: 0.1 sat/vB (100 sat/kvB, Bitcoin Core v32.1 default), rounded up to a
                whole satoshi, on the whole replacement size. The calculator checks rules 3 and 4 only. It does not
                check rule 5 (at most {num(MAX_REPLACEMENT_CANDIDATES)} conflicting clusters) or rule 6 (feerate diagram).
                A replacement with a lower feerate than the original can fail rule 6.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
