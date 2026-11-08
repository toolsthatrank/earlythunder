/**
 * Bitcoin mining profitability math.
 *
 * Pure integer/float arithmetic only, no network, no React. Every constant is
 * a dated figure the caller supplies from a fetched source; nothing here is
 * live. Units: hashrate in TH/s, power in watts, electricity in $/kWh, pool
 * fee in percent, hardware cost in USD, price in USD/BTC, reward in BTC per
 * block, network hashrate in TH/s.
 *
 * NASA Power of 10: every input range checked, no recursion, single-exit
 * helpers, no silent casts, bounded loops only.
 */

export const SECONDS_PER_DAY = 86400;
/** Mainnet target block spacing, seconds (chainparams.cpp nPowTargetSpacing). */
export const BLOCK_INTERVAL_SECONDS = 600;
export const BLOCKS_PER_DAY = SECONDS_PER_DAY / BLOCK_INTERVAL_SECONDS; // 144

export interface MiningInputs {
  /** Machine hashrate, TH/s. Range (0, 1e9]. */
  hashrateThs: number;
  /** Machine power draw, watts. Range [0, 1e6]. */
  watts: number;
  /** Electricity price, $/kWh. Range [0, 10]. */
  usdPerKwh: number;
  /** Pool fee, percent of gross revenue. Range [0, 100]. */
  poolFeePct: number;
  /** Hardware cost, USD. Range [0, 1e9]. */
  hardwareUsd: number;
  /** BTC block reward (subsidy + fees if you choose), BTC per block. Range (0, 100]. */
  rewardBtc: number;
  /** Total network hashrate, TH/s. Range (0, 1e25]. */
  networkThs: number;
  /** BTC spot price used for the USD columns, $/BTC. Range (0, 1e9]. */
  priceUsd: number;
}

export interface MiningResult {
  sharePct: number;
  btcPerDay: number;
  blocksPerDay: number;
  revenueUsdPerDay: number;
  electricityUsdPerDay: number;
  poolFeeUsdPerDay: number;
  netUsdPerDay: number;
  netUsdPer30d: number;
  breakevenDays: number | null;
  /** +1% price move effect on net $/day. */
  netPer1PctPriceUsd: number;
  /** +0.01 $/kWh electricity effect on net $/day (negative: net falls). */
  netPerCentKwhUsd: number;
  /** Machine efficiency, joules per terahash (W / TH/s). */
  joulesPerTh: number;
  /** Electricity price at which net is zero, $/kWh. null when watts = 0. */
  breakevenUsdPerKwh: number | null;
  /** Hashprice, BTC per PH/s per day, from the reward and network hashrate inputs. */
  hashpriceBtcPerPhDay: number;
  /** Hashprice, USD per PH/s per day. */
  hashpriceUsdPerPhDay: number;
}

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Validates inputs; returns null with a reason when any is out of range. */
export function validateInputs(x: MiningInputs): string | null {
  if (!finite(x.hashrateThs) || x.hashrateThs <= 0 || x.hashrateThs > 1e9) return "Hashrate must be between 0 and 1,000,000,000 TH/s.";
  if (!finite(x.watts) || x.watts < 0 || x.watts > 1e6) return "Power draw must be between 0 and 1,000,000 watts.";
  if (!finite(x.usdPerKwh) || x.usdPerKwh < 0 || x.usdPerKwh > 10) return "Electricity price must be between 0 and 10 $/kWh.";
  if (!finite(x.poolFeePct) || x.poolFeePct < 0 || x.poolFeePct > 100) return "Pool fee must be between 0 and 100 percent.";
  if (!finite(x.hardwareUsd) || x.hardwareUsd < 0 || x.hardwareUsd > 1e9) return "Hardware cost must be between 0 and 1,000,000,000 USD.";
  if (!finite(x.rewardBtc) || x.rewardBtc <= 0 || x.rewardBtc > 100) return "Block reward must be between 0 and 100 BTC.";
  if (!finite(x.networkThs) || x.networkThs <= 0 || x.networkThs > 1e25) return "Network hashrate must be greater than 0.";
  if (!finite(x.priceUsd) || x.priceUsd <= 0 || x.priceUsd > 1e9) return "BTC price must be between 0 and 1,000,000,000 USD.";
  if (x.hashrateThs > x.networkThs) return "Machine hashrate cannot be higher than the network hashrate.";
  return null;
}

/**
 * Difficulty-implied network hashrate, in H/s (mempool.space's own unit for
 * currentHashrate). Primary derivation per the brief:
 * hashrateHs = difficulty × 2^32 / 600 seconds.
 * difficulty is the raw float (mempool.space getdifficulty-style), range (0, 1e18].
 */
