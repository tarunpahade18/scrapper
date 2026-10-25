import { BrowseraError } from "./errors.js";
import type {
  ActionId,
  ActionResult,
  AuthSession,
  FetchLike,
  HealthResponse,
  Inputs,
  PdfToMarkdownOptions,
  RequestOpts,
  RunNodesResponse,
  RunNodeOptions,
  SaveWorkflowInput,
  BrowseraClientOptions,
  Workflow,
  WorkflowNode,
  WorkflowSummary,
} from "./types.js";

const DEFAULT_BASE_URL = "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 30_000;

export type BinaryFile = Blob | ArrayBuffer | Uint8Array;

interface RequestInit_ {
  json?: unknown;
  form?: FormData;
  opts?: RequestOpts;
}

/**
 * Thin, typed client for the Scrapper workflow engine backend.
 *
 * Works in Node.js >= 18 and modern browsers (any runtime with `fetch`).
 */
export class BrowseraClient {
  /** Base URL of the backend, without a trailing slash. */
  readonly baseUrl: string;

  /** Saved workflows, AI workflow generation (requires an authenticated session). */
  readonly workflows: {
    save: (input: SaveWorkflowInput, opts?: RequestOpts) => Promise<Workflow>;
    list: (opts?: RequestOpts) => Promise<WorkflowSummary[]>;
    get: (workflowId: string, opts?: RequestOpts) => Promise<Workflow>;
    generate: (
      prompt: string,
      workflowName?: string,
      opts?: RequestOpts,
    ) => Promise<{ nodes: WorkflowNode[] }>;
  };

  /** Email/password auth. `signIn` stores the bearer token on the client. */
  readonly auth: {
    signUp: (
      email: string,
      password: string,
      opts?: RequestOpts,
    ) => Promise<{ message: string }>;
    signIn: (
      email: string,
      password: string,
      opts?: RequestOpts,
    ) => Promise<AuthSession>;
  };

  /** PDF extraction helpers. */
  readonly pdf: {
    toMarkdown: (
      file: BinaryFile,
      opts?: PdfToMarkdownOptions,
    ) => Promise<ActionResult<string>>;
  };

  #fetch: FetchLike;
  #token: string | null;
  #headers: Record<string, string>;
  #timeoutMs: number;

