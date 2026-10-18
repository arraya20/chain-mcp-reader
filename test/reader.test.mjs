import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeAbiString,
  decodeUint,
  encodeAddressCall,
  requireAddress,
} from "../src/abi.mjs";
import { formatUnits, makeStateReport } from "../src/format.mjs";

const ABI_STRING = "0x" + "20".padStart(64, "0") + "04".padStart(64, "0") + Buffer.from("USDC").toString("hex").padEnd(64, "0");

test("decodes dynamic ABI strings", () => {
  assert.equal(decodeAbiString(ABI_STRING, "name()"), "USDC");
});

test("decodes uint256 without Number precision loss", () => {
  const raw = `0x${"ce8f8f6cf13443655f9c".padStart(64, "0")}`;
  assert.equal(decodeUint(raw, "totalSupply()"), 975455714774139059658652n);
});

test("encodes balanceOf address call", () => {
  assert.equal(
    encodeAddressCall("0x70a08231", "0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51"),
    "0x70a082310000000000000000000000002e1c3e80d13b03aac05aeefacc254e26d6fafb51",
  );
});

test("formats token units", () => {
  assert.equal(formatUnits(975455714774139059658652n, 18), "975455.714774139059658652");
  assert.equal(formatUnits(0n, 18), "0");
});

test("rejects invalid addresses", () => {
  assert.throws(() => requireAddress("not-an-address"), /Invalid address/);
});

test("builds stable JSON report with pinned block", () => {
  const report = makeStateReport({
    chain: { name: "Pharos", chainId: 1672, nativeSymbol: "PROS" },
    blockNumber: "20459373",
    contractAddress: "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
    walletAddress: "0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51",
    raw: { name: "0x01", symbol: "0x02", decimals: "0x03", totalSupply: "0x04", balanceOf: "0x05" },
    values: { name: "Faroo Staked PROS", symbol: "stPROS", decimals: 18, totalSupply: 975455714774139059658652n, balanceOf: 0n },
  });
  assert.equal(report.block.tag, "pinned");
  assert.equal(report.state.totalSupply.value, "975455.714774139059658652");
  assert.equal(report.state.balanceOf.value, "0");
  assert.equal(report.source.readOnly, true);
});
