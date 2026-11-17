import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_INCREMENTAL_RELAY_FEE_SAT_PER_KVB,
  MAX_REPLACEMENT_CANDIDATES,
  cpfpViable,
  childOwnFeerate,
  evaluateRbf,
  minChildFeeSat,
  minReplacementFeeSat,
  packageFeerate,
  parseUnits,
  feerateMilli,
} from "../src/lib/fee-bump";

const B = (n: number) => BigInt(n);

test("constants: Bitcoin Core v32.1 defaults", () => {
  // policy/policy.h: DEFAULT_INCREMENTAL_RELAY_FEE{100} = 100 sat/kvB (0.1 sat/vB).
  assert.equal(DEFAULT_INCREMENTAL_RELAY_FEE_SAT_PER_KVB, B(100));
  // policy/rbf.h: MAX_REPLACEMENT_CANDIDATES{100} (rule 5, distinct clusters).
  assert.equal(MAX_REPLACEMENT_CANDIDATES, B(100));
});

test("parseUnits: integers, decimals, rejections", () => {
  assert.deepEqual(parseUnits("21000", 0, B(1000000)), { ok: true, value: B(21000) });
  assert.deepEqual(parseUnits("12.5", 1, B(1000000)), { ok: true, value: B(125) });
  assert.deepEqual(parseUnits("12.345", 2, B(1000000)), { ok: false }); // too many places
  assert.deepEqual(parseUnits("1,000", 0, B(1000000)), { ok: false }); // comma
  assert.deepEqual(parseUnits("-5", 0, B(1000000)), { ok: false }); // sign
  assert.deepEqual(parseUnits("abc", 0, B(1000000)), { ok: false });
  assert.deepEqual(parseUnits("", 0, B(1000000)), { ok: false });
  assert.deepEqual(parseUnits("99999999999999", 0, B(1000)), { ok: false }); // over max
});

// --- CPFP ---

test("packageFeerate: combined rate math", () => {
  // 200 sat parent over 140 vB + 1000 sat child over 140 vB = 1200 sat / 280 vB
  assert.equal(packageFeerate(B(200), B(140), B(1000), B(140)), B(4285)); // 4.285 sat/vB
  assert.equal(packageFeerate(B(0), B(0), B(1), B(1)), null); // degenerate
});

test("minChildFeeSat: exact lift and already-clears cases", () => {
  // Parent 200 sat / 140 vB (1.428 sat/vB). Target 10 sat/vB. Child 140 vB.
  // Needed: 10 * 280 - 200 = 2600 sat.
  assert.equal(minChildFeeSat(B(200), B(140), B(140), B(10000)), B(2600));
  // Parent 2000 sat / 140 vB alone is 14.3 sat/vB. A miner takes it alone at 10 sat/vB. No child is needed.
  assert.equal(minChildFeeSat(B(2000), B(140), B(140), B(10000)), null);
  // Parent exactly at the target (1400 sat / 140 vB = 10 sat/vB). No child is needed.
  assert.equal(minChildFeeSat(B(1400), B(140), B(140), B(10000)), null);
  // Brief recon: parent 141 sat / 141 vB, child 110 vB, 20 sat/vB. ceil(20 x 251) = 5020. Child 4879.
  assert.equal(minChildFeeSat(B(141), B(141), B(110), B(20000)), B(4879));
  // Huge parent clears even with the child weight folded in.
  assert.equal(minChildFeeSat(B(20000), B(140), B(140), B(10000)), null);
});

test("cpfpViable: viable bump, non-viable bump", () => {
  assert.equal(cpfpViable(B(200), B(140), B(2600), B(140), B(10000)), true);
  assert.equal(cpfpViable(B(200), B(140), B(1000), B(140), B(10000)), false);
});

test("childOwnFeerate", () => {
  assert.equal(childOwnFeerate(B(2600), B(140)), B(18571)); // 18.571 sat/vB
  assert.equal(childOwnFeerate(B(1), B(0)), null);
});

// --- RBF / Bitcoin Core v32.1 replacement policy ---