  constructor(options: BrowseraClientOptions | string = {}) {
    const opts: BrowseraClientOptions =
      typeof options === "string" ? { baseUrl: options } : options;

    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#token = opts.token ?? null;
    this.#headers = { ...(opts.headers ?? {}) };
    this.#timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const globalFetch = globalThis.fetch;
    if (!globalFetch && !opts.fetch) {
      throw new Error(
        "No global fetch available. Use Node.js >= 18 or pass a custom `fetch` in the client options.",
      );
    }
    this.#fetch = opts.fetch ?? globalFetch!.bind(globalThis);

    this.workflows = {
      save: (input, o) =>
        this.#request<Workflow>("POST", "/workflow", { json: input, opts: o }),
      list: (o) => this.#request<WorkflowSummary[]>("GET", "/workflow", { opts: o }),
      get: (workflowId, o) =>
        this.#request<Workflow>(
          "GET",
          `/workflow/${encodeURIComponent(workflowId)}`,
          { opts: o },
        ),
      generate: (prompt, workflowName, o) =>
        this.#request<{ nodes: WorkflowNode[] }>(
          "POST",
          "/createNewWorkflow",
          { json: { prompt, workflowName }, opts: o },
        ),
    };

    this.auth = {
      signUp: (email, password, o) =>
        this.#request<{ message: string }>("POST", "/signup", {
          json: { email, password },
          opts: o,
        }),
      signIn: async (email, password, o) => {
        const session = await this.#request<AuthSession>("POST", "/signin", {
          json: { email, password },
          opts: o,
        });
        this.#token = session.access_token;
        return session;
      },
    };

    this.pdf = {
      toMarkdown: (file, o) => this.#pdfToMarkdown(file, o),
    };
  }

  /** Current bearer token, if any. */
  get token(): string | null {
    return this.#token;
  }

  /** Set (or clear with `null`) the bearer token used for authenticated routes. */
  setToken(token: string | null): this {
    this.#token = token;
    return this;
  }

  /** Drop the stored token. */
  signOut(): this {
    this.#token = null;
    return this;
  }

  /** GET /health */
  health(opts?: RequestOpts): Promise<HealthResponse> {
    return this.#request<HealthResponse>("GET", "/health", { opts });
  }

  /**
   * POST /run-node — execute a single action node.
   *
   * Engine-level failures (unknown inputs, node exceptions) come back as
   * `ActionResult` with `status: "failed"`; HTTP-level failures throw
   * {@link BrowseraError}.
   */
  runNode<T = unknown>(
    actionId: ActionId,
    inputs: Inputs = {},
    config: Inputs = {},
    opts: RunNodeOptions = {},
  ): Promise<ActionResult<T>> {
    const { label, ...req } = opts;
    return this.#request<ActionResult<T>>("POST", "/run-node", {
      json: { actionId, label, inputs, config },
      opts: req,
    });
  }

  /** POST /run-multiple-nodes — run nodes sequentially, preserving order. */
  runNodes(
    nodes: WorkflowNode[],
    opts?: RequestOpts,
  ): Promise<RunNodesResponse> {
    return this.#request<RunNodesResponse>("POST", "/run-multiple-nodes", {
      json: { nodes },
      opts,
    });
  }

  /** POST /actions/execute — alias of {@link runNode} with the registry route. */
  execute<T = unknown>(
    actionId: ActionId,
    inputs: Inputs = {},
    config: Inputs = {},
    opts?: RequestOpts,
  ): Promise<ActionResult<T>> {
    return this.#request<ActionResult<T>>("POST", "/actions/execute", {
      json: { actionId, inputs, config },
      opts,
    });
  }

  async #pdfToMarkdown(
    file: BinaryFile,
    opts: PdfToMarkdownOptions = {},
  ): Promise<ActionResult<string>> {
    const blob =
      file instanceof Blob
        ? file
        : new Blob([file as BlobPart], { type: "application/pdf" });

    const form = new FormData();
    form.append("file", blob, opts.filename ?? "document.pdf");
    form.append("maxChars", String(opts.maxChars ?? 30000));
    form.append("returnMarkdown", String(opts.returnMarkdown ?? true));
    form.append("useOCR", String(opts.useOCR ?? false));
    form.append("ocrMaxPages", String(opts.ocrMaxPages ?? 5));

    const { signal, timeoutMs, headers } = opts;
    return this.#request<ActionResult<string>>(
      "POST",
      "/pdf/upload-to-markdown",
      { form, opts: { signal, timeoutMs, headers } },
    );
  }

  async #request<T>(
    method: string,
    path: string,
    init: RequestInit_ = {},
  ): Promise<T> {
    const opts = init.opts ?? {};
    const timeoutMs = opts.timeoutMs ?? this.#timeoutMs;

    const controller = new AbortController();
    let timedOut = false;
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            controller.abort(
              new Error(`Request timed out after ${timeoutMs}ms`),
            );
          }, timeoutMs)
        : undefined;

    const external = opts.signal;
    const onExternalAbort = () =>
      controller.abort(external?.reason ?? new Error("Aborted"));
    if (external) {
      if (external.aborted) onExternalAbort();
      else external.addEventListener("abort", onExternalAbort, { once: true });
    }

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...this.#headers,
        ...opts.headers,
      };
      if (this.#token) headers.Authorization = `Bearer ${this.#token}`;

      let body: BodyInit | undefined;
      if (init.json !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(init.json);
      } else if (init.form) {
        body = init.form as unknown as BodyInit;
      }

      let response: Response;
      try {
        response = await this.#fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          body,
          signal: controller.signal,
        });
      } catch (err) {
        if (timedOut) {
          throw new BrowseraError(
            `Request timed out after ${timeoutMs}ms: ${method} ${path}`,
            { status: 0 },
          );
        }
        throw err;
      }

      return await this.#parse<T>(response);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    }
  }

  async #parse<T>(response: Response): Promise<T> {
    const text = await response.text();
    let body: unknown;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!response.ok) {
      const detail =
        body !== null && typeof body === "object" && "detail" in body
          ? (body as { detail: unknown }).detail
          : undefined;
      const message =
        typeof detail === "string" && detail
          ? detail
          : `Request failed with status ${response.status}`;
      throw new BrowseraError(message, {
        status: response.status,
        detail,
        body,
      });
    }

    return body as T;
  }
}
