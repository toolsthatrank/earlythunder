import assert from "node:assert/strict";
import test from "node:test";
import {
  BLOCKS_PER_DAY,
  blockSubsidySats,
  nextHalvingHeight,
  projections,
  blockSubsidyBtc,
  breakevenUsdPerKwh,
  efficiencyJPerTh,
  hashprice,
  hsToThs,
  impliedHashrateHs,
  miningResult,
  netAtDifficulty,
  netAtSubsidy,
  rewardSplit,
  validateInputs,
  type MiningInputs,
} from "../src/lib/bitcoin-mining";

const base: MiningInputs = {
  hashrateThs: 236,
  watts: 3510,
  usdPerKwh: 0.04,
  poolFeePct: 1,
  hardwareUsd: 4000,
  rewardBtc: 3.125,
  networkThs: 1.062_034_895_661_6791e9, // difficulty-implied: 148,364,561,003,867.4 × 2^32 / 600, in TH/s
  priceUsd: 75644.735,
};

test("blocks per day is exactly 144 on mainnet spacing", () => {
  assert.equal(BLOCKS_PER_DAY, 144);
});

test("impliedHashrateHs derives difficulty × 2^32 / 600 in H/s", () => {
  // mempool currentDifficulty 148,364,561,003,867.4 at fetch time
  const hs = impliedHashrateHs(148_364_561_003_867.4);
  assert.ok(hs !== null);
  const expected = (148_364_561_003_867.4 * 4294967296) / 600;
  assert.ok(Math.abs(hs! / expected - 1) < 1e-12);
  // cross-check: matches mempool's own currentHashrate 1.018e21 H/s within 5%
  assert.ok(Math.abs(hs! / 1.018_385_789_925_62e21 - 1) < 0.05);
  assert.equal(hsToThs(hs!), hs! / 1e12);
  assert.equal(impliedHashrateHs(0), null);
  assert.equal(impliedHashrateHs(-5), null);
  assert.equal(impliedHashrateHs(Number.NaN), null);
});

test("mining math matches an independent hand computation", () => {
  const r = miningResult(base);
  assert.ok(r);
  const share = 236 / base.networkThs;
  const btcDay = share * 3.125 * 144;
  assert.ok(Math.abs(r.btcPerDay - btcDay) < 1e-18);
  assert.ok(Math.abs(r.revenueUsdPerDay - btcDay * 75644.735) < 1e-12);
  assert.ok(Math.abs(r.electricityUsdPerDay - 3510 / 1000 * 24 * 0.04) < 1e-12);
  assert.ok(Math.abs(r.poolFeeUsdPerDay - r.revenueUsdPerDay * 0.01) <= 1e-9 * r.revenueUsdPerDay);
  assert.ok(Math.abs(r.netUsdPerDay - (r.revenueUsdPerDay - r.electricityUsdPerDay - r.poolFeeUsdPerDay)) < 1e-9);
  assert.ok(Math.abs(r.netUsdPer30d - r.netUsdPerDay * 30) < 1e-9);
  assert.ok(Math.abs(r.breakevenDays! - 4000 / r.netUsdPerDay) < 1e-9);
});

test("sensitivity deltas", () => {
  const r = miningResult(base);
  assert.ok(r);
  // +1% price moves net by 1% of gross revenue net of pool fee
  assert.ok(Math.abs(r.netPer1PctPriceUsd - r.revenueUsdPerDay * 0.01 * 0.99) < 1e-12);
  // +0.01 $/kWh: kW × 24 × 0.01, reduces net (negative)
  assert.ok(Math.abs(r.netPerCentKwhUsd + 3.51 * 24 * 0.01) < 1e-12);
});

test("unprofitable machine yields null breakeven, never negative-days", () => {
  const r = miningResult({ ...base, usdPerKwh: 5 });
  assert.ok(r);
  assert.equal(r.breakevenDays, null);
  assert.ok(r.netUsdPerDay < 0);
});

test("hashprice matches the administrator recon at difficulty-implied hashrate", () => {
  // difficulty-implied hashrate: 148364561003867.4 × 2^32 / 600 = 1,062.03 EH/s
  const networkThs = (148_364_561_003_867.4 * 4294967296) / 600 / 1e12;
  const hp = hashprice(3.125, networkThs, 75686);
  assert.ok(hp);
  // recon: about 32.27 USD per PH/s per day (0.000426 BTC); tolerance 1%
  assert.ok(Math.abs(hp.perPhsUsd - 32.27) < 0.4);
  assert.ok(Math.abs(hp.perPhsBtc - 0.000426) < 0.0000043);
  assert.ok(Math.abs(hp.perThsBtc * 1000 - hp.perPhsBtc) < 1e-18);
});

