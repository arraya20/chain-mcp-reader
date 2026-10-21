const ALLOWED_FIELDS = new Set(["contractAddress", "walletAddress"]);
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

// Best-effort per-isolate limiter; each isolate keeps its own counters.
function isRateLimited(key, now = Date.now()) {
  const buckets = (globalThis.__readContractRate ??= new Map());
  for (const [k, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key) ?? { count: 0, resetAt: now + RATE_WINDOW_MS };
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count > RATE_LIMIT;
}

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

  if (isRateLimited(request.headers.get("CF-Connecting-IP") || "unknown")) {
    return Response.json({ error: "Too many requests. Try again shortly." }, {
      status: 429, headers: { "Retry-After": String(RATE_WINDOW_MS / 1000) },
    });
  }

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
  if (Object.keys(input).some((key) => !ALLOWED_FIELDS.has(key))) {
    return Response.json({ error: "Only contractAddress and walletAddress are accepted." }, { status: 400 });
  }
  if (input.walletAddress != null && typeof input.walletAddress !== "string") {
    return Response.json({ error: "walletAddress must be a string." }, { status: 400 });
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
