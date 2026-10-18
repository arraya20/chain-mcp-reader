export async function mcpRequest({ url, sessionId, id, method, params = {}, timeoutMs = 30_000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    };
    if (sessionId) headers["mcp-session-id"] = sessionId;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`MCP HTTP ${response.status}: ${await response.text()}`);
    const text = await response.text();
    const match = text.match(/data:\s*(\{[\s\S]*\})/);
    if (!match) throw new Error(`MCP returned no SSE message for ${method}`);
    const message = JSON.parse(match[1]);
    if (message.error) throw new Error(`${method}: ${message.error.message ?? JSON.stringify(message.error)}`);
    return { message, sessionId: response.headers.get("mcp-session-id") ?? sessionId };
  } finally {
    clearTimeout(timer);
  }
}

export async function mcpInitialize(url, timeoutMs) {
  const result = await mcpRequest({
    url,
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "pharos-chain-mcp-reader", version: "0.1.0" },
    },
    timeoutMs,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-session-id": result.sessionId,
    };
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  return result;
}
