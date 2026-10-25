# browsera-sdk

TypeScript SDK for the **Scrapper workflow engine** — run web scraping, data cleaning, datasource, and workflow nodes from Node.js or the browser. Thin, typed client over the engine's HTTP API, so every capability in the backend is available in one package.

- Zero runtime dependencies
- ESM + CJS builds, full TypeScript types
- Works in Node.js >= 18 and any runtime with `fetch`

## Install

```bash
npm install browsera-sdk
```

## Quick start

Start the backend (from the repo root):

```bash
uvicorn main:app --reload --app-dir backend
```

Then run nodes from your code:

```ts
import { BrowseraClient, isSuccess } from "browsera-sdk";

const client = new BrowseraClient("http://localhost:8000");

const res = await client.runNode<{ dataframeRef: string; rowCount: number }>(
  "loadCSV",
  { fileRef: "./data.csv" },
);

if (isSuccess(res)) {
  const df = res.result.dataframeRef;

  // chain by passing refs explicitly — same contract as the engine
  const cleaned = await client.runNode("dropColumn", {
    dataframeRef: df,
    columns: ["debug"],
  });
  console.log(cleaned.status);
} else {
  console.error(res.error);
}
```

Browser actions work the same way — the engine owns the Playwright session and threads it via `sessionId`:

```ts
const open = await client.runNode<{ sessionId: string }>("openBrowser", {
  browserType: "chromium",
  headless: true,
});
if (!isSuccess(open)) throw new Error(open.error);
const { sessionId } = open.result;

await client.runNode("loadWebsite", { url: "https://example.com" }, { sessionId });
const heading = await client.runNode<{ output: string }>(
  "extractXPath",
  { xpath: "//h1" },
  { sessionId },
);
await client.runNode("closeBrowser", { sessionId });
```

## Running workflows (batch)

`runNodes` executes nodes sequentially on the server:

```ts
const { results } = await client.runNodes([
  { id: "n1", actionTemplateId: "loadCSV", inputs: { fileRef: "./orders.csv" } },
  { id: "n2", actionTemplateId: "loadExcel", inputs: { fileRef: "./users.xlsx" } },
]);

for (const r of results) {
  console.log(r.nodeId, r.status, r.result ?? r.error);
}
```

> Batch inputs are static: dynamic outputs (`dataframeRef`, `sessionId`) must be wired by the caller between calls (chain `runNode` calls, reading the previous result), exactly like the app UI does.

## Auth + workflows

```ts
await client.auth.signIn("me@example.com", "password"); // token stored automatically

const saved = await client.workflows.save({
  name: "My flow",
  nodes: [{ id: "n1", actionTemplateId: "scanWebPage" }],
});

const all = await client.workflows.list();
const one = await client.workflows.get(saved.id);
const { nodes } = await client.workflows.generate("scrape product prices");
```

Authenticated routes send `Authorization: Bearer <token>` automatically (also accepted: `auth-token` cookie on the backend, or `client.setToken(...)`).

## PDF to markdown

```ts
const bytes = await fetch("https://example.com/report.pdf").then((r) => r.arrayBuffer());

const res = await client.pdf.toMarkdown(bytes, {
  filename: "report.pdf",
  useOCR: true,
  maxChars: 50_000,
});
```

## Error handling

Two failure layers:

1. **HTTP errors** (4xx/5xx, timeouts) throw `BrowseraError` with `status`, `detail`, and `body`.
2. **Engine failures** (a node that could not execute) resolve as `{ status: "failed", error }`, matching the backend contract.

```ts
import { BrowseraError, isSuccess } from "browsera-sdk";

try {
  const r = await client.runNode("knnImputation", { dataframeRef: df, columns: ["price"] });
  if (!isSuccess(r)) console.warn("engine failed:", r.error);
} catch (e) {
  if (e instanceof BrowseraError) console.error(e.status, e.detail);
  throw e;
}
```

## API surface

| Method | Backend route |
| --- | --- |
| `client.health()` | `GET /health` |
| `client.runNode(actionId, inputs?, config?, opts?)` | `POST /run-node` |
| `client.runNodes(nodes)` | `POST /run-multiple-nodes` |
| `client.execute(actionId, inputs?, config?)` | `POST /actions/execute` |
| `client.auth.signUp(email, password)` | `POST /signup` |
| `client.auth.signIn(email, password)` | `POST /signin` |
| `client.workflows.save / list / get` | `POST/GET /workflow` |
| `client.workflows.generate(prompt, name?)` | `POST /createNewWorkflow` |
| `client.pdf.toMarkdown(file, opts?)` | `POST /pdf/upload-to-markdown` |

`ActionId` is a union of every registered engine action (`dropColumn`, `openBrowser`, `extractXPath`, `loadExcel`, `connectMongo`, ...) with `(string & {})` so custom ids still type-check.

## Configuration

```ts
const client = new BrowseraClient({
  baseUrl: "http://localhost:8000", // default
  token: "jwt...",                  // optional pre-issued bearer token
  timeoutMs: 30_000,                // default per-request timeout
  headers: { "x-tenant": "acme" },  // extra headers on every request
  fetch: customFetch,               // proxy / undici / polyfill
});
```

Per-call overrides: `client.runNode("wait", {}, {}, { timeoutMs: 5_000, signal })`.

## Development

```bash
npm install
npm run build   # dist/esm + dist/cjs + dist/types
npm test        # 14-check smoke test against a stub server + consumer type check
```

Publishing is guarded by `prepublishOnly` (build + test).

## License

MIT
