// @vitest-environment happy-dom

import { create } from '@bufbuild/protobuf';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runs } from '../../src/api/modules/runs';
import {
  AnyValueSchema,
  KeyValueSchema,
  type KeyValue,
} from '../../src/gen/opentelemetry/proto/common/v1/common_pb';
import { ResourceSchema } from '../../src/gen/opentelemetry/proto/resource/v1/resource_pb';
import {
  ResourceSpansSchema,
  ScopeSpansSchema,
  SpanSchema,
  Span_SpanKind,
  type ResourceSpans,
} from '../../src/gen/opentelemetry/proto/trace/v1/trace_pb';

const { listSpansMock, getTraceSummaryMock } = vi.hoisted(() => ({
  listSpansMock: vi.fn(),
  getTraceSummaryMock: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  tracingClient: {
    listSpans: listSpansMock,
    getTraceSummary: getTraceSummaryMock,
  },
}));

const TRACE_ID = Uint8Array.from({ length: 16 }, (_, idx) => idx + 1);
const MESSAGE_SPAN_ID = Uint8Array.from([0x43, 0xb1, 0x08, 0xa6, 0x15, 0x24, 0x47, 0x0b]);
const LIFECYCLE_TRACE_ID = Uint8Array.from({ length: 16 }, () => 0xaa);
const WORK_TRACE_ID = Uint8Array.from({ length: 16 }, () => 0xbb);

const stringAttr = (key: string, value: string): KeyValue =>
  create(KeyValueSchema, {
    key,
    value: create(AnyValueSchema, { value: { case: 'stringValue', value } }),
  });

function resourceSpansWithInvocationMessage(): ResourceSpans {
  return create(ResourceSpansSchema, {
    resource: create(ResourceSchema, {
      attributes: [stringAttr('agyn.thread.id', 'thread-123')],
    }),
    scopeSpans: [
      create(ScopeSpansSchema, {
        spans: [
          create(SpanSchema, {
            traceId: TRACE_ID,
            spanId: MESSAGE_SPAN_ID,
            parentSpanId: new Uint8Array(8),
            name: 'invocation.message',
            kind: Span_SpanKind.INTERNAL,
            startTimeUnixNano: 1_700_000_000_000_000_000n,
            endTimeUnixNano: 1_700_000_000_500_000_000n,
            attributes: [stringAttr('agyn.message.text', 'hello')],
          }),
        ],
      }),
    ],
  });
}

// The lifecycle trace holds the newest span; the work trace holds the run.
function resourceSpansAcrossTraces(): ResourceSpans {
  const span = (traceId: Uint8Array, spanId: number, name: string, startUnixNano: bigint) =>
    create(SpanSchema, {
      traceId,
      spanId: Uint8Array.from({ length: 8 }, () => spanId),
      parentSpanId: new Uint8Array(8),
      name,
      kind: Span_SpanKind.INTERNAL,
      startTimeUnixNano: startUnixNano,
      endTimeUnixNano: startUnixNano + 1_000_000n,
    });

  return create(ResourceSpansSchema, {
    resource: create(ResourceSchema, {
      attributes: [stringAttr('agyn.thread.id', 'thread-123')],
    }),
    scopeSpans: [
      create(ScopeSpansSchema, {
        spans: [
          span(LIFECYCLE_TRACE_ID, 0x01, 'op.dispatch.shutdown', 2_000_000_000_000_000_000n),
          span(LIFECYCLE_TRACE_ID, 0x02, 'session_loop', 1_000_000_000_000_000_000n),
          span(WORK_TRACE_ID, 0x03, 'run_turn', 1_500_000_000_000_000_000n),
          span(WORK_TRACE_ID, 0x04, 'stream_request', 1_500_000_001_000_000_000n),
          span(WORK_TRACE_ID, 0x05, 'handle_responses', 1_500_000_002_000_000_000n),
        ],
      }),
    ],
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('runs.findRunByMessageId', () => {
  afterEach(() => {
    listSpansMock.mockReset();
    getTraceSummaryMock.mockReset();
  });

  it('falls back to invocation span id matching when message id correlation is missing', async () => {
    listSpansMock
      .mockResolvedValueOnce({ resourceSpans: [] })
      .mockResolvedValueOnce({ resourceSpans: [resourceSpansWithInvocationMessage()] });

    const run = await runs.findRunByMessageId('org-123', '43b108a61524470b');

    expect(run).toEqual({ runId: '0102030405060708090a0b0c0d0e0f10' });
    expect(listSpansMock).toHaveBeenNthCalledWith(1, {
      organizationId: 'org-123',
      filter: { messageId: '43b108a61524470b' },
      pageSize: 500,
      pageToken: '',
      orderBy: 1,
    });
    expect(listSpansMock).toHaveBeenNthCalledWith(2, {
      organizationId: 'org-123',
      pageSize: 500,
      pageToken: '',
      orderBy: 1,
    });
  });

  it('prefers the trace carrying the run over the session-lifecycle trace', async () => {
    listSpansMock.mockResolvedValueOnce({
      resourceSpans: [resourceSpansAcrossTraces()],
    });

    const run = await runs.findRunByMessageId('org-123', '43b108a61524470b');

    expect(run).toEqual({ runId: bytesToHex(WORK_TRACE_ID) });
  });
});
