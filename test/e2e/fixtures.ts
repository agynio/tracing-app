import { test as base } from '@playwright/test';
import {
  llmEvent,
  messageEvent,
  runContext,
  runEvents,
  runSummary,
  summarizationEvent,
  timelineForEvent,
  toolEvent,
  toolOutputSnippet,
  type RunContext,
  type RunEventSummary,
  type RunSummary,
} from './mock-data';

export const test = base.extend<Record<string, never>>({});
export { expect } from '@playwright/test';

export type { RunContext, RunEventSummary, RunSummary };
export {
  llmEvent,
  messageEvent,
  runContext,
  runEvents,
  runSummary,
  summarizationEvent,
  timelineForEvent,
  toolEvent,
  toolOutputSnippet,
};

export function formatSnippet(value: string | null | undefined): string | null {
  if (!value) return null;
  const lines = value.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}