export function impliedHashrateHs(difficulty: number): number | null {
  if (!finite(difficulty) || difficulty <= 0 || difficulty > 1e18) return null;
  return (difficulty * 4294967296) / BLOCK_INTERVAL_SECONDS;
}

/** H/s -> TH/s. */
export function hsToThs(hs: number): number {
  return hs / 1e12;
}

export function miningResult(x: MiningInputs): MiningResult | null {
  if (validateInputs(x) !== null) return null;
  const share = x.hashrateThs / x.networkThs;
  if (share > 1) return null; // a machine cannot exceed the network
  const btcPerDay = share * x.rewardBtc * BLOCKS_PER_DAY;
  const revenueUsdPerDay = btcPerDay * x.priceUsd;
  const electricityUsdPerDay = (x.watts / 1000) * 24 * x.usdPerKwh;
  const poolFeeUsdPerDay = revenueUsdPerDay * (x.poolFeePct / 100);
  const netUsdPerDay = revenueUsdPerDay - electricityUsdPerDay - poolFeeUsdPerDay;
  return {
    sharePct: share * 100,
    btcPerDay,
    blocksPerDay: BLOCKS_PER_DAY,
    revenueUsdPerDay,
    electricityUsdPerDay,
    poolFeeUsdPerDay,
    netUsdPerDay,
    netUsdPer30d: netUsdPerDay * 30,
    breakevenDays: netUsdPerDay > 0 ? x.hardwareUsd / netUsdPerDay : null,
    netPer1PctPriceUsd: revenueUsdPerDay * 0.01 * (1 - x.poolFeePct / 100),
    netPerCentKwhUsd: -(x.watts / 1000) * 24 * 0.01,
    joulesPerTh: x.watts / x.hashrateThs,
    breakevenUsdPerKwh: x.watts > 0 ? (revenueUsdPerDay - poolFeeUsdPerDay) / ((x.watts / 1000) * 24) : null,
    hashpriceBtcPerPhDay: (x.rewardBtc * BLOCKS_PER_DAY) / (x.networkThs / 1000),
    hashpriceUsdPerPhDay: ((x.rewardBtc * BLOCKS_PER_DAY) / (x.networkThs / 1000)) * x.priceUsd,
  };
}

/** Halving interval in blocks (chainparams.cpp nSubsidyHalvingInterval, mainnet). */
export const HALVING_INTERVAL = 210000;

/**
 * Block subsidy in satoshis at a height, as Bitcoin Core validation.cpp
 * GetBlockSubsidy: nSubsidy = 50 * COIN; nSubsidy >>= halvings; 0 when
 * halvings >= 64. The right shift truncates, so Math.floor is the same
 * operation: 4,882,812 sats at height 2,100,000 and 0 sats at 6,930,000.
 * Division of 5e9 (< 2^53) by a power of 2 is exact in a double.
 */
export function blockSubsidySats(height: number): number | null {
  if (!Number.isInteger(height) || height < 0) return null;
  const halvings = Math.floor(height / HALVING_INTERVAL);
  if (halvings >= 64) return 0;
  return Math.floor(5_000_000_000 / 2 ** halvings);
}

/** First height of the next subsidy era after `height`. */
export function nextHalvingHeight(height: number): number | null {
  if (!Number.isInteger(height) || height < 0) return null;
  return (Math.floor(height / HALVING_INTERVAL) + 1) * HALVING_INTERVAL;
}

export interface Projection {
  /** Net $/day after a difficulty change of difficultyChangePct; price and fees constant. */
  netUsdPerDayAfterDifficulty: number;
  /** Subsidy at the next halving height, BTC. */
  nextSubsidyBtc: number;
  nextHalvingHeight: number;
  /** Net $/day after the next halving; fees per block, price and difficulty constant. */
  netUsdPerDayAfterHalving: number;
}

/**
 * Projections, not forecasts. Constant price and fees per block; the halving
 * row also keeps difficulty constant. tipHeight is the fetched chain tip.
 */
