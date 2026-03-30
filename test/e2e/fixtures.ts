import { Buffer } from 'node:buffer';
import { test as base, type Page, type Route } from '@playwright/test';
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

type AttributeJson = {
  key: string;
  value: {
    stringValue?: string;
    intValue?: string;
    doubleValue?: number;
  };
};

type SpanJson = {
  traceId: string;
  spanId: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: AttributeJson[];
  status: {
    code: number;
  };
  events?: Array<{
    name: string;
    timeUnixNano: string;
    attributes: AttributeJson[];
  }>;
};

type ResourceSpansJson = {
  resource: {
    attributes: AttributeJson[];
  };
  scopeSpans: Array<{
    scope: {
      name: string;
    };
    spans: SpanJson[];
  }>;
};

const traceIdBase64 = toBase64(runContext.runId);
const baseTimeNs = 1700000000000000000n;
const spanDurationNs = 500000000n;

const spans: SpanJson[] = [
  buildSpan({
    spanId: messageEvent.id,
    name: 'invocation.message',
    startNs: baseTimeNs + 1_000_000_000n,
    endNs: baseTimeNs + 1_000_000_000n + spanDurationNs,
    attributes: [
      stringAttr('agyn.message.text', messageEvent.messageText ?? ''),
      stringAttr('agyn.message.role', 'user'),
      stringAttr('agyn.message.kind', 'source'),
    ],
  }),
  buildSpan({
    spanId: llmEvent.id,
    name: 'llm.call',
    startNs: baseTimeNs + 2_000_000_000n,
    endNs: baseTimeNs + 2_000_000_000n + spanDurationNs,
    attributes: [
      stringAttr('agyn.llm.provider', 'openai'),
      stringAttr('agyn.llm.model', 'gpt-4'),
      stringAttr('agyn.llm.response', llmEvent.responseText ?? ''),
      intAttr('agyn.llm.input_tokens', 10),
      intAttr('agyn.llm.output_tokens', 20),
      intAttr('agyn.llm.total_tokens', 30),
    ],
  }),
  buildSpan({
    spanId: toolEvent.id,
    name: 'tool.execution',
    startNs: baseTimeNs + 3_000_000_000n,
    endNs: baseTimeNs + 3_000_000_000n + spanDurationNs,
    attributes: [
      stringAttr('agyn.tool.name', toolEvent.toolName ?? 'tool'),
      stringAttr('agyn.tool.input', JSON.stringify({ command: 'pnpm install', cwd: '/workspace' })),
      stringAttr('agyn.tool.output', JSON.stringify(toolEvent.outputText ?? '')),
    ],
  }),
  buildSpan({
    spanId: summarizationEvent.id,
    name: 'summarization',
    startNs: baseTimeNs + 4_000_000_000n,
    endNs: baseTimeNs + 4_000_000_000n + spanDurationNs,
    attributes: [
      stringAttr('agyn.summary.text', 'Summary completed.'),
      intAttr('agyn.summary.new_context_count', 1),
      intAttr('agyn.summary.old_context_tokens', 5),
    ],
  }),
];

const baseResourceAttributes = [stringAttr('agyn.thread.id', runContext.threadId)];

const resourceSpans = buildResourceSpans(spans);
const spanById = new Map(spans.map((span) => [span.spanId, span]));

const traceSummaryResponse = {
  traceId: traceIdBase64,
  status: 1,
  firstSpanStartTime: (baseTimeNs + 1_000_000_000n).toString(),
  lastSpanStartTime: (baseTimeNs + 4_000_000_000n).toString(),
  lastSpanEndTime: (baseTimeNs + 4_000_000_000n + spanDurationNs).toString(),
  countsByName: {
    'invocation.message': '1',
    'llm.call': '1',
    'tool.execution': '1',
    summarization: '1',
  },
  countsByStatus: {
    SPAN_STATUS_OK: '4',
  },
  totalSpans: '4',
};

const spanTotalsResponse = {
  spanCount: '4',
  tokenUsage: {
    inputTokens: '10',
    outputTokens: '20',
    cacheReadInputTokens: '0',
    reasoningTokens: '0',
    totalTokens: '30',
  },
};

export const test = base.extend<Record<string, never>>({
  page: async ({ page }, run) => {
    await setupTracingMocks(page);
    await run(page);
  },
});
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

function toBase64(hexValue: string): string {
  return Buffer.from(hexValue, 'hex').toString('base64');
}

function stringAttr(key: string, value: string): AttributeJson {
  return { key, value: { stringValue: value } };
}

function intAttr(key: string, value: number): AttributeJson {
  return { key, value: { intValue: value.toString() } };
}

function buildSpan(params: {
  spanId: string;
  name: string;
  startNs: bigint;
  endNs: bigint;
  attributes: AttributeJson[];
}): SpanJson {
  return {
    traceId: traceIdBase64,
    spanId: toBase64(params.spanId),
    name: params.name,
    startTimeUnixNano: params.startNs.toString(),
    endTimeUnixNano: params.endNs.toString(),
    attributes: params.attributes,
    status: { code: 1 },
  };
}

function buildResourceSpans(spansToInclude: SpanJson[]): ResourceSpansJson[] {
  return [
    {
      resource: {
        attributes: baseResourceAttributes,
      },
      scopeSpans: [
        {
          scope: { name: 'e2e' },
          spans: spansToInclude,
        },
      ],
    },
  ];
}

function parseRequestBody(route: Route): Record<string, unknown> {
  const payload = route.request().postData();
  if (!payload) return {};
  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function respondJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function handleTracingRoute(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const method = url.pathname.split('/').pop();

  switch (method) {
    case 'GetTraceSummary':
      await respondJson(route, traceSummaryResponse);
      return;
    case 'ListSpans':
      await respondJson(route, { resourceSpans, nextPageToken: '' });
      return;
    case 'GetTraceSpanTotals':
      await respondJson(route, spanTotalsResponse);
      return;
    case 'GetSpan': {
      const body = parseRequestBody(route);
      const spanId = typeof body.spanId === 'string' ? body.spanId : null;
      const span = spanId ? spanById.get(spanId) : undefined;
      const responseResourceSpans = span ? buildResourceSpans([span]) : [];
      await respondJson(route, { resourceSpans: responseResourceSpans });
      return;
    }
    default:
      await route.fulfill({ status: 404, body: 'Not Found' });
  }
}

async function setupTracingMocks(page: Page): Promise<void> {
  await page.route('**/agynio.api.gateway.v1.TracingGateway/*', handleTracingRoute);
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
