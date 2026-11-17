import assert from "node:assert/strict";
import test from "node:test";
import {
  CLN_DEFAULT_BASE_FEE_MSAT,
  CLN_DEFAULT_FEE_RATE_PPM,
  ECLAIR_DEFAULT_BASE_FEE_MSAT,
  ECLAIR_DEFAULT_FEE_RATE_PPM,
  LND_DEFAULT_BASE_FEE_MSAT,
  LND_DEFAULT_FEE_RATE_PPM,
  MAX_AMOUNT_SATS,
  MAX_HOPS,
  effectivePercent,
  effectivePpm,
  formatInt,
  formatMsatAsBtc,
  formatMsatAsSats,
  hopFeeMsat,
  msatToSatsRoundUp,
  msatToUsd,
  ppmToPercent,
  parseUnits,
  routeBackwards,
  satsToUsd,
} from "../src/lib/lightning-fee";

const B = (n: number) => BigInt(n);

test("constants: implementation defaults from the shipped config files", () => {
  // sample-lnd.conf line 729/734: bitcoin.basefee=1000, bitcoin.feerate=1
  assert.equal(LND_DEFAULT_BASE_FEE_MSAT, B(1000));
  assert.equal(LND_DEFAULT_FEE_RATE_PPM, B(1));
  // lightningd-config(5): fee-base 1000, fee-per-satoshi 10
  assert.equal(CLN_DEFAULT_BASE_FEE_MSAT, B(1000));
  assert.equal(CLN_DEFAULT_FEE_RATE_PPM, B(10));
  // Eclair reference.conf line 248/249: 1000, 200
  assert.equal(ECLAIR_DEFAULT_BASE_FEE_MSAT, B(1000));
  assert.equal(ECLAIR_DEFAULT_FEE_RATE_PPM, B(200));
  assert.equal(MAX_HOPS, B(20));
});

test("hopFeeMsat: BOLT 7 formula with FLOOR on the proportional part", () => {
  // BOLT 7 line 1034: fee_base_msat + (amount_to_forward * fee_proportional_millionths / 1000000)
  // floor(1,000,000 msat * 333 ppm / 1e6) = floor(333,000) = 333; + 500 base = 833
  assert.equal(hopFeeMsat(B(1000000), B(500), B(333)), B(833));
  // Truncation case: 1,234,567 * 100 / 1e6 = 123.4567 -> floor 123
  assert.equal(hopFeeMsat(B(1234567), B(0), B(100)), B(123));
  // Zero rate: fee is exactly the base
  assert.equal(hopFeeMsat(B(999999), B(777), B(0)), B(777));
});

test("routeBackwards: 1M sats at 1000 msat + 500 ppm over 1 hop", () => {
  // 1000 + floor(1,000,000,000 * 500 / 1e6) = 1000 + 500,000 = 501,000 msat.
  // Backward: recipient 1,000,000,000 msat; hop forwards 1,000,501,000 msat.
  const r = routeBackwards(B(1000000000), [{ baseFeeMsat: B(1000), ratePpm: B(500) }]);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.totalFeeMsat, B(501000)); // 501,000 msat = 501 sats
  assert.equal(r.senderAmountMsat, B(1000501000));
});

test("routeBackwards: each hop charges on its forwarded amount (later fees included)", () => {
  // Recipient receives 100,000,000 msat (100k sats); 3 hops at 500+100.
  // Hop3 (nearest recipient): fee = 500 + floor(100,000,000*100/1e6) = 500+10,000 = 10,500
  // Hop2: forwards 100,010,500; fee = 500 + floor(100,010,500*100/1e6) = 500+10,001 = 10,501
  // Hop1: forwards 100,021,001; fee = 500 + floor(100,021,001*100/1e6) = 500+10,002 = 10,502
  // Total = 31,503 msat; sender pays 100,031,503 msat.
  const r = routeBackwards(B(100000000), Array.from({ length: 3 }, () => ({ baseFeeMsat: B(500), ratePpm: B(100) })));
  assert.ok(r.ok);
  if (!r.ok) return;
  const fees = r.legs.map((l) => Number(l.feeMsat));
  assert.deepEqual(fees, [10502, 10501, 10500]); // legs are ordered hop1..hopN (sender first)
  assert.equal(r.totalFeeMsat, B(31503));
  assert.equal(r.senderAmountMsat, B(100031503));
});

