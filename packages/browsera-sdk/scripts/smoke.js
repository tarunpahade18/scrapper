import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { BrowseraClient, BrowseraError, isSuccess } from "browsera-sdk";

const TOKEN = "tok_123";

function createStubServer() {
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const isJson = (req.headers["content-type"] ?? "").includes("application/json");
      let body = {};
      if (raw && isJson) {
        try {
          body = JSON.parse(raw);
        } catch {
          return; // aborted/partial request (e.g. client timeout test)
        }
      }
      const send = (status, obj) => {
        if (res.destroyed || res.writableEnded) return;
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      const authed = req.headers.authorization === `Bearer ${TOKEN}`;
      const url = req.url ?? "/";
      const method = req.method ?? "GET";

      if (method === "GET" && url === "/health") return send(200, { status: "ok" });

      if (method === "POST" && url === "/run-node") {
        const { actionId, inputs } = body;
        if (actionId === "slow") {
          return setTimeout(() => send(200, { status: "success", actionId, result: "late" }), 400);
        }
        if (actionId === "unknown-action") {
          return send(400, { detail: `Unknown action: ${actionId}` });
        }
        if (actionId === "failNode") {
          return send(200, { status: "failed", actionId, error: "node exploded" });
        }
        return send(200, { status: "success", actionId, result: { echo: inputs ?? {} } });
      }

      if (method === "POST" && url === "/run-multiple-nodes") {
        const results = (body.nodes ?? []).map((n) => ({
          nodeId: n.id,
          status: "success",
          result: { status: "success", actionId: n.actionTemplateId, result: null },
        }));
        return send(200, { results });
      }

      if (method === "POST" && url === "/actions/execute") {
        return send(200, { status: "success", actionId: body.actionId, result: { ok: true } });
      }

      if (method === "POST" && url === "/signup") return send(200, { message: "Signup successful" });
      if (method === "POST" && url === "/signin") {
        return send(200, { access_token: TOKEN, token_type: "bearer" });
      }

      if (url.startsWith("/workflow")) {
        if (!authed) return send(401, { detail: "Not authenticated" });
        if (method === "GET") {
          return send(200, [{ id: "wf_1", name: "My flow", nodeCount: 3, createdAt: null, updatedAt: null }]);
        }
        if (method === "POST") {
          return send(200, { id: body.workflowId ?? "wf_2", name: body.name, nodes: body.nodes ?? [], createdAt: null, updatedAt: null });
        }
      }

      if (method === "POST" && url === "/createNewWorkflow") {
        return send(200, { nodes: [{ id: "n1", actionTemplateId: "openBrowser", inputs: {} }] });
      }

      if (method === "POST" && url === "/pdf/upload-to-markdown") {
        const ctype = req.headers["content-type"] ?? "";
        if (!ctype.includes("multipart/form-data")) return send(400, { detail: "expected multipart" });
        if (!raw.includes('filename="document.pdf"')) return send(400, { detail: "missing filename" });
        return send(200, { status: "success", actionId: "pdfTomarkdown", result: "# extracted" });
      }

      send(404, { detail: `No stub for ${method} ${url}` });
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const checks = [];
const check = async (name, fn) => {
  try {
    await fn();
    checks.push(`ok - ${name}`);
  } catch (err) {
    checks.push(`FAIL - ${name}: ${err.message}`);
    process.exitCode = 1;
  }
};

const server = await createStubServer();
const port = server.address().port;
const client = new BrowseraClient(`http://127.0.0.1:${port}`);

await check("health", async () => {
  assert.deepEqual(await client.health(), { status: "ok" });
});

await check("runNode success envelope", async () => {
  const r = await client.runNode("loadCSV", { path: "a.csv" });
  assert.ok(isSuccess(r));
  assert.deepEqual(r.result, { echo: { path: "a.csv" } });
});

await check("runNode HTTP error throws BrowseraError", async () => {
  await assert.rejects(
    client.runNode("unknown-action"),
    (e) => e instanceof BrowseraError && e.status === 400 && String(e.detail).includes("Unknown action"),
  );
});

await check("runNode engine failure resolves as failed", async () => {
  const r = await client.runNode("failNode");
  assert.equal(r.status, "failed");
});

await check("runNodes batch", async () => {
  const { results } = await client.runNodes([
    { id: "a", actionTemplateId: "openBrowser" },
    { id: "b", actionTemplateId: "loadWebsite", inputs: { url: "https://example.com" } },
  ]);
  assert.equal(results.length, 2);
  assert.equal(results[0].nodeId, "a");
});

await check("execute alias", async () => {
  const r = await client.execute("dropColumn", { columns: ["x"] });
  assert.ok(isSuccess(r));
});

await check("timeout aborts with BrowseraError", async () => {
  await assert.rejects(
    client.runNode("slow", {}, {}, { timeoutMs: 80 }),
    (e) => e instanceof BrowseraError && /timed out/.test(e.message),
  );
});

await check("auth.signIn stores token", async () => {
  const s = await client.auth.signIn("a@b.com", "pw");
  assert.equal(s.access_token, TOKEN);
  assert.equal(client.token, TOKEN);
});

await check("workflows.list requires auth and returns list", async () => {
  const list = await client.workflows.list();
  assert.equal(list[0].id, "wf_1");
});

await check("workflows.save round-trip", async () => {
  const wf = await client.workflows.save({
    name: "Demo",
    nodes: [{ id: "n1", actionTemplateId: "scanWebPage" }],
  });
  assert.equal(wf.name, "Demo");
  assert.equal(wf.nodes.length, 1);
});

await check("workflows.generate returns nodes", async () => {
  const { nodes } = await client.workflows.generate("scrape prices", "Prices");
  assert.equal(nodes[0].actionTemplateId, "openBrowser");
});

await check("pdf.toMarkdown multipart upload", async () => {
  const r = await client.pdf.toMarkdown(new Uint8Array([1, 2, 3]));
  assert.ok(isSuccess(r));
  assert.equal(r.result, "# extracted");
});

await check("unauthenticated workflow call throws 401", async () => {
  const anon = new BrowseraClient(`http://127.0.0.1:${port}`);
  await assert.rejects(anon.workflows.list(), (e) => e instanceof BrowseraError && e.status === 401);
});

await check("CJS build loads via require", () => {
  const require_ = createRequire(import.meta.url);
  const cjs = require_("../dist/cjs/index.js");
  assert.equal(typeof cjs.BrowseraClient, "function");
  assert.equal(typeof cjs.BrowseraError, "function");
});

server.close();
console.log(checks.join("\n"));
console.log(process.exitCode ? "\nSMOKE FAILED" : `\nSMOKE PASSED (${checks.length} checks)`);
