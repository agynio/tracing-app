import type { RunTimelineEvent } from '@/api/types/agents';
import { coerceRecord, isNonEmptyString, parseMaybeJson } from '@/lib/llmContext';

export type ToolSubtype = 'shell' | 'manage' | 'generic';

export type LinkTargets = {
  threadId?: string;
  subthreadId?: string;
  runId?: string;
  childThreadId?: string;
  childRunId?: string;
};

export type ToolLinkData = {
  input: unknown;
  output: unknown;
  threadId?: string;
  subthreadId?: string;
  runId?: string;
  childThreadId?: string;
  childRunId?: string;
};

function readStringPath(record: Record<string, unknown>, path: readonly string[]): string | undefined {
  let current: unknown = record;
  for (const segment of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return isNonEmptyString(current) ? current : undefined;
}

export function inferToolSubtype(toolName: string | undefined, input: unknown): ToolSubtype {
  const normalized = (toolName ?? '').toLowerCase();
  if (normalized.includes('memory')) {
    return 'generic';
  }
  if (normalized.includes('manage') || normalized.includes('delegate') || normalized.includes('call_agent')) {
    return 'manage';
  }
  if (normalized.includes('shell') || normalized.includes('exec')) {
    return 'shell';
  }
  const candidate = coerceRecord(input);
  if (candidate) {
    if (typeof candidate.command === 'string' && typeof candidate.worker === 'string') {
      return 'manage';
    }
    if (typeof candidate.command === 'string' && typeof candidate.cwd === 'string') {
      return 'shell';
    }
  }
  return 'generic';
}

export function extractLinkTargets(record: Record<string, unknown> | null): LinkTargets {
  if (!record) return {};

  const childRunRecord = coerceRecord(record.childRun);

  const directChildThreadId = readStringPath(record, ['childThreadId']) ?? readStringPath(record, ['child_thread_id']);
  const aliasChildThreadId =
    readStringPath(record, ['threadId']) ??
    readStringPath(record, ['thread_id']) ??
    readStringPath(record, ['subthreadId']) ??
    readStringPath(record, ['subthread_id']);
  const nestedChildThreadId =
    readStringPath(record, ['childThread', 'id']) ??
    readStringPath(record, ['child_thread', 'id']) ??
    readStringPath(record, ['thread', 'id']) ??
    readStringPath(record, ['thread', 'threadId']) ??
    readStringPath(record, ['thread', 'thread_id']);

  const directChildRunId = readStringPath(record, ['childRunId']) ?? readStringPath(record, ['child_run_id']);
  const aliasChildRunId = readStringPath(record, ['runId']) ?? readStringPath(record, ['run_id']);
  const nestedChildRunId =
    readStringPath(record, ['childRun', 'id']) ??
    readStringPath(record, ['child_run', 'id']) ??
    readStringPath(record, ['run', 'id']) ??
    readStringPath(record, ['run', 'runId']) ??
    readStringPath(record, ['run', 'run_id']) ??
    (childRunRecord ? readStringPath(childRunRecord, ['id']) : undefined);

  const subthreadId =
    readStringPath(record, ['subthreadId']) ??
    readStringPath(record, ['subthread_id']) ??
    readStringPath(record, ['subthread', 'id']) ??
    readStringPath(record, ['subthread', 'subthreadId']) ??
    readStringPath(record, ['subthread', 'subthread_id']);

  const threadId =
    readStringPath(record, ['threadId']) ??
    readStringPath(record, ['thread_id']) ??
    readStringPath(record, ['thread', 'id']) ??
    readStringPath(record, ['thread', 'threadId']) ??
    readStringPath(record, ['thread', 'thread_id']);

  const runId =
    readStringPath(record, ['runId']) ??
    readStringPath(record, ['run_id']) ??
    readStringPath(record, ['run', 'id']) ??
    readStringPath(record, ['run', 'runId']) ??
    readStringPath(record, ['run', 'run_id']);

  const childThreadId = directChildThreadId ?? aliasChildThreadId ?? nestedChildThreadId ?? subthreadId ?? threadId;
  const childRunId = directChildRunId ?? aliasChildRunId ?? nestedChildRunId ?? runId;

  return {
    threadId: threadId ?? childThreadId ?? undefined,
    subthreadId: subthreadId ?? undefined,
    runId: runId ?? childRunId ?? undefined,
    childThreadId: childThreadId ?? undefined,
    childRunId: childRunId ?? undefined,
  };
}

export function normalizeRecordWithTargets(record: Record<string, unknown> | null, targets: LinkTargets): Record<string, unknown> | null {
  if (!record) return null;
  let changed = false;
  const next: Record<string, unknown> = { ...record };

  const normalizedChildThreadId = targets.childThreadId ?? targets.threadId ?? targets.subthreadId;
  const normalizedChildRunId = targets.childRunId ?? targets.runId;

  if (targets.threadId && !isNonEmptyString(next.threadId)) {
    next.threadId = targets.threadId;
    changed = true;
  }
  if (targets.subthreadId && !isNonEmptyString(next.subthreadId)) {
    next.subthreadId = targets.subthreadId;
    changed = true;
  }
  if (targets.runId && !isNonEmptyString(next.runId)) {
    next.runId = targets.runId;
    changed = true;
  }
  if (normalizedChildThreadId && !isNonEmptyString(next.childThreadId)) {
    next.childThreadId = normalizedChildThreadId;
    changed = true;
  }
  if (normalizedChildRunId && !isNonEmptyString(next.childRunId)) {
    next.childRunId = normalizedChildRunId;
    changed = true;
  }

  return changed ? next : record;
}

export function extractTextFromRawResponse(raw: unknown): string | null {
  const visited = new WeakSet<object>();

  const extract = (value: unknown): string | null => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? value : null;
    }

    if (Array.isArray(value)) {
      const parts: string[] = [];
      for (const item of value) {
        const text = extract(item);
        if (typeof text === 'string' && text.length > 0) {
          parts.push(text);
        }
      }
      if (parts.length > 0) {
        return parts.join('\n\n');
      }
      return null;
    }

    const record = coerceRecord(value);
    if (!record) return null;
    if (visited.has(record)) return null;
    visited.add(record);

    const directKeys: Array<keyof typeof record> = ['content', 'text', 'output_text', 'outputText'];
    for (const key of directKeys) {
      if (key in record) {
        const text = extract(record[key]);
        if (typeof text === 'string' && text.length > 0) return text;
      }
    }

    if ('message' in record) {
      const text = extract((record as Record<string, unknown>).message);
      if (typeof text === 'string' && text.length > 0) return text;
    }

    if ('messages' in record) {
      const text = extract((record as Record<string, unknown>).messages);
      if (typeof text === 'string' && text.length > 0) return text;
    }

    const arrayKeys: Array<keyof typeof record> = ['choices', 'outputs', 'output', 'responses'];
    for (const key of arrayKeys) {
      if (Array.isArray(record[key])) {
        for (const entry of record[key] as unknown[]) {
          const text = extract(entry);
          if (typeof text === 'string' && text.length > 0) return text;
        }
      }
    }

    if ('delta' in record) {
      const text = extract((record as Record<string, unknown>).delta);
      if (typeof text === 'string' && text.length > 0) return text;
    }

    const nestedKeys: Array<keyof typeof record> = ['data', 'body', 'result', 'response', 'value'];
    for (const key of nestedKeys) {
      if (key in record) {
        const text = extract(record[key]);
        if (typeof text === 'string' && text.length > 0) return text;
      }
    }

    return null;
  };

  return extract(raw);
}

