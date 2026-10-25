/** Thrown for any non-2xx response from the Scrapper backend. */
export class BrowseraError extends Error {
  /** HTTP status code (0 when the request never reached the server). */
  readonly status: number;
  /** The `detail` field of FastAPI's error body, when present. */
  readonly detail: unknown;
  /** Raw parsed response body, when available. */
  readonly body: unknown;

  constructor(
    message: string,
    opts: { status: number; detail?: unknown; body?: unknown } = { status: 0 },
  ) {
    super(message);
    this.name = "BrowseraError";
    this.status = opts.status;
    this.detail = opts.detail;
    this.body = opts.body;
  }
}
