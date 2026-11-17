// CPFP and RBF fee bumping math, with the package feerate of
// doc/policy/packages.md and the Bitcoin Core v32.1 replacement rules 3 and 4.
// All arithmetic runs in integer satoshi/vbyte, so a big mempool package never loses
// a satoshi to float rounding.

export const MAX_VBYTES_PER_TX = BigInt(1000000);
const BIG = (n: number) => BigInt(n);
// Bitcoin Core v32.1 MAX_PACKAGE_COUNT{25} (policy/packages.h). Not used by the calculator.
export const MAX_PACKAGE_TXS = BigInt(25);
// Bitcoin Core v32.1 DEFAULT_CLUSTER_SIZE_LIMIT_KVB (policy.h), in kilovbytes. Not used by the calculator.
export const MAX_PACKAGE_KVBYTES = BigInt(101);
// Bitcoin Core v32.1 rule 5: at most 100 distinct conflicting clusters
// (policy/rbf.h, MAX_REPLACEMENT_CANDIDATES{100}).
export const MAX_REPLACEMENT_CANDIDATES = BigInt(100);

// Bitcoin Core v32.1 rules 3 and 4 (policy/rbf.cpp PaysForRBF): a replacement pays at least
// the fees of all transactions it replaces, and the additional fee pays at least the
// incremental relay feerate (policy/policy.h DEFAULT_INCREMENTAL_RELAY_FEE = 100 sat/kvB = 0.1 sat/vB).
export const DEFAULT_INCREMENTAL_RELAY_FEE_SAT_PER_KVB = BIG(100);

export type ParseResult = { ok: true; value: bigint } | { ok: false };