test("efficiency, break-even kWh, subsidy math", () => {
  assert.equal(efficiencyJPerTh(3510, 236), 3510 / 236);
  assert.equal(efficiencyJPerTh(100, 0), null);
  // break-even kWh: revenue 10, fee 1, 3500 W -> 9/(3.5*24)
  assert.ok(Math.abs(breakevenUsdPerKwh(10, 1, 3500)! - 9 / 84) < 1e-12);
  assert.equal(breakevenUsdPerKwh(10, 1, 0), null);
  // GetBlockSubsidy: height 975012 -> 4 halvings -> 3.125; 1050000 -> 5 -> 1.5625
  assert.equal(blockSubsidyBtc(975012), 3.125);
  assert.equal(blockSubsidyBtc(1_050_000), 1.5625);
  assert.equal(blockSubsidyBtc(13_440_000), 0);
  // split: total 3.1445787 vs subsidy 3.125 -> fee share about 0.62%
  const sp = rewardSplit(3.125, 3.1445787);
  assert.ok(sp);
  assert.ok(Math.abs(sp.feeSharePct - 0.62) < 0.01);
  assert.equal(rewardSplit(3.2, 3.1), null);
});

test("what-if projections scale the right inputs", () => {
  const atRetarget = netAtDifficulty(base, -3.81);
  assert.ok(atRetarget);
  assert.ok(Math.abs(atRetarget.revenueUsdPerDay - base.rewardBtc * 144 * base.priceUsd * (236 / (base.networkThs * (1 - 0.0381)))) < 1e-9);
  const atHalving = netAtSubsidy(base, 1.5625);
  assert.ok(atHalving);
  // base reward 3.125 is pure subsidy; halving to 1.5625 halves gross revenue
  assert.ok(Math.abs(atHalving.revenueUsdPerDay - base.rewardBtc * 144 * base.priceUsd * (236 / base.networkThs) / 2) < 1e-9);
  assert.equal(netAtDifficulty(base, -100), null);
});

test("rejects out-of-range inputs", () => {
  assert.ok(validateInputs({ ...base, hashrateThs: 0 }) !== null);
  assert.ok(validateInputs({ ...base, hashrateThs: -1 }) !== null);
  assert.ok(validateInputs({ ...base, watts: 1e6 + 1 }) !== null);
  assert.ok(validateInputs({ ...base, usdPerKwh: 11 }) !== null);
  assert.ok(validateInputs({ ...base, poolFeePct: 101 }) !== null);
  assert.ok(validateInputs({ ...base, rewardBtc: 0 }) !== null);
  assert.ok(validateInputs({ ...base, networkThs: 0 }) !== null);
  assert.ok(validateInputs({ ...base, priceUsd: 0 }) !== null);
  assert.equal(validateInputs(base), null);
});

test("machine cannot exceed the network", () => {
  assert.equal(miningResult({ ...base, hashrateThs: base.networkThs * 2 }), null);
});

test("zero-power machine is free to run", () => {
  const r = miningResult({ ...base, watts: 0 });
  assert.ok(r);
  assert.equal(r.electricityUsdPerDay, 0);
  assert.ok(r.netUsdPerDay > 0);
});

test("GetBlockSubsidy rule and next halving", () => {
  assert.equal(blockSubsidySats(840000), 312500000);
  assert.equal(blockSubsidySats(1049999), 312500000);
  assert.equal(blockSubsidySats(1050000), 156250000);
  assert.equal(blockSubsidySats(13440000), 0);
  assert.equal(blockSubsidySats(2100000), 4882812);
  assert.equal(blockSubsidySats(6930000), 0);
  assert.equal(blockSubsidyBtc(6930000), 0);
  assert.equal(blockSubsidySats(-1), null);
  assert.equal(nextHalvingHeight(975017), 1050000);
});

test("hashprice, J/TH and break-even electricity price", () => {
  const r = miningResult(base);
  assert.ok(r);
  assert.ok(Math.abs(r.hashpriceBtcPerPhDay - (3.125 * 144) / (base.networkThs / 1000)) < 1e-15);
  assert.ok(Math.abs(r.joulesPerTh - 3510 / 236) < 1e-12);
  assert.ok(Math.abs(r.breakevenUsdPerKwh! - (r.revenueUsdPerDay * 0.99) / (3.51 * 24)) < 1e-12);
  const p = projections(base, 0, 975017);
  assert.ok(p);
  assert.ok(Math.abs(p.netUsdPerDayAfterDifficulty - r.netUsdPerDay) < 1e-9);
});

test("reward is caller-supplied, no halving math invented here", () => {
  const r = miningResult({ ...base, rewardBtc: 6.25 });
  assert.ok(r);
  const r2 = miningResult(base);
  assert.ok(Math.abs(r.btcPerDay - r2!.btcPerDay * 2) < 1e-15);
});
