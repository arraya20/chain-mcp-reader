import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/read-contract.js";

function context({ method = "POST", headers = {}, body = "{}", url = "https://demo.example/api/read-contract" } = {}) {
  return { request: new Request(url, { method, headers, body: method === "GET" || method === "HEAD" ? undefined : body }) };
}

test("rejects non-POST methods", async () => {
  const response = await onRequest(context({ method: "GET" }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "POST");
});

test("rejects cross-origin requests", async () => {
  const response = await onRequest(context({ headers: { Origin: "https://attacker.example", "content-type": "application/json" } }));
  assert.equal(response.status, 403);
});

test("requires JSON content type", async () => {
  const response = await onRequest(context());
  assert.equal(response.status, 415);
});

test("rejects invalid JSON", async () => {
  const response = await onRequest(context({ headers: { "content-type": "application/json" }, body: "{" }));
  assert.equal(response.status, 400);
});

test("rejects oversized body even without content-length", async () => {
  const response = await onRequest(context({ headers: { "content-type": "application/json" }, body: JSON.stringify({ value: "x".repeat(2100) }) }));
  assert.equal(response.status, 413);
});

test("validates address before making external MCP call", async () => {
  const response = await onRequest(context({
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contractAddress: "not-an-address" }),
  }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Invalid contract address/);
});