test("routeBackwards: 10 hops at 500 msat + 100 ppm, 100k sats -> 106 sats", () => {
  // Independent python reference (backward walk, floor): total 105,045 msat.
  const r = routeBackwards(B(100000000), Array.from({ length: 10 }, () => ({ baseFeeMsat: B(500), ratePpm: B(100) })));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.totalFeeMsat, B(105045));
  assert.equal(msatToSatsRoundUp(r.totalFeeMsat), B(106));
});

test("routeBackwards: 20 hops still bounded and correct", () => {
  // Python reference (backward walk, floor): 210,190 msat total = 211 sats.
  const r = routeBackwards(B(100000000), Array.from({ length: 20 }, () => ({ baseFeeMsat: B(500), ratePpm: B(100) })));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.totalFeeMsat, B(210190));
  assert.equal(msatToSatsRoundUp(r.totalFeeMsat), B(211));
});

test("routeBackwards rejects zero/negative amounts and 0 or >20 hops", () => {
  assert.ok(!routeBackwards(B(0), [{ baseFeeMsat: B(1), ratePpm: B(1) }]).ok);
  assert.ok(!routeBackwards(B(-5), [{ baseFeeMsat: B(1), ratePpm: B(1) }]).ok);
  assert.ok(!routeBackwards(B(1000), []).ok);
  assert.ok(!routeBackwards(B(1000), Array.from({ length: 21 }, () => ({ baseFeeMsat: B(1), ratePpm: B(1) }))).ok);
});

test("parseUnits: decimals respected, comma rejected, -0 rejected, cap enforced", () => {
  // sats with 6 decimals
  const a = parseUnits("100000", 6, MAX_AMOUNT_SATS);
  assert.ok(a.ok);
  if (a.ok) assert.equal(a.value, B(100000) * B(1000000));
  const b = parseUnits("10.5", 6, MAX_AMOUNT_SATS);
  assert.ok(b.ok);
  if (b.ok) assert.equal(b.value, B(10500000));
  // 0 decimals (whole units only): fraction rejected
  assert.equal(parseUnits("1.5", 0, B(20)).ok, false);
  assert.equal(parseUnits("1", 0, B(20)).ok, true);
  // comma, sign, exponent, empty, spaces-only, text
  assert.equal(parseUnits("1,000", 6, MAX_AMOUNT_SATS).ok, false);
  assert.equal(parseUnits("-1", 6, MAX_AMOUNT_SATS).ok, false);
  assert.equal(parseUnits("-0", 6, MAX_AMOUNT_SATS).ok, false);
  assert.equal(parseUnits("1e12", 6, MAX_AMOUNT_SATS).ok, false);
  assert.equal(parseUnits("", 6, MAX_AMOUNT_SATS).ok, false);
  assert.equal(parseUnits("  ", 6, MAX_AMOUNT_SATS).ok, false);
  assert.equal(parseUnits("abc", 6, MAX_AMOUNT_SATS).ok, false);
  // over-cap rejected, exactly-at-cap accepted
  assert.equal(parseUnits("1000000001", 6, MAX_AMOUNT_SATS).ok, false);
  assert.equal(parseUnits("1000000000", 6, MAX_AMOUNT_SATS).ok, true);
});

test("parseUnits: precision beyond the allowed decimals is rejected, not rounded", () => {
  assert.equal(parseUnits("0.0000001", 6, MAX_AMOUNT_SATS).ok, false); // 7 decimals > 6
  assert.equal(parseUnits("0.000001", 6, MAX_AMOUNT_SATS).ok, true); // 6 ok
});

test("msatToSatsRoundUp rounds up partial sats", () => {
  assert.equal(msatToSatsRoundUp(B(31503)), B(32)); // 31.503 -> 32
  assert.equal(msatToSatsRoundUp(B(31000)), B(31)); // exact stays exact
});

test("satsToUsd: 100k sats at 64834.345 = 64.834345", () => {
  const usd = satsToUsd(B(100000), 64834.345);
  assert.ok(Math.abs(usd - 64.834345) < 1e-9);
});

test("BOLT 7 spec example: hopFeeMsat floor semantics (10199)", () => {
  // BOLT 7 line 1173: 200 + ( 4999999 * 2000 / 1000000 ) = 10199 (integer floor).
  assert.equal(hopFeeMsat(B(4999999), B(200), B(2000)), B(10199));
  // Floor edge cases: 1001 msat at 1000 ppm = 1 msat; 999999999 at 1 ppm = 999.
  assert.equal(hopFeeMsat(B(1001), B(0), B(1000)), B(1));
  assert.equal(hopFeeMsat(B(999999999), B(0), B(1)), B(999));
});

