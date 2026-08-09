import { describe, expect, it } from 'vitest';
import { create } from '@bufbuild/protobuf';
import {
  bytesToHex,
  deriveEventStatus,
  hexToBytes,
  nanosToIso,
  spanToEvent,
} from '../../src/api/spanToEvent';
import {
  AnyValueSchema,
  KeyValueSchema,
  type KeyValue,
} from '../../src/gen/opentelemetry/proto/common/v1/common_pb';
import {
  SpanSchema,
  Span_SpanKind,
  StatusSchema,
  Status_StatusCode,
  type Span,
} from '../../src/gen/opentelemetry/proto/trace/v1/trace_pb';

const TRACE_ID = Uint8Array.from({ length: 16 }, (_, idx) => idx);
const PARENT_SPAN_ID = new Uint8Array(8);
const BASE_START = 1_700_000_000_000_000_000n;
const BASE_END = 1_700_000_000_500_000_000n;

const stringAttr = (key: string, value: string): KeyValue =>
  create(KeyValueSchema, {
    key,
    value: create(AnyValueSchema, { value: { case: 'stringValue', value } }),
  });

const intAttr = (key: string, value: number): KeyValue =>
  create(KeyValueSchema, {
    key,
    value: create(AnyValueSchema, { value: { case: 'intValue', value: BigInt(value) } }),
  });

const doubleAttr = (key: string, value: number): KeyValue =>
  create(KeyValueSchema, {
    key,
    value: create(AnyValueSchema, { value: { case: 'doubleValue', value } }),
  });

const threadAttr = stringAttr('agyn.thread.id', 'thread-123');

const buildSpan = (overrides: Partial<Span>): Span =>
  create(SpanSchema, {
    traceId: TRACE_ID,
    spanId: Uint8Array.from({ length: 8 }, (_, idx) => idx + 10),
    traceState: '',
    parentSpanId: PARENT_SPAN_ID,
    flags: 0,
    name: 'invocation.message',
    kind: Span_SpanKind.INTERNAL,
    startTimeUnixNano: BASE_START,
    endTimeUnixNano: BASE_END,
    attributes: [],
    droppedAttributesCount: 0,
    events: [],
    droppedEventsCount: 0,
    links: [],
    droppedLinksCount: 0,
    status: create(StatusSchema, { code: Status_StatusCode.OK, message: '' }),
    ...overrides,
  });

describe('spanToEvent utilities', () => {
  it('round-trips hex conversion', () => {
    const bytes = Uint8Array.from([0, 15, 16, 255]);
    const hex = bytesToHex(bytes);
    expect(hex).toBe('000f10ff');
    expect(bytesToHex(hexToBytes(hex))).toBe(hex);
  });

  it('formats nanos to ISO', () => {
    expect(nanosToIso(0n)).toBe('');
    const expected = new Date(Number(BASE_START / 1_000_000n)).toISOString();
    expect(nanosToIso(BASE_START)).toBe(expected);
  });

  it('derives event status from span', () => {
    const runningSpan = buildSpan({ endTimeUnixNano: 0n });
    const errorSpan = buildSpan({
      endTimeUnixNano: BASE_END,
      status: create(StatusSchema, { code: Status_StatusCode.ERROR, message: 'boom' }),
    });
    const successSpan = buildSpan({ endTimeUnixNano: BASE_END });

    expect(deriveEventStatus(runningSpan)).toBe('running');
    expect(deriveEventStatus(errorSpan)).toBe('error');
    expect(deriveEventStatus(successSpan)).toBe('success');
  });
});

