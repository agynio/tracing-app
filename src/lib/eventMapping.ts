import type { RunEventStatus, RunStatus, RunTimelineEvent } from '@/api/types/agents';
import type { RunEvent as UiRunEvent } from '@/components/RunEventsList';
import type { Status } from '@/components/StatusIndicator';
import { formatDuration } from '@/components/agents/runTimelineFormatting';
import { coerceRecord, isNonEmptyString, parseMaybeJson, toRecordArray } from '@/lib/llmContext';
import { extractTextFromRawResponse, inferToolSubtype, type ToolLinkData } from '@/lib/toolDataParsing';

type CreateUiEventOptions = {
  context?: Record<string, unknown>[];
  assistant?: Record<string, unknown>[];
  tool?: ToolLinkData;
};

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

export function mapEventStatus(status: RunEventStatus): Status {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'running':
      return 'running';
    case 'success':
      return 'finished';
    case 'error':
      return 'failed';
    case 'cancelled':
      return 'terminated';
    default:
      return assertNever(status);
  }
}

export function mapRunStatus(status: RunStatus | undefined): Status {
  if (!status) return 'running';
  switch (status) {
    case 'running':
      return 'running';
    case 'finished':
      return 'finished';
    case 'terminated':
      return 'terminated';
    default:
      return assertNever(status);
  }
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function formatDurationLabel(ms: number | null): string | undefined {
  if (ms === null || ms === undefined) return undefined;
  const label = formatDuration(ms);
  return label === '—' ? undefined : label;
}

export function extractLlmResponse(event: RunTimelineEvent): string {
  if (isNonEmptyString(event.errorMessage)) {
    return event.errorMessage;
  }

  const llmCall = event.llmCall;
  if (!llmCall) return '';

  const responseText = llmCall.responseText;
  if (isNonEmptyString(responseText)) return responseText;

  const rawResponse = llmCall.rawResponse;
  if (rawResponse && typeof rawResponse === 'object') {
    const messageCandidate = (rawResponse as { message?: unknown }).message;
    const messageText = extractTextFromRawResponse(messageCandidate);
    if (isNonEmptyString(messageText)) return messageText;
  }

  const rawText = extractTextFromRawResponse(rawResponse);
  if (isNonEmptyString(rawText)) return rawText;

  if (Array.isArray(event.attachments)) {
    for (const attachment of event.attachments) {
      if (!attachment || attachment.kind !== 'response') continue;

      const candidates: unknown[] = [];
      if (attachment.contentText !== undefined && attachment.contentText !== null) {
        const parsedText = typeof attachment.contentText === 'string'
          ? parseMaybeJson(attachment.contentText)
          : attachment.contentText;
        candidates.push(parsedText);
      }
      if (attachment.contentJson !== undefined && attachment.contentJson !== null) {
        const parsedJson = typeof attachment.contentJson === 'string'
          ? parseMaybeJson(attachment.contentJson)
          : attachment.contentJson;
        candidates.push(parsedJson);
      }

      for (const candidate of candidates) {
        const text = extractTextFromRawResponse(candidate);
        if (isNonEmptyString(text)) return text;
      }
    }
  }

  return '';
}

export function createUiEvent(event: RunTimelineEvent, options?: CreateUiEventOptions): UiRunEvent {
  const timestamp = formatTimestamp(event.ts);
  const duration = formatDurationLabel(event.durationMs);
  const status = mapEventStatus(event.status);

  switch (event.type) {
    case 'invocation_message':
      return {
        id: event.id,
        type: 'message',
        timestamp,
        duration,
        status,
        data: {
          messageSubtype: 'source',
          content: event.message?.text ?? '',
        },
      };
    case 'injection': {
      const reason = event.injection?.reason ?? '';
      const details = event.injection?.messageIds?.length
        ? `Messages: ${event.injection.messageIds.join(', ')}`
        : '';
      const content = [reason, details].filter(Boolean).join('\n');
      return {
        id: event.id,
        type: 'message',
        timestamp,
        duration,
        status,
        data: {
          messageSubtype: 'intermediate',
          content,
        },
      };
    }
    case 'llm_call': {
      const usage = event.llmCall?.usage;
      const fallbackContext = toRecordArray(event.metadata);
      const hasCustomContext = options?.context !== undefined;
      const context = hasCustomContext ? options?.context ?? [] : fallbackContext;
      const assistantContext = options?.assistant ?? [];
      const response = extractLlmResponse(event);
      return {
        id: event.id,
        type: 'llm',
        timestamp,
        duration,
        status,
        data: {
          context,
          response,
          assistantContext,
          provider: event.llmCall?.provider ?? undefined,
          model: event.llmCall?.model ?? undefined,
          contextDeltaStatus: event.llmCall?.contextDeltaStatus,
          tokens: usage
            ? {
                input: usage.inputTokens ?? undefined,
                cached: usage.cachedInputTokens ?? undefined,
                output: usage.outputTokens ?? undefined,
                reasoning: usage.reasoningTokens ?? undefined,
                total: usage.totalTokens ?? undefined,
              }
            : undefined,
          toolCalls: event.llmCall?.toolCalls,
          rawResponse: event.llmCall?.rawResponse,
        },
      };
    }
    case 'tool_execution': {
      const rawInput = event.toolExecution?.input;
      const rawOutput = event.toolExecution?.output ?? event.toolExecution?.raw;
      const normalizedInput = options?.tool?.input ?? rawInput;
      const normalizedOutput = options?.tool?.output ?? rawOutput;
      const inputRecord = coerceRecord(normalizedInput);
      const runId = options?.tool?.runId ?? options?.tool?.childRunId;
      const subthreadId = options?.tool?.subthreadId;
      const threadId = options?.tool?.threadId ?? options?.tool?.childThreadId ?? options?.tool?.subthreadId;
      const childThreadId = options?.tool?.childThreadId ?? options?.tool?.threadId ?? options?.tool?.subthreadId;
      const childRunId = options?.tool?.childRunId ?? options?.tool?.runId;

      return {
        id: event.id,
        type: 'tool',
        timestamp,
        duration,
        status,
        data: {
          toolName: event.toolExecution?.toolName,
          toolSubtype: inferToolSubtype(event.toolExecution?.toolName, normalizedInput),
          input: normalizedInput,
          output: normalizedOutput,
          command: (inputRecord?.command as string | undefined) ?? undefined,
          workingDir: (inputRecord?.cwd as string | undefined) ?? undefined,
          message: (inputRecord?.message as string | undefined) ?? undefined,
          worker: (inputRecord?.worker as string | undefined) ?? undefined,
          threadAlias: (inputRecord?.threadAlias as string | undefined) ?? undefined,
          threadId,
          runId,
          subthreadId,
          childThreadId,
          childRunId,
          tool_result: normalizedOutput,
          errorMessage: event.toolExecution?.errorMessage ?? undefined,
        },
      };
    }
    case 'summarization': {
      const metadataRecord = coerceRecord(event.metadata);
      const oldContext = Array.isArray(metadataRecord?.oldContext) ? metadataRecord?.oldContext : [];
      const newContext = Array.isArray(metadataRecord?.newContext) ? metadataRecord?.newContext : [];
      return {
        id: event.id,
        type: 'summarization',
        timestamp,
        duration,
        status,
        data: {
          summary: event.summarization?.summaryText ?? '',
          oldContext,
          newContext,
        },
      };
    }
    default:
      return assertNever(event.type);
  }
}
