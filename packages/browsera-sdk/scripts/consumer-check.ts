import { BrowseraClient, BrowseraError, type ActionId, type ActionResult, isSuccess } from "browsera-sdk";
const c = new BrowseraClient({ baseUrl: "http://localhost:8000" });
const id: ActionId = "dropColumn";
const r: Promise<ActionResult<{ n: number }>> = c.runNode<{ n: number }>(id, { path: "x.csv" });
const _e: typeof BrowseraError = BrowseraError;
void r; void c.health(); void isSuccess;
