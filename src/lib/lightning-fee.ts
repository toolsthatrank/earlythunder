// Lightning Network routing fee math per BOLT 7 (07-routing-gossip.md, HTLC Fees):
// fee = fee_base_msat + floor(amount_to_forward * fee_proportional_millionths / 1000000).
// Fees are computed backward from the amount the recipient must receive. Each hop charges
// on the amount it forwards, and that amount already includes the fees of all later hops.
// All fee arithmetic runs in BigInt millisatoshi, so large amounts and long routes never
// lose a millisatoshi to float rounding. BigInt() constructor calls are used throughout
// (the repo targets ES2017, so BigInt literals are unavailable).

export const MSAT_PER_SAT = BigInt(1000);
export const SAT_PER_BTC = BigInt(100000000); // Bitcoin Core amount.h: COIN{100'000'000}
export const MSAT_PER_BTC = SAT_PER_BTC * MSAT_PER_SAT;
const MILLION = BigInt(1000000);
const ZERO = BigInt(0);

// LND sample-lnd.conf: "; bitcoin.basefee=1000" (msat) and "; bitcoin.feerate=1" (ppm).
export const LND_DEFAULT_BASE_FEE_MSAT = BigInt(1000);
export const LND_DEFAULT_FEE_RATE_PPM = BigInt(1);
// Core Lightning lightningd-config.5.md: fee-base "Default: 1000", fee-per-satoshi "Default: 10".
export const CLN_DEFAULT_BASE_FEE_MSAT = BigInt(1000);
export const CLN_DEFAULT_FEE_RATE_PPM = BigInt(10);
// Eclair reference.conf, relay.fees.public-channels: fee-base-msat = 1000, fee-proportional-millionths = 200.
export const ECLAIR_DEFAULT_BASE_FEE_MSAT = BigInt(1000);
export const ECLAIR_DEFAULT_FEE_RATE_PPM = BigInt(200);

// Input bounds of this calculator (not protocol limits).
export const MAX_AMOUNT_SATS = BigInt(1000000000); // 1 billion sats = 10 BTC
export const MAX_HOPS = BigInt(20);
export const MAX_BASE_FEE_MSAT = BigInt(10000000); // 10,000 sats base fee per hop
export const MAX_FEE_RATE_PPM = BigInt(1000000); // 1,000,000 ppm = 100%

export type ParseResult = { ok: true; value: bigint } | { ok: false };

