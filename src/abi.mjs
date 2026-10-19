export const MCP_URL = "https://mcp.pharos.xyz/mcp";
export const PHAROS_CHAIN_ID = 1672;

export const ERC20_SELECTORS = Object.freeze({
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
  balanceOf: "0x70a08231",
});

export function requireAddress(value, label = "address") {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value ?? "missing"}`);
  }
  return value;
}

export function requireHex(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]*$/.test(value)) {
    throw new Error(`${label} returned invalid hex data`);
  }
  return value;
}

function hexBytes(value, label) {
  const hex = requireHex(value, label).slice(2);
  if (hex.length % 2 !== 0) throw new Error(`${label} returned odd-length hex data`);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function wordToBigInt(bytes, offset, label) {
  if (offset < 0 || offset + 32 > bytes.length) throw new Error(`${label} returned truncated ABI data`);
  let hex = "";
  for (let i = offset; i < offset + 32; i += 1) hex += bytes[i].toString(16).padStart(2, "0");
  return BigInt(`0x${hex}`);
}

function decodeUtf8(bytes) {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function decodeUint(value, label) {
  const bytes = hexBytes(value, label);
  if (bytes.length < 32) throw new Error(`${label} returned less than one ABI word`);
  return wordToBigInt(bytes, 0, label);
}

export function decodeAbiString(value, label) {
  const bytes = hexBytes(value, label);
  if (bytes.length < 32) throw new Error(`${label} returned less than one ABI word`);
  const offset = wordToBigInt(bytes, 0, label);
  if (offset <= BigInt(Number.MAX_SAFE_INTEGER)) {
    const start = Number(offset);
    if (start % 32 === 0 && start + 32 <= bytes.length) {
      const length = wordToBigInt(bytes, start, label);
      if (length > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} returned an unsupported string length`);
      const end = start + 32 + Number(length);
      if (end > bytes.length) throw new Error(`${label} returned truncated string data`);
      return decodeUtf8(bytes.subarray(start + 32, end));
    }
  }
  // Compatibility with older ERC-20 contracts returning bytes32.
  const firstWord = bytes.subarray(0, 32);
  const zero = firstWord.indexOf(0);
  const decoded = decodeUtf8(firstWord.subarray(0, zero === -1 ? 32 : zero));
  if (!decoded) throw new Error(`${label} returned an empty or unsupported string`);
  return decoded;
}

export function encodeAddressCall(selector, address) {
  requireAddress(address, "wallet address");
  return `${selector}${address.slice(2).toLowerCase().padStart(64, "0")}`;
}