test("BOLT 7 spec route: recipient 4,999,999 msat -> sender pays 5,010,198 msat", () => {
  // BOLT 7 worked route A->B->C: C receives 4,999,999 msat; the C->B hop
  // (base 200, rate 2000) charges 10,199, so B forwards 5,010,198 to C and
  // the sender amount is 5,010,198 msat. Backward walk, msat in, floor out.
  const r = routeBackwards(B(4999999), [{ baseFeeMsat: B(200), ratePpm: B(2000) }]);
  assert.equal(r.ok, true);
  assert.equal(r.ok ? r.senderAmountMsat : BigInt(0), B(5010198));
  assert.equal(r.ok ? r.totalFeeMsat : BigInt(0), B(10199));
});

test("21,000,000 BTC through 3 hops at 1000 msat + 1 ppm = 6,300,006,303,002 msat", () => {
  const r = routeBackwards(BigInt("2100000000000000000"), Array.from({ length: 3 }, () => ({ baseFeeMsat: B(1000), ratePpm: B(1) })));
  assert.equal(r.ok, true);
  assert.equal(r.ok ? r.totalFeeMsat : BigInt(0), B(6300006303002));
});

test("routeBackwards legs: receives = fee + forwards, and each leg forwards what the next receives", () => {
  const r = routeBackwards(B(100000000), Array.from({ length: 3 }, () => ({ baseFeeMsat: B(500), ratePpm: B(100) })));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.legs.map((l) => [Number(l.amountInMsat), Number(l.feeMsat), Number(l.amountOutMsat)]), [
    [100031503, 10502, 100021001],
    [100021001, 10501, 100010500],
    [100010500, 10500, 100000000],
  ]);
  assert.equal(r.recipientMsat, B(100000000));
});

test("display helpers: exact msat, sats, BTC, percent, ppm", () => {
  assert.equal(formatInt(B(100031503)), "100,031,503");
  assert.equal(formatMsatAsSats(B(100031503)), "100,031.503");
  assert.equal(formatMsatAsSats(B(100000000)), "100,000.000");
  assert.equal(formatMsatAsSats(B(7)), "0.007");
  assert.equal(formatMsatAsBtc(B(31503)), "0.00000031503");
  assert.equal(formatMsatAsBtc(BigInt("100000000000")), "1.00000000000");
  assert.equal(effectivePpm(B(31503), B(100000000)), "315.03");
  assert.equal(effectivePercent(B(31503), B(100000000)), "0.0315");
  assert.equal(effectivePercent(B(10500), B(100000000)), "0.0105");
  // half-up rounding: 1/3 ppm of 1 -> 333333.33; 2/3 -> 666666.67
  assert.equal(effectivePpm(B(1), B(3)), "333,333.33");
  assert.equal(effectivePpm(B(2), B(3)), "666,666.67");
  assert.equal(ppmToPercent(B(1000)), "0.1");
  assert.equal(ppmToPercent(B(10000)), "1");
  assert.equal(ppmToPercent(B(1)), "0.0001");
  assert.equal(ppmToPercent(B(200)), "0.02");
  assert.equal(ppmToPercent(B(0)), "0");
  assert.equal(ppmToPercent(B(1000000)), "100");
  // beyond 2^53: exact string from BigInt
  assert.equal(formatInt(BigInt("2100000000000000000")), "2,100,000,000,000,000,000");
  assert.ok(Math.abs(msatToUsd(B(31503), 65251.845) - 0.02055628873) < 1e-12);
});

test("parseUnits: msat amounts (3 decimals) and whole fee fields", () => {
  const a = parseUnits("4999.999", 3, MAX_AMOUNT_SATS);
  assert.ok(a.ok);
  if (a.ok) assert.equal(a.value, B(4999999));
  assert.equal(parseUnits("0.0015", 3, MAX_AMOUNT_SATS).ok, false); // below 1 msat
  assert.equal(parseUnits("500.7", 0, B(10000000)).ok, false); // base fee must be whole
  assert.equal(parseUnits("0", 0, B(10000000)).ok, true); // zero base fee is allowed
  assert.equal(parseUnits("28,50", 3, MAX_AMOUNT_SATS).ok, false);
  assert.equal(parseUnits("1,000", 0, B(10000000)).ok, false);
  assert.equal(parseUnits("10000001", 0, B(10000000)).ok, false);
});