describe('spanToEvent conversions', () => {
  it('maps LLM call spans', () => {
    const span = buildSpan({
      name: 'llm.call',
      attributes: [
        stringAttr('gen_ai.system', 'openai'),
        stringAttr('gen_ai.request.model', 'gpt-4'),
        doubleAttr('gen_ai.request.temperature', 0.2),
        doubleAttr('gen_ai.request.top_p', 0.9),
        stringAttr('gen_ai.response.finish_reason', 'stop'),
        stringAttr('agyn.llm.response_text', 'Hello!'),
        stringAttr(
          'agyn.llm.tool_calls',
          JSON.stringify([{ call_id: 'call-1', name: 'search', arguments: { query: 'hi' } }]),
        ),
        intAttr('gen_ai.usage.input_tokens', 2),
        intAttr('gen_ai.usage.output_tokens', 3),
      ],
    });

    const event = spanToEvent(span, [threadAttr]);

    expect(event.type).toBe('llm_call');
    expect(event.threadId).toBe('thread-123');
    expect(event.llmCall?.provider).toBe('openai');
    expect(event.llmCall?.model).toBe('gpt-4');
    expect(event.llmCall?.stopReason).toBe('stop');
    expect(event.llmCall?.responseText).toBe('Hello!');
    expect(event.llmCall?.usage?.totalTokens).toBe(5);
    expect(event.llmCall?.toolCalls).toEqual([
      { callId: 'call-1', name: 'search', arguments: { query: 'hi' } },
    ]);
  });

  it('maps tool execution spans', () => {
    const span = buildSpan({
      name: 'tool.execution',
      attributes: [
        stringAttr('agyn.tool.name', 'shell_command'),
        stringAttr('agyn.tool.call_id', 'tool-1'),
        stringAttr('agyn.tool.input', JSON.stringify({ command: 'ls' })),
        stringAttr('agyn.tool.output', JSON.stringify('ok')),
      ],
    });

    const event = spanToEvent(span, [threadAttr]);

    expect(event.type).toBe('tool_execution');
    expect(event.toolExecution?.toolName).toBe('shell_command');
    expect(event.toolExecution?.toolCallId).toBe('tool-1');
    expect(event.toolExecution?.execStatus).toBe('success');
    expect(event.toolExecution?.input).toEqual({ command: 'ls' });
    expect(event.toolExecution?.output).toBe('ok');
  });

  it('maps summarization spans', () => {
    const span = buildSpan({
      name: 'summarization',
      attributes: [
        stringAttr('agyn.summarization.text', 'Summary'),
        intAttr('agyn.summarization.new_context_count', 2),
        intAttr('agyn.summarization.old_context_tokens', 5),
      ],
    });

    const event = spanToEvent(span, [threadAttr]);

    expect(event.type).toBe('summarization');
    expect(event.summarization?.summaryText).toBe('Summary');
    expect(event.summarization?.newContextCount).toBe(2);
    expect(event.summarization?.oldContextTokens).toBe(5);
  });

  it('maps invocation message spans', () => {
    const spanId = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const span = buildSpan({
      name: 'invocation.message',
      spanId,
      attributes: [
        stringAttr('agyn.message.text', 'Hello'),
        stringAttr('agyn.message.role', 'user'),
        stringAttr('agyn.message.kind', 'source'),
      ],
    });

    const event = spanToEvent(span, [threadAttr]);

    expect(event.type).toBe('invocation_message');
    expect(event.message?.text).toBe('Hello');
    expect(event.message?.role).toBe('user');
    expect(event.message?.messageId).toBe(bytesToHex(spanId));
  });

  it('maps injection spans without extra payload', () => {
    const span = buildSpan({ name: 'injection' });
    const event = spanToEvent(span, [threadAttr]);

    expect(event.type).toBe('injection');
    expect(event.injection).toBeUndefined();
  });

  it('returns nulls for missing attributes', () => {
    const span = buildSpan({ name: 'llm.call', attributes: [] });
    const event = spanToEvent(span, [threadAttr]);

    expect(event.llmCall?.provider).toBeNull();
    expect(event.llmCall?.model).toBeNull();
    expect(event.llmCall?.toolCalls).toEqual([]);
  });

  it('handles zero timestamps', () => {
    const span = buildSpan({
      name: 'tool.execution',
      startTimeUnixNano: 0n,
      endTimeUnixNano: 0n,
    });

    const event = spanToEvent(span, [threadAttr]);

    expect(event.status).toBe('running');
    expect(event.startedAt).toBe('');
    expect(event.endedAt).toBeNull();
    expect(event.durationMs).toBeNull();
  });

  it('keeps unknown span names as raw span events', () => {
    const span = buildSpan({ name: 'unexpected.span' });
    const event = spanToEvent(span, [threadAttr], 'codex-app-server');

    expect(event.type).toBe('span');
    expect(event.span?.name).toBe('unexpected.span');
    expect(event.span?.scopeName).toBe('codex-app-server');
  });

  it('exposes span and resource attributes on raw span events', () => {
    const span = buildSpan({ name: 'op.dispatch.shutdown', attributes: [stringAttr('agyn.tool.name', 'shell')] });
    const event = spanToEvent(span, [threadAttr]);

    expect(event.span?.attributes['agyn.tool.name']).toBe('shell');
    expect(event.span?.resourceAttributes['agyn.thread.id']).toBe('thread-123');
  });
});
