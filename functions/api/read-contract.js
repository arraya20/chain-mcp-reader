export async function onRequest(context) {
  const { request } = context;
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405, headers: { Allow: "POST" } });
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Cross-origin requests are not accepted." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return Response.json({ error: "Send input as application/json." }, { status: 415 });
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 2048) return Response.json({ error: "Request body is too large." }, { status: 413 });

  let input;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 2048) {
      return Response.json({ error: "Request body is too large." }, { status: 413 });
    }
    input = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Response.json({ error: "Expected a JSON object." }, { status: 400 });
  }

  try {
    const { readContractState } = await import("../../src/reader.mjs");
    const report = await readContractState({
      contractAddress: input.contractAddress,
      walletAddress: input.walletAddress || undefined,
      mcpUrl: "https://mcp.pharos.xyz/mcp",
      timeoutMs: 20_000,
    });
    return Response.json(report, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const message = String(error?.message || "Contract read failed.").slice(0, 300);
    const status = /Invalid .*address/.test(message) ? 400 : 502;
    return Response.json({ error: message }, {
      status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
}