// Parse a non-negative decimal string of at most `decimals` fractional places into
// integer units at that precision, capped at `max` whole units. No sign, no exponent,
// no comma. Mirrors parseUnits() in lightning-fee.ts.
export function parseUnits(raw: string, decimals: number, max: bigint): ParseResult {
  if (typeof raw !== "string") return { ok: false };
  const s = raw.trim();
  if (s.length === 0 || s.length > 17) return { ok: false };
  if (/,/.test(s)) return { ok: false };
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false };
  const [intPart, fracPart = ""] = s.split(".");
  if (intPart.length > 12) return { ok: false };
  if (fracPart.length > decimals) return { ok: false };
  const scale = BigInt(10) ** BigInt(decimals);
  const value =
    BigInt(intPart) * scale + BigInt((fracPart + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (value > max * scale) return { ok: false };
  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// CPFP, child-pays-for-parent
// ---------------------------------------------------------------------------

// Package feerate of one parent and one child, in sat/vB x 1000 (floored).
// If a parent pays parentFeeSat for parentVb, a child of childFeeSat over childVb can
// lift the parent only if the combined package feerate reaches the target:
//   packageFeerate = (parentFeeSat + childFeeSat) / (parentVb + childVb)
export function packageFeerate(
  parentFeeSat: bigint,
  parentVb: bigint,
  childFeeSat: bigint,
  childVb: bigint,
): bigint | null {
  if (parentVb <= BIG(0) || childVb <= BIG(0)) return null;
  return ((parentFeeSat + childFeeSat) * BIG(1000)) / (parentVb + childVb);
}

// Minimum child fee (sat) so the package feerate reaches `targetRateSatPerVb`
// (scaled by 1000). Returns null when the parent alone already clears the target.
export function minChildFeeSat(
  parentFeeSat: bigint,
  parentVb: bigint,
  childVb: bigint,
  targetRateMilli: bigint,
): bigint | null {
  if (parentVb <= BIG(0) || childVb <= BIG(0)) return null;
  // A miner takes the parent alone when its own feerate already reaches the target.
  if (parentFeeSat * BIG(1000) >= targetRateMilli * parentVb) return null;
  const needed = targetRateMilli * (parentVb + childVb) - parentFeeSat * BIG(1000);
  if (needed <= BIG(0)) return null;
  // Ceiling division: pay a hair more, never a hair less.
  return (needed + BIG(999)) / BIG(1000);
}

// The feerate the child itself ends up paying (childFeeSat / childVb, milli-precision).
export function childOwnFeerate(childFeeSat: bigint, childVb: bigint): bigint | null {
  if (childVb <= BIG(0)) return null;
  return (childFeeSat * BIG(1000)) / childVb;
}

// True when the package feerate reaches the target.
export function cpfpViable(
  parentFeeSat: bigint,
  parentVb: bigint,
  childFeeSat: bigint,
  childVb: bigint,
  targetRateMilli: bigint,
): boolean {
  const pkg = packageFeerate(parentFeeSat, parentVb, childFeeSat, childVb);
  if (pkg === null) return false;
  return pkg >= targetRateMilli;
}

// ---------------------------------------------------------------------------
// RBF, replace-by-fee per Bitcoin Core v32.1 rules 3 and 4
// ---------------------------------------------------------------------------

export type RbfCheck = {
  ok: boolean;
  code:
    | "OK"
    | "NOT_IN_MEMPOOL"
    | "CONFLICTS_CONFIRMED"
    | "TOO_MANY_REPLACEMENTS"
    | "INSUFFICIENT_FEE";
  detail: string;
};

// Feerate of one transaction, in sat/vB x 1000 (floored).
export function feerateMilli(feeSat: bigint, vb: bigint): bigint | null {
  if (vb <= BIG(0)) return null;
  return (feeSat * BIG(1000)) / vb;
}

// Bitcoin Core v32.1 replacement evaluation (policy/rbf.cpp). Signaling
// is no longer required (full RBF is the default policy). This function checks:
//   - the original must be in the mempool,
//   - rule 5 as a count cap of 100 (v32.1 counts distinct clusters),
//   - rule 3: pay at least the replaced fees,
//   - rule 4: the additional fee pays the incremental relay fee on the replacement size.
// originals: what the mempool already holds for this conflict set.
//   replacedCount: number of conflicting clusters (the calculator passes 1)
//   replacedFeeSat, replacedVb: aggregate fee/size of everything being evicted
// newFeeSat, newVb: the proposed replacement.
// newAddsInputs: true when the replacement spends inputs not in the original set.
export function evaluateRbf(params: {
  replacedCount: bigint;
  replacedFeeSat: bigint;
  replacedVb: bigint;
  newFeeSat: bigint;
  newVb: bigint;
  newAddsInputs: boolean;
  incrementalRelaySatPerKvb?: bigint;
}): RbfCheck {
  // 0.1 sat/vB = 100 sat/kvB, the Bitcoin Core v32.1 default incremental relay feerate.
  const incKvb = params.incrementalRelaySatPerKvb ?? DEFAULT_INCREMENTAL_RELAY_FEE_SAT_PER_KVB;
  // Bitcoin Core v32.1: opt-in signaling is no longer required (mempoolfullrbf became
  // the default in v28.0). Rules 1 and 2 are removed in v32.1.
  if (params.replacedCount <= BIG(0)) {
    return { ok: false, code: "NOT_IN_MEMPOOL", detail: "Nothing to replace: the original is not in the mempool." };
  }
  if (params.replacedCount > MAX_REPLACEMENT_CANDIDATES) {
    return { ok: false, code: "TOO_MANY_REPLACEMENTS", detail: `More than ${MAX_REPLACEMENT_CANDIDATES} conflicting clusters, above the v32.1 rule 5 limit.` };
  }
  // Rule 3: pay at least all replaced fees. Rule 4: the additional fee pays the
  // incremental relay fee on the whole replacement size.
  const minFee = params.replacedFeeSat + (incKvb * params.newVb + BIG(999)) / BIG(1000); // GetFee rounds up
  if (params.newFeeSat < params.replacedFeeSat) {
    return { ok: false, code: "INSUFFICIENT_FEE", detail: `Replacement pays ${params.newFeeSat} sat, less than the replaced fees (${params.replacedFeeSat} sat). Rule 3.` };
  }
  if (params.newFeeSat < minFee) {
    return { ok: false, code: "INSUFFICIENT_FEE", detail: `Replacement pays ${params.newFeeSat} sat, below the incremental-relay floor of ${minFee} sat.` };
  }
  return { ok: true, code: "OK", detail: "Replacement passes rules 3 and 4 of the Bitcoin Core v32.1 replacement policy. The calculator does not check rules 5 and 6." };
}

// BTC price, a dated constant (CSP blocks a live fetch). Source https://mempool.space/api/v1/prices
export const BTC_USD = 64905;
export const BTC_PRICE_TIME = "2026-11-17T13:45:05Z";

// Minimum replacement fee (sat): the larger of rules 3 and 4 (original fee + ceil(incremental
// sat/kvB x vsize / 1000)) and the target feerate (ceil(target sat/kvB x vsize / 1000)).
export function minReplacementFeeSat(
  originalFeeSat: bigint,
  replacementVb: bigint,
  targetRateMilli: bigint,
  incrementalRelaySatPerKvb: bigint = DEFAULT_INCREMENTAL_RELAY_FEE_SAT_PER_KVB,
): { feeSat: bigint; by: "rules 3 and 4" | "target feerate" } | null {
  if (replacementVb <= BIG(0) || originalFeeSat < BIG(0)) return null;
  const byRules = originalFeeSat + (incrementalRelaySatPerKvb * replacementVb + BIG(999)) / BIG(1000);
  const byTarget = (targetRateMilli * replacementVb + BIG(999)) / BIG(1000);
  return byTarget >= byRules ? { feeSat: byTarget, by: "target feerate" } : { feeSat: byRules, by: "rules 3 and 4" };
}
