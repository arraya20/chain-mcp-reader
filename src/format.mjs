export function formatUnits(value, decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error(`Invalid decimals: ${decimals}`);
  }
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const remainder = value % base;
  if (remainder === 0n) return whole.toString();
  const fraction = remainder.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fraction}`;
}

export function makeStateReport({ chain, blockNumber, contractAddress, walletAddress, raw, values }) {
  const symbol = values.symbol;
  return {
    schemaVersion: "1.0",
    source: {
      transport: "pharos-chain-mcp",
      endpoint: "https://mcp.pharos.xyz/mcp",
      readOnly: true,
    },
    network: {
      name: chain.name,
      chainId: chain.chainId,
      nativeSymbol: chain.nativeSymbol ?? null,
    },
    target: { contractAddress, walletAddress: walletAddress ?? null },
    block: { number: String(blockNumber), tag: "pinned" },
    state: {
      name: { raw: raw.name, value: values.name },
      symbol: { raw: raw.symbol, value: symbol },
      decimals: { raw: raw.decimals, value: values.decimals },
      totalSupply: {
        raw: raw.totalSupply,
        value: formatUnits(values.totalSupply, values.decimals),
        rawInteger: values.totalSupply.toString(),
        unit: symbol,
      },
      ...(walletAddress ? {
        balanceOf: {
          raw: raw.balanceOf,
          value: formatUnits(values.balanceOf, values.decimals),
          rawInteger: values.balanceOf.toString(),
          unit: symbol,
        },
      } : {}),
    },
    methods: Object.fromEntries(
      Object.keys(raw).map((method) => [method, "available"]),
    ),
  };
}

export function formatTextReport(report) {
  const { network, target, block, state } = report;
  const lines = [
    "Pharos Contract State Report",
    `Network: ${network.name} (Chain ID ${network.chainId})`,
    `Contract: ${target.contractAddress}`,
    ...(target.walletAddress ? [`Wallet queried: ${target.walletAddress}`] : []),
    `Block: ${block.number} (${block.tag})`,
    `Name: ${state.name.value}`,
    `Symbol: ${state.symbol.value}`,
    `Decimals: ${state.decimals.value}`,
    `Total supply: ${state.totalSupply.value} ${state.totalSupply.unit}`,
    `Total supply (raw): ${state.totalSupply.rawInteger}`,
    ...(state.balanceOf ? [
      `Balance: ${state.balanceOf.value} ${state.balanceOf.unit}`,
      `Balance (raw): ${state.balanceOf.rawInteger}`,
    ] : []),
    "Read-only: true",
    "Transport: official Pharos Chain MCP",
  ];
  return lines.join("\n");
}
