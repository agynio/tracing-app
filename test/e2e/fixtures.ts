import { test as base } from '@playwright/test';
import { mockRunEvents } from '../../src/api/mock-data/events';
import { mockRunSummary } from '../../src/api/mock-data/run-summary';
import { mockToolOutputSnapshot } from '../../src/api/mock-data/tool-output';
import { DEFAULT_RUN_ID, DEFAULT_THREAD_ID } from '../../src/api/mock-data/store';
import type { RunTimelineEvent } from '../../src/api/types/agents';

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

export const runContext: RunContext = { threadId: DEFAULT_THREAD_ID, runId: DEFAULT_RUN_ID };
export const runSummary: RunSummary = { status: mockRunSummary.status };

function asString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function compareEvents(a: RunTimelineEvent, b: RunTimelineEvent): number {
  const timeDiff = parseTimestamp(a.ts) - parseTimestamp(b.ts);
  if (timeDiff !== 0) return timeDiff;
  const lexical = a.ts.localeCompare(b.ts);
  if (lexical !== 0) return lexical;
  return a.id.localeCompare(b.id);
}

function parseRunEvent(event: RunTimelineEvent): RunEventSummary {
  const summary: RunEventSummary = { id: event.id, type: event.type };

  if (event.type === 'tool_execution' && event.toolExecution) {
    summary.toolName = asString(event.toolExecution.toolName) ?? undefined;
    summary.outputText = formatValue(event.toolExecution.output ?? event.toolExecution.raw) ?? undefined;
  }

  if ((event.type === 'invocation_message' || event.type === 'injection') && event.message) {
    summary.messageText = asString(event.message.text) ?? undefined;
  }

  if (event.type === 'llm_call' && event.llmCall) {
    summary.responseText = asString(event.llmCall.responseText) ?? undefined;
  }

  return summary;
}

const parsedEvents = [...mockRunEvents].sort(compareEvents).map(parseRunEvent);
export const runEvents: RunEventSummary[] = [...parsedEvents].reverse();

function requireEvent(types: string[], label: string): RunEventSummary {
  const event = runEvents.find((entry) => types.includes(entry.type));
  if (!event) {
    throw new Error(`No ${label} events available in mock data.`);
  }
  return event;
}

export const llmEvent = requireEvent(['llm_call'], 'LLM Call');
export const toolEvent = requireEvent(['tool_execution'], 'Tool Execution');
export const messageEvent = requireEvent(['invocation_message', 'injection'], 'Message');

const toolOutputSnippet = (() => {
  const items = mockToolOutputSnapshot.items ?? [];
  for (const item of items) {
    const snippet = formatSnippet(asString(item.data));
    if (snippet) return snippet;
  }
  const terminal = mockToolOutputSnapshot.terminal;
  const fallback = terminal ? formatSnippet(asString(terminal.message)) : null;
  if (!fallback) {
    throw new Error('No tool output available for mock data.');
  }
  return fallback;
})();

export { toolOutputSnippet };

if (runEvents.length === 0) {
  throw new Error('No timeline events available in mock data.');
}

export const timelineForEvent = (context: RunContext, eventId: string) =>
  `/agents/threads/${context.threadId}/runs/${context.runId}/timeline?eventId=${encodeURIComponent(eventId)}&follow=false`;