test("evaluateRbf: happy path (no signalling requirement under full RBF)", () => {
  const r = evaluateRbf({
    replacedCount: B(1),
    replacedFeeSat: B(1000),
    replacedVb: B(141),
    newFeeSat: B(3000),
    newVb: B(141),
    newAddsInputs: false,
  });
  assert.equal(r.ok, true);
  assert.equal(r.code, "OK");
});

test("evaluateRbf: nothing to replace", () => {
  const r = evaluateRbf({
    replacedCount: B(0),
    replacedFeeSat: B(0),
    replacedVb: B(0),
    newFeeSat: B(3000),
    newVb: B(141),
    newAddsInputs: false,
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, "NOT_IN_MEMPOOL");
});

test("evaluateRbf: an equal fee fails rule 4 (no incremental fee)", () => {
  const r = evaluateRbf({
    replacedCount: B(1),
    replacedFeeSat: B(1000),
    replacedVb: B(141),
    newFeeSat: B(1000),
    newVb: B(141),
    newAddsInputs: false,
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, "INSUFFICIENT_FEE");
});

test("evaluateRbf: incremental relay floor on the replacement size", () => {
  // 0.1 sat/vB incremental over 141 vB => floor is 1000 + ceil(14.1) = 1015.
  const r = evaluateRbf({
    replacedCount: B(1),
    replacedFeeSat: B(1000),
    replacedVb: B(141),
    newFeeSat: B(1014),
    newVb: B(141),
    newAddsInputs: false,
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, "INSUFFICIENT_FEE");
  assert.match(r.detail, /1015 sat/);
});

test("evaluateRbf: more than 100 conflicting clusters is rejected (rule 5)", () => {
  const r = evaluateRbf({
    replacedCount: B(101),
    replacedFeeSat: B(1000),
    replacedVb: B(141),
    newFeeSat: B(3000),
    newVb: B(141),
    newAddsInputs: false,
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, "TOO_MANY_REPLACEMENTS");
});

test("minReplacementFeeSat: brief recon and doc example", () => {
  // 141 vB at 20 sat/vB: max(ceil(20 x 141) = 2820, 141 + ceil(0.1 x 141) = 156) = 2820, set by the target.
  assert.deepEqual(minReplacementFeeSat(B(141), B(141), B(20000)), { feeSat: B(2820), by: "target feerate" });
  // mempool-replacements.md example: 0.1 sat/vB x 500 vB = 50 sat above the original fees.
  assert.deepEqual(minReplacementFeeSat(B(0), B(500), B(1)), { feeSat: B(50), by: "rules 3 and 4" });
});

test("evaluateRbf: rules 3 and 4 pass for a lower feerate (rule 6 is not checked)", () => {
  // Old: 1000 sat / 100 vB. New: 1500 sat / 200 vB. Floor 1000 + ceil(20) = 1020. Rules 3 and 4 pass.
  const r = evaluateRbf({
    replacedCount: B(1),
    replacedFeeSat: B(1000),
    replacedVb: B(100),
    newFeeSat: B(1500),
    newVb: B(200),
    newAddsInputs: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.code, "OK");
});

test("page claim: near the lowest feerates rule 4 can make RBF cost more than CPFP", () => {
  // Parent 15 sat / 141 vB, child 110 vB, target 0.11 sat/vB.
  // CPFP: ceil(0.11 x 251) = 28, child 28 - 15 = 13 sat. RBF: max(ceil(0.11 x 141) = 16, 15 + ceil(0.1 x 141) = 30) = 30, extra 15 sat.
  assert.equal(minChildFeeSat(B(15), B(141), B(110), B(110)), B(13));
  assert.deepEqual(minReplacementFeeSat(B(15), B(141), B(110)), { feeSat: B(30), by: "rules 3 and 4" });
});

test("feerateMilli: floored sat/vB x 1000", () => {
  assert.equal(feerateMilli(B(1000), B(100)), B(10000));
  assert.equal(feerateMilli(B(1500), B(200)), B(7500));
  assert.equal(feerateMilli(B(1000), B(141)), B(7092)); // 7.092 sat/vB
  assert.equal(feerateMilli(B(1), B(0)), null);
});
