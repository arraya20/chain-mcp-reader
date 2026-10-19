import {
  ERC20_SELECTORS, MCP_URL, PHAROS_CHAIN_ID, decodeAbiString, decodeUint,
  encodeAddressCall, requireAddress, requireHex,
} from "./abi.mjs";
import { mcpClose, mcpInitialize, mcpRequest } from "./mcp.mjs";
import { makeStateReport } from "./format.mjs";

const REQUIRED_TOOLS = ["get_chain_info", "get_block_number", "get_code", "eth_call"];

function toolResult(message, toolName) {
  const result = message.result;
  if (!result) throw new Error(`${toolName} returned no result`);
  if (result.isError) {
    const detail = result.content?.filter((item) => item.type === "text").map((item) => item.text).join("\n");
    throw new Error(`${toolName} failed${detail ? `: ${detail}` : ""}`);
  }
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error(`${toolName} returned no text result`);
  try { return JSON.parse(text); } catch (error) {
    throw new Error(`${toolName} returned invalid JSON: ${error.message}`);
  }
}

export async function readContractState({ contractAddress, walletAddress, mcpUrl = MCP_URL, timeoutMs = 30_000 } = {}) {
  const address = requireAddress(contractAddress, "contract address");
  const wallet = walletAddress ? requireAddress(walletAddress, "wallet address") : undefined;
  let sessionId;
  try {
    const initialized = await mcpInitialize(mcpUrl, timeoutMs);
    sessionId = initialized.sessionId;
    const list = await mcpRequest({ url: mcpUrl, sessionId, id: 3, method: "tools/list", timeoutMs });
    const available = new Set((list.message.result?.tools ?? []).map((tool) => tool.name));
    const missing = REQUIRED_TOOLS.filter((tool) => !available.has(tool));
    if (missing.length) throw new Error(`Pharos MCP is missing required tools: ${missing.join(", ")}`);

    let id = 10;
    async function callTool(name, args = {}) {
      const response = await mcpRequest({ url: mcpUrl, sessionId, id: id++, method: "tools/call", params: { name, arguments: args }, timeoutMs });
      return toolResult(response.message, name);
    }

    const [chain, latest] = await Promise.all([callTool("get_chain_info"), callTool("get_block_number")]);
    if (Number(chain.chainId) !== PHAROS_CHAIN_ID) throw new Error(`Expected Pharos chain ID ${PHAROS_CHAIN_ID}, received ${chain.chainId}`);
    const blockNumber = String(latest.blockNumber);
    if (!/^\d+$/.test(blockNumber)) throw new Error("get_block_number returned an invalid block number");

    const code = await callTool("get_code", { address, block: blockNumber });
    const bytecode = requireHex(code.code, "get_code");
    if (bytecode === "0x" || /^0x0*$/.test(bytecode)) throw new Error(`No contract bytecode found at ${address} at block ${blockNumber}`);

    const calls = { ...ERC20_SELECTORS };
    if (!wallet) delete calls.balanceOf;
    const entries = await Promise.all(Object.entries(calls).map(async ([field, selector]) => {
      const data = field === "balanceOf" ? encodeAddressCall(selector, wallet) : selector;
      const response = await callTool("eth_call", { transaction: { to: address, data }, block: blockNumber });
      return [field, requireHex(response.result, `eth_call ${field}()` )];
    }));
    const raw = Object.fromEntries(entries);
    const decimalsBigInt = decodeUint(raw.decimals, "decimals()");
    if (decimalsBigInt > 255n) throw new Error(`decimals() returned an invalid value: ${decimalsBigInt}`);
    const decimals = Number(decimalsBigInt);
    const values = {
      name: decodeAbiString(raw.name, "name()"),
      symbol: decodeAbiString(raw.symbol, "symbol()"),
      decimals,
      totalSupply: decodeUint(raw.totalSupply, "totalSupply()"),
      ...(wallet ? { balanceOf: decodeUint(raw.balanceOf, "balanceOf(address)") } : {}),
    };
    return makeStateReport({ chain, blockNumber, contractAddress: address, walletAddress: wallet, raw, values });
  } finally {
    await mcpClose(mcpUrl, sessionId);
  }
}
