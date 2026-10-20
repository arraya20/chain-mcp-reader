# Pharos Chain MCP Reader

Standalone read-only CLI for reading ERC-20 contract state through the official Pharos Chain MCP server.

## Scope

This module is read-only. It does not use a wallet, private key, direct JSON-RPC fallback, or API key.

It reads one pinned block and calls:

- `name()`
- `symbol()`
- `decimals()`
- `totalSupply()`
- `balanceOf(address)` when a wallet address is supplied

MCP endpoint:

```text
https://mcp.pharos.xyz/mcp
```

Required MCP tools:

```text
get_chain_info
get_block_number
get_code
eth_call
```

## Install

Requirements: Node.js 20+ and npm.

```bash
cd chain-mcp-reader
npm install
npm test
```

## Run

Interactive mode:

```bash
npm start
```

Enter the contract address when prompted, then the optional wallet address.
Press Enter at the wallet prompt to skip `balanceOf`. Invalid addresses are
rejected and prompted again. No MCP request starts until inputs are complete.
Only public addresses are requested; never enter a private key or seed phrase.
Interactive mode requires a terminal. For scripts, use positional arguments.

Contract only:

```bash
npm start -- 0xC879C018dB60520F4355C26eD1a6D572cdAC1815
```

Contract plus wallet balance:

```bash
npm start -- \
  0x6b0a44c64190279f7034b77c13a566e914fe5ec4 \
  0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51
```

Machine-readable output:

```bash
npm start -- \
  0x6b0a44c64190279f7034b77c13a566e914fe5ec4 \
  0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51 \
  --json
```

## Web demo and API

The repository includes a browser demo in `public/` and a Cloudflare Pages
Function at `functions/api/read-contract.js`.

The web form sends this same-origin request:

```http
POST /api/read-contract
Content-Type: application/json
```

Body:

```json
{
  "contractAddress": "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
  "walletAddress": "0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51"
}
```

The API accepts only `contractAddress` and optional `walletAddress`. It fixes
upstream access to the official MCP endpoint, rejects cross-origin requests,
limits request size, validates addresses before upstream calls, returns
`no-store` responses, and applies a best-effort per-isolate request limit.
Configure a Cloudflare WAF rate-limit rule before exposing the anonymous API
widely; in-memory limits do not coordinate across Workers isolates.

The demo displays the contract address, wallet address, pinned block, decoded
state, raw ABI values, chain ID, and read-only MCP provenance. It never asks
for a private key, seed phrase, wallet connection, or transaction signature.

### Local web preview

Install Wrangler if needed, then run:

```bash
npx wrangler pages dev public
```

Open the local URL printed by Wrangler. The API route is available at
`/api/read-contract`.

### Cloudflare Pages deployment

Connect this repository in **Workers & Pages → Create → Pages → Connect to
Git**. Use:

```text
Production branch: main
Framework preset: None
Build command: npm ci && npm run check && npm test
Build output directory: public
Root directory: /
```

Cloudflare Pages detects the root `functions/` directory and deploys the API
route with the static site. No secrets or environment variables are required.
After deployment, test the generated `*.pages.dev` URL before attaching a
custom domain.

## Output guarantees

- Verifies chain ID `1672`.
- Fetches one block number before reads.
- Uses that same block for bytecode and every `eth_call`.
- Rejects EOAs without contract bytecode.
- Keeps `uint256` values as `BigInt`/decimal strings.
- Applies ERC-20 decimals only for human-readable output.
- Includes raw ABI return values and decoded values.
- Labels contract and wallet addresses separately.
- Reports `readOnly: true` and MCP transport provenance.

## Example target

- Network: Pharos mainnet
- Chain ID: `1672`
- Contract: `0x6b0a44c64190279f7034b77c13a566e914fe5ec4`
- Wallet: `0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51`

The example address is only a default test target. The CLI accepts any deployed ERC-20 address on Pharos mainnet.

## Design boundary

`contract-inspector` analyzes bytecode, selectors, proxy patterns, and risk. This module reads live state through Chain MCP. Keeping those concerns separate preserves clear provenance for Agent Arena submissions and allows both specialists to be composed later by `coordinator`.
