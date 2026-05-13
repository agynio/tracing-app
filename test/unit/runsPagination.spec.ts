import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { runs } from '../../src/api/modules/runs';
import { SpanSchema, Span_SpanKind, StatusSchema, Status_StatusCode } from '../../src/gen/opentelemetry/proto/trace/v1/trace_pb';
import type { Span } from '../../src/gen/opentelemetry/proto/trace/v1/trace_pb';

const { listSpansMock } = vi.hoisted(() => ({
  listSpansMock: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  tracingClient: {
    listSpans: listSpansMock,
  },
}));

const TRACE_ID = Uint8Array.from({ length: 16 }, (_, idx) => idx);
const BASE_START = 1_700_000_000_000_000_000n;

const buildSpan = (name: string, index: number): Span =>
  create(SpanSchema, {
    traceId: TRACE_ID,
    spanId: Uint8Array.from({ length: 8 }, (_, idx) => idx + index),
    traceState: '',
    parentSpanId: new Uint8Array(8),
    flags: 0,
    name,
    kind: Span_SpanKind.INTERNAL,
    startTimeUnixNano: BASE_START + BigInt(index),
    endTimeUnixNano: BASE_START + BigInt(index + 1),
    attributes: [],
    droppedAttributesCount: 0,
    events: [],
    droppedEventsCount: 0,
    links: [],
    droppedLinksCount: 0,
    status: create(StatusSchema, { code: Status_StatusCode.OK, message: '' }),
  });

const resourceSpans = (spans: Span[]) => [
  {
    $typeName: 'opentelemetry.proto.trace.v1.ResourceSpans' as const,
    scopeSpans: [
      {
        $typeName: 'opentelemetry.proto.trace.v1.ScopeSpans' as const,
        spans,
        schemaUrl: '',
      },
    ],
    schemaUrl: '',
  },
];

describe('runs.timelineEvents unsupported pagination', () => {
  beforeEach(() => {
    listSpansMock.mockReset();
  });

  it('scans raw pages until it fills a filtered unsupported page', async () => {
    listSpansMock
      .mockResolvedValueOnce({
        resourceSpans: resourceSpans([buildSpan('llm.call', 1)]),
        nextPageToken: 'raw-page-2',
      })
      .mockResolvedValueOnce({
        resourceSpans: resourceSpans([buildSpan('unexpected.one', 2), buildSpan('unexpected.two', 3)]),
        nextPageToken: 'raw-page-3',
      });

    const response = await runs.timelineEvents('org-123', '000102030405060708090a0b0c0d0e0f', {
      types: 'unsupported',
      limit: 2,
      order: 'desc',
    });

    expect(response.items.map((event) => event.type)).toEqual(['unsupported', 'unsupported']);
    expect(response.nextCursor).toEqual({ ts: response.items[1].ts, id: response.items[1].id });
    expect(listSpansMock).toHaveBeenCalledTimes(2);
    expect(listSpansMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      organizationId: 'org-123',
      pageSize: 2,
      pageToken: '',
      filter: expect.not.objectContaining({ names: expect.anything() }),
    }));
    expect(listSpansMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      organizationId: 'org-123',
      pageSize: 2,
      pageToken: 'raw-page-2',
    }));
  });
});
