import { test as base, type APIRequestContext } from '@playwright/test';

export const test = base.extend<Record<string, never>>({});
export { expect } from '@playwright/test';

export type RunContext = {
  threadId: string;
  runId: string;
};

export type RunSummary = {
  status: string;
};

export type RunEventSummary = {
  id: string;
  type: string;
  toolName?: string;
  messageText?: string;
  responseText?: string;
  outputText?: string;
};

const BASE_URL = process.env.E2E_BASE_URL as string;

type QueryParams = Record<string, string | number | undefined>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getStringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
}

function parseItems(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value)) return [];
  return asArray(value.items).filter(isRecord);
}

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim().length > 0 ? value : null;
  try {
    const serialized = JSON.stringify(value, null, 2);
    return serialized.trim().length > 0 ? serialized : null;
  } catch {
    const serialized = String(value);
    return serialized.trim().length > 0 ? serialized : null;
  }
}

export function formatSnippet(value: string | null | undefined): string | null {
  if (!value) return null;
  const lines = value.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function fetchJson(request: APIRequestContext, path: string, params?: QueryParams): Promise<unknown | null> {
  try {
    const response = await request.get(buildUrl(path, params));
    if (!response.ok()) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchRunContext(request: APIRequestContext): Promise<RunContext | null> {
  const threadsData = await fetchJson(request, '/api/agents/threads');
  const threads = parseItems(threadsData);

  for (const thread of threads) {
    const threadId = getStringField(thread, ['id', 'threadId']);
    if (!threadId) continue;
    const runsData = await fetchJson(request, `/api/agents/threads/${encodeURIComponent(threadId)}/runs`);
    const runs = parseItems(runsData);
    const candidate = pickRun(runs, threadId);
    if (candidate) return candidate;
  }

  return null;
}

function pickRun(runs: Record<string, unknown>[], fallbackThreadId: string): RunContext | null {
  const candidates = runs
    .map((run) => {
      const runId = getStringField(run, ['id', 'runId']);
      if (!runId) return null;
      const threadId = getStringField(run, ['threadId']) ?? fallbackThreadId;
      const createdAt = asString(run.createdAt);
      const parsedCreatedAt = createdAt ? Date.parse(createdAt) : 0;
      const createdAtMs = Number.isNaN(parsedCreatedAt) ? 0 : parsedCreatedAt;
      return { runId, threadId, createdAtMs };
    })
    .filter((value): value is { runId: string; threadId: string; createdAtMs: number } => value !== null);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.createdAtMs - a.createdAtMs);
  return { runId: candidates[0].runId, threadId: candidates[0].threadId };
}

export async function fetchRunSummary(request: APIRequestContext, runId: string): Promise<RunSummary | null> {
  const data = await fetchJson(request, `/api/agents/runs/${encodeURIComponent(runId)}/summary`);
  if (!isRecord(data)) return null;
  const status = asString(data.status);
  if (!status) return null;
  return { status };
}

export async function fetchRunEvents(
  request: APIRequestContext,
  runId: string,
  options?: { types?: string[]; limit?: number; order?: 'asc' | 'desc' },
): Promise<RunEventSummary[]> {
  const data = await fetchJson(request, `/api/agents/runs/${encodeURIComponent(runId)}/events`, {
    limit: options?.limit ?? 50,
    order: options?.order ?? 'desc',
    types: options?.types && options.types.length > 0 ? options.types.join(',') : undefined,
  });
  const items = parseItems(data);
  return items
    .map((item) => parseRunEvent(item))
    .filter((value): value is RunEventSummary => value !== null);
}

function parseRunEvent(item: Record<string, unknown>): RunEventSummary | null {
  const id = asString(item.id);
  const type = asString(item.type);
  if (!id || !type) return null;
  const summary: RunEventSummary = { id, type };

  if (type === 'tool_execution' && isRecord(item.toolExecution)) {
    summary.toolName = asString(item.toolExecution.toolName) ?? undefined;
    summary.outputText = formatValue(item.toolExecution.output ?? item.toolExecution.raw) ?? undefined;
  }

  if ((type === 'invocation_message' || type === 'injection') && isRecord(item.message)) {
    summary.messageText = asString(item.message.text) ?? undefined;
  }

  if (type === 'llm_call' && isRecord(item.llmCall)) {
    summary.responseText = asString(item.llmCall.responseText) ?? undefined;
  }

  return summary;
}

export async function fetchToolOutputSnippet(
  request: APIRequestContext,
  runId: string,
  eventId: string,
): Promise<string | null> {
  const data = await fetchJson(request, `/api/agents/runs/${encodeURIComponent(runId)}/events/${encodeURIComponent(eventId)}/output`, {
    limit: 25,
    order: 'asc',
  });
  if (!isRecord(data)) return null;
  const items = asArray(data.items).filter(isRecord);
  for (const item of items) {
    const snippet = formatSnippet(asString(item.data));
    if (snippet) return snippet;
  }
  const terminal = isRecord(data.terminal) ? data.terminal : null;
  return terminal ? formatSnippet(asString(terminal.message)) : null;
}
