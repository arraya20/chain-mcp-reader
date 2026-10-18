#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin, stderr } from "node:process";
import { requireAddress } from "./abi.mjs";
import { formatTextReport } from "./format.mjs";
import { readContractState } from "./reader.mjs";

const usage = "Usage: npm start [-- <erc20-contract-address> [wallet-address] [--json]]";
const args = process.argv.slice(2);
const json = args.includes("--json");
const positional = args.filter((arg) => arg !== "--json");

async function promptAddresses() {
  const rl = createInterface({ input: stdin, output: stderr });
  async function ask(label, optional = false) {
    while (true) {
      const value = (await rl.question(label)).trim();
      if (optional && !value) return undefined;
      try { return requireAddress(value); } catch {
        stderr.write("Address tidak valid. Gunakan 0x diikuti 40 karakter hex.\n");
      }
    }
  }
  try {
    stderr.write("Pharos Chain MCP Reader — read-only\n");
    const contractAddress = await ask("Contract address: ");
    const walletAddress = await ask("Wallet address (opsional, Enter untuk lewati): ", true);
    return { contractAddress, walletAddress };
  } finally {
    rl.close();
  }
}

try {
  if (positional.length > 2 || args.some((arg) => arg.startsWith("--") && arg !== "--json")) {
    throw new Error(usage);
  }
  if (!positional.length && !stdin.isTTY) {
    throw new Error(`Interactive input requires a terminal. ${usage}`);
  }
  const addresses = positional.length
    ? { contractAddress: positional[0], walletAddress: positional[1] }
    : await promptAddresses();
  const report = await readContractState(addresses);
  console.log(json ? JSON.stringify(report, null, 2) : formatTextReport(report));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
