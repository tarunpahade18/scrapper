/** Arbitrary inputs/config passed to an action node. */
export type Inputs = Record<string, unknown>;

/**
 * Every action id registered in the engine (`backend/engine/registry.py`).
 * Custom/unknown ids are still allowed so the SDK stays forward-compatible.
 */
export type ActionId =
  // cleaning
  | "dropColumn"
  | "renameColumn"
  | "selectColumns"
  | "addConstantColumn"
  | "replaceString"
  | "searchString"
  | "filterString"
  | "splitString"
  | "sortData"
  | "removeDuplicates"
  | "removeEmptyRows"
  | "knnImputation"
  | "findDifference"
  | "outliers"
  | "columnShift"
  // datasources
  | "addDatabase"
  | "addMysqlDb"
  | "addSqlServerDb"
  | "loadCSV"
  | "loadExcel"
  | "loadJsonFile"
  | "loadTxtFile"
  | "saveCSV"
  | "saveExcel"
  | "saveJsonFile"
  | "saveTxtFile"
  | "getApiRest"
  | "postApiRest"
  | "dataframeToList"
  | "listToDataframe"
  // webscraping
  | "openBrowser"
  | "loadWebsite"
  | "refreshPageSource"
  | "click"
  | "clickId"
  | "clickName"
  | "clickXPath"
  | "write"
  | "useKey"
  | "wait"
  | "scanWebPage"
  | "extractXPath"
  | "extractMultipleXPaths"
  | "getCurrentUrl"
  | "closeBrowser"
  | "solveAndPaginateHtml"
  | "solveCaptcha"
  | "solveOpenSourceCaptcha"
  // control
  | "addVariable"
  // databases
  | "connectMongo"
  | "insertMongo"
  | "deleteMongo"
  | "connectMilvus"
  | "insertMilvus"
  | "deleteMilvus"
  // integrations
  | "fetchText"
  | "analyzeSite"
  | "pdfTomarkdown"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | (string & {});

export interface ActionSuccess<T = unknown> {
  status: "success";
  actionId: string;
  result: T;
}

export interface ActionFailure {
  status: "failed";
  actionId: string;
  error: string;
}

/** Envelope returned by `/run-node`, `/run-multiple-nodes`, `/actions/execute`. */
export type ActionResult<T = unknown> = ActionSuccess<T> | ActionFailure;

export function isSuccess<T>(r: ActionResult<T>): r is ActionSuccess<T> {
  return r.status === "success";
}

export function isFailure(r: ActionResult): r is ActionFailure {
  return r.status === "failed";
}

export interface RunNodeOptions {
  /** Optional label echoed back for tracing. */
  label?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface RequestOpts {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/** A node as consumed by `/run-multiple-nodes`. */
export interface WorkflowNode {
  id: string;
  actionTemplateId: ActionId;
  type?: string;
  variant?: string;
  label?: string;
  icon?: string;
  x?: number;
  y?: number;
  inputs?: Inputs;
  config?: Inputs;
  meta?: Inputs;
  [key: string]: unknown;
}

export interface NodeRunResult {
  nodeId: string;
  status: "success" | "failed";
  result?: ActionResult;
  error?: string;
}

export interface RunNodesResponse {
  results: NodeRunResult[];
}

export interface WorkflowSummary {
  id: string;
  name: string;
  nodeCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SaveWorkflowInput {
  /** Existing workflow id to overwrite; omit to create a new workflow. */
  workflowId?: string;
  name: string;
  nodes: WorkflowNode[];
}

export interface AuthSession {
  access_token: string;
  token_type: string;
}

export interface HealthResponse {
  status: string;
}

export interface PdfToMarkdownOptions {
  /** Optional filename used for the multipart upload. Defaults to `document.pdf`. */
  filename?: string;
  /** Max characters of extracted text returned. Default 30000. */
  maxChars?: number;
  /** Return markdown text instead of the raw result. Default true. */
  returnMarkdown?: boolean;
  /** Run OCR on scanned pages. Default false. */
  useOCR?: boolean;
  /** Max pages to OCR. Default 5. */
  ocrMaxPages?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface BrowseraClientOptions {
  /** Base URL of the Scrapper backend. Default `http://localhost:8000`. */
  baseUrl?: string;
  /** Bearer token used for authenticated routes (workflows). */
  token?: string;
  /** Custom fetch implementation (e.g. undici, node-fetch, proxies). */
  fetch?: FetchLike;
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
  /** Default request timeout in milliseconds. Default 30000. */
  timeoutMs?: number;
}