// Parse a decimal string into integer units at `decimals` places (0 = whole units),
// capped at `max` whole units. Accepts ASCII digits and at most one dot. No sign, no
// exponent, no comma. The caller reports a comma with its own message (COMMA_RE).
export const COMMA_RE = /,/;
export function parseUnits(raw: string, decimals: number, max: bigint): ParseResult {
  if (typeof raw !== "string") return { ok: false };
  const s = raw.trim();
  if (s.length === 0 || s.length > 17) return { ok: false };
  if (COMMA_RE.test(s)) return { ok: false };
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false };
  const [intPart, fracPart = ""] = s.split(".");
  if (intPart.length > 12) return { ok: false };
  if (fracPart.length > decimals) return { ok: false };
  const scale = BigInt(10) ** BigInt(decimals);
  const value = BigInt(intPart) * scale + BigInt((fracPart + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (value > max * scale) return { ok: false };
  return { ok: true, value };
}

// BOLT 7: fee = fee_base_msat + floor(amount_to_forward * fee_proportional_millionths / 1000000).
export function hopFeeMsat(amountToForwardMsat: bigint, baseFeeMsat: bigint, ratePpm: bigint): bigint {
  return baseFeeMsat + (amountToForwardMsat * ratePpm) / MILLION;
}

// One intermediate node of the route. It receives amountInMsat, keeps feeMsat and
// forwards amountOutMsat (amountInMsat = amountOutMsat + feeMsat).
export type RouteLeg = { amountInMsat: bigint; feeMsat: bigint; amountOutMsat: bigint };
export type RouteResult =
  | { ok: true; legs: RouteLeg[]; recipientMsat: bigint; senderAmountMsat: bigint; totalFeeMsat: bigint }
  | { ok: false; reason: string };

// Walk the route backward from the amount the recipient must receive. legs[0] is the
// hop closest to the sender, the last leg is the hop closest to the recipient.
export function routeBackwards(recipientMsat: bigint, hops: { baseFeeMsat: bigint; ratePpm: bigint }[]): RouteResult {
  if (recipientMsat <= ZERO) return { ok: false, reason: "Amount must be above zero." };
  if (hops.length === 0) return { ok: false, reason: "A route needs at least one hop." };
  if (hops.length > Number(MAX_HOPS)) return { ok: false, reason: "At most 20 hops." };
  let amountMsat = recipientMsat;
  const legs: RouteLeg[] = [];
  for (let i = hops.length - 1; i >= 0; i--) {
    const amountOutMsat = amountMsat;
    const feeMsat = hopFeeMsat(amountOutMsat, hops[i].baseFeeMsat, hops[i].ratePpm);
    amountMsat = amountOutMsat + feeMsat;
    legs.unshift({ amountInMsat: amountMsat, feeMsat, amountOutMsat });
  }
  return { ok: true, legs, recipientMsat, senderAmountMsat: amountMsat, totalFeeMsat: amountMsat - recipientMsat };
}

export function msatToSatsRoundUp(msat: bigint): bigint {
  return (msat + BigInt(999)) / MSAT_PER_SAT;
}

// ---------- Exact display helpers (BigInt in, string out) ----------

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Integer with thousands separators, for example 100031503 -> "100,031,503".
export function formatInt(n: bigint): string {
  const neg = n < ZERO;
  return (neg ? "-" : "") + group((neg ? -n : n).toString());
}

// A scaled integer as a fixed decimal, for example (31503, 3) -> "31.503".
export function formatScaled(n: bigint, decimals: number, grouping = true): string {
  const neg = n < ZERO;
  const abs = neg ? -n : n;
  const scale = BigInt(10) ** BigInt(decimals);
  const intPart = (abs / scale).toString();
  const frac = decimals > 0 ? "." + (abs % scale).toString().padStart(decimals, "0") : "";
  return (neg ? "-" : "") + (grouping ? group(intPart) : intPart) + frac;
}

// msat as sats with all 3 decimals, for example 100031503 -> "100,031.503".
export function formatMsatAsSats(msat: bigint): string {
  return formatScaled(msat, 3);
}

// msat as BTC with all 11 decimals, for example 31503 -> "0.00000031503".
export function formatMsatAsBtc(msat: bigint): string {
  return formatScaled(msat, 11);
}

// round(num * 10^decimals / den), half up, for non-negative num and positive den.
export function ratioScaled(num: bigint, den: bigint, decimals: number): bigint {
  const scale = BigInt(10) ** BigInt(decimals);
  return (num * scale * BigInt(2) + den) / (den * BigInt(2));
}

// Fee as parts per million of the amount the recipient receives, 2 decimals: "315.03".
export function effectivePpm(totalFeeMsat: bigint, recipientMsat: bigint): string {
  return formatScaled(ratioScaled(totalFeeMsat * MILLION, recipientMsat, 2), 2);
}

// Fee as percent of the amount the recipient receives, 4 decimals: "0.0315".
export function effectivePercent(totalFeeMsat: bigint, recipientMsat: bigint): string {
  return formatScaled(ratioScaled(totalFeeMsat * BigInt(100), recipientMsat, 4), 4);
}

// Exact percent of a ppm rate, trailing zeros removed: 1000 -> "0.1", 1 -> "0.0001", 1000000 -> "100".
export function ppmToPercent(ppm: bigint): string {
  const s = formatScaled(ppm, 4, true);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

// USD value of an msat amount at a stored BTC/USD rate (a float, for display only).
export function msatToUsd(msat: bigint, btcUsd: number): number {
  return (Number(msat) / Number(MSAT_PER_BTC)) * btcUsd;
}

export function satsToUsd(sats: bigint, btcUsd: number): number {
  return (Number(sats) / Number(SAT_PER_BTC)) * btcUsd;
}