export function projections(x: MiningInputs, difficultyChangePct: number, tipHeight: number): Projection | null {
  const r = miningResult(x);
  if (r === null || !finite(difficultyChangePct) || difficultyChangePct <= -100 || difficultyChangePct > 1000) return null;
  const nowSats = blockSubsidySats(tipHeight);
  const nextHeight = nextHalvingHeight(tipHeight);
  if (nowSats === null || nextHeight === null) return null;
  const nextSats = blockSubsidySats(nextHeight) ?? 0;
  const feesBtc = Math.max(0, x.rewardBtc - nowSats / 1e8);
  const nextReward = nextSats / 1e8 + feesBtc;
  const keep = 1 - x.poolFeePct / 100;
  return {
    netUsdPerDayAfterDifficulty: (r.revenueUsdPerDay / (1 + difficultyChangePct / 100)) * keep - r.electricityUsdPerDay,
    nextSubsidyBtc: nextSats / 1e8,
    nextHalvingHeight: nextHeight,
    netUsdPerDayAfterHalving: r.revenueUsdPerDay * (nextReward / x.rewardBtc) * keep - r.electricityUsdPerDay,
  };
}

/** J/TH machine efficiency: watts per (TH/s). Lower is better. */
export function efficiencyJPerTh(watts: number, hashrateThs: number): number | null {
  if (!finite(watts) || !finite(hashrateThs) || hashrateThs <= 0 || watts < 0) return null;
  return watts / hashrateThs;
}

/**
 * Break-even electricity price, $/kWh: the rate at which net is exactly zero.
 * revenue − poolFee = kW × 24 × price  =>  price = (revenue − fee) / (kW × 24).
 * Returns null when the machine draws no power (any price is break-even).
 */
export function breakevenUsdPerKwh(revenueUsdPerDay: number, poolFeeUsdPerDay: number, watts: number): number | null {
  if (!finite(revenueUsdPerDay) || !finite(poolFeeUsdPerDay) || !finite(watts)) return null;
  const kw = watts / 1000;
  if (kw <= 0) return null;
  return (revenueUsdPerDay - poolFeeUsdPerDay) / (kw * 24);
}

/**
 * Hashprice: revenue for one PH/s (and TH/s) per day, in BTC and USD, from the
 * reward and the network hashrate. 1 PH/s = 1000 TH/s.
 */
export function hashprice(rewardBtc: number, networkThs: number, priceUsd: number): { perPhsBtc: number; perPhsUsd: number; perThsBtc: number; perThsUsd: number } | null {
  if (!finite(rewardBtc) || !finite(networkThs) || !finite(priceUsd)) return null;
  if (rewardBtc <= 0 || networkThs <= 0 || priceUsd <= 0) return null;
  const perThsBtc = (rewardBtc * BLOCKS_PER_DAY) / networkThs;
  return {
    perThsBtc,
    perThsUsd: perThsBtc * priceUsd,
    perPhsBtc: perThsBtc * 1000,
    perPhsUsd: perThsBtc * 1000 * priceUsd,
  };
}

/**
 * Subsidy / fee split of a total reward. subsidyBtc is GetBlockSubsidy output
 * (50 >> halvings); totalRewardBtc is the observed average per block.
 */
export function rewardSplit(subsidyBtc: number, totalRewardBtc: number): { subsidyBtc: number; feeBtc: number; feeSharePct: number } | null {
  if (!finite(subsidyBtc) || !finite(totalRewardBtc)) return null;
  if (subsidyBtc <= 0 || totalRewardBtc < subsidyBtc) return null;
  const feeBtc = totalRewardBtc - subsidyBtc;
  return { subsidyBtc, feeBtc, feeSharePct: (feeBtc / totalRewardBtc) * 100 };
}

/** GetBlockSubsidy, validation.cpp: 50 COIN >> (height / halvingInterval), 0 at halvings >= 64. */
export function blockSubsidyBtc(height: number, halvingInterval = 210000): number | null {
  if (!finite(height) || height < 0 || height !== Math.floor(height)) return null;
  const halvings = Math.floor(height / halvingInterval);
  if (halvings >= 64) return 0;
  return Math.floor(5_000_000_000 / 2 ** halvings) / 1e8;
}

/** What-if projection: net at a scaled difficulty (e.g. next retarget estimate). */
export function netAtDifficulty(x: MiningInputs, difficultyChangePct: number): MiningResult | null {
  if (!finite(difficultyChangePct) || difficultyChangePct <= -100) return null;
  return miningResult({ ...x, networkThs: x.networkThs * (1 + difficultyChangePct / 100) });
}

/** What-if projection: net at a future subsidy (e.g. next halving at height 1,050,000). */
export function netAtSubsidy(x: MiningInputs, futureSubsidyBtc: number): MiningResult | null {
  if (!finite(futureSubsidyBtc) || futureSubsidyBtc <= 0) return null;
  // Fees observed separately are dropped here unless the caller passes a total;
  // this projection models subsidy only, labeled as such by the caller.
  return miningResult({ ...x, rewardBtc: futureSubsidyBtc });
}