export function buildToolLinkData(event: RunTimelineEvent): ToolLinkData | undefined {
  const execution = event.toolExecution;
  if (!execution) return undefined;

  const rawInput = execution.input;
  const rawOutput = execution.output ?? execution.raw;
  const parsedInput = parseMaybeJson(rawInput);
  const parsedOutput = parseMaybeJson(rawOutput);
  const inputRecord = coerceRecord(parsedInput);
  const outputRecord = coerceRecord(parsedOutput);
  const metadataRecord = coerceRecord(event.metadata);

  const inputTargets = extractLinkTargets(inputRecord);
  const outputTargets = extractLinkTargets(outputRecord);
  const metadataTargets = extractLinkTargets(metadataRecord);

  const targets: LinkTargets = {
    threadId: metadataTargets.threadId ?? outputTargets.threadId ?? inputTargets.threadId,
    subthreadId: metadataTargets.subthreadId ?? outputTargets.subthreadId ?? inputTargets.subthreadId,
    runId: metadataTargets.runId ?? outputTargets.runId ?? inputTargets.runId,
    childThreadId: metadataTargets.childThreadId ?? outputTargets.childThreadId ?? inputTargets.childThreadId,
    childRunId: metadataTargets.childRunId ?? outputTargets.childRunId ?? inputTargets.childRunId,
  };

  const normalizedInputRecord = normalizeRecordWithTargets(inputRecord, targets);
  const normalizedOutputRecord = normalizeRecordWithTargets(outputRecord, targets);

  const normalizedInput = normalizedInputRecord ?? inputRecord ?? parsedInput;
  const normalizedOutput = normalizedOutputRecord ?? outputRecord ?? parsedOutput;

  return {
    input: normalizedInput,
    output: normalizedOutput,
    threadId: targets.threadId,
    subthreadId: targets.subthreadId,
    runId: targets.runId,
    childThreadId: targets.childThreadId ?? targets.threadId,
    childRunId: targets.childRunId ?? targets.runId,
  };
}
