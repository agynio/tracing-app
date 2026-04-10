import { Code, ConnectError, createClient, type Interceptor } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { createConnectTransport } from '@connectrpc/connect-web';
import { test as base, type Page } from '@playwright/test';
import { AgentsGateway } from '../../src/gen/agynio/api/gateway/v1/agents_pb';
import { LLMGateway } from '../../src/gen/agynio/api/gateway/v1/llm_pb';
import { OrganizationsGateway } from '../../src/gen/agynio/api/gateway/v1/organizations_pb';
import { ThreadsGateway } from '../../src/gen/agynio/api/gateway/v1/threads_pb';
import { TracingGateway } from '../../src/gen/agynio/api/gateway/v1/tracing_pb';
import { IdentityService, IdentityType } from '../../src/gen/agynio/api/identity/v1/identity_pb';
import { AuthMethod } from '../../src/gen/agynio/api/llm/v1/llm_pb';
import { ListSpansOrderBy, TraceStatus } from '../../src/gen/agynio/api/tracing/v1/tracing_pb';
import { bytesToHex, flattenResourceSpans, getStringAttr } from '../../src/api/spanToEvent';

const DEFAULT_TESTLLM_ENDPOINT = 'https://testllm.dev/v1/org/agynio/suite/codex/responses';
const DEFAULT_TESTLLM_MODEL = 'simple-hello';
const DEFAULT_AGENT_IMAGE = 'alpine:3.21';
const DEFAULT_INIT_IMAGE = 'ghcr.io/agynio/agent-init-codex:latest';
const SEED_MESSAGE_TEXT = 'hello';
const SEED_ENV_NAME = 'E2E_TRACING';
const SEED_ENV_VALUE = 'tracing-app';
const SEED_AGENT_ROLE = 'You are a helpful assistant.';
const SEED_RUN_TIMEOUT_MS = 180000;
const SPAN_START_GRACE_MS = 60000;

const SPAN_WAIT_TIMEOUT_MS = 120000;
const SPAN_WAIT_INTERVAL_MS = 2000;
const MESSAGE_WAIT_TIMEOUT_MS = 120000;
const TRACE_STATUS_WAIT_TIMEOUT_MS = 120000;

type E2EConfig = {
  gatewayBaseUrl: string;
  identityGrpcBaseUrl?: string;
  authToken: string;
  identityId: string;
  testllmEndpoint: string;
  testllmModel: string;
  initImage: string;
};

export type SeededRun = {
  threadId: string;
  runId: string;
  messageEventId: string;
  llmEventId: string;
  messageText: string;
  llmResponseText: string;
};

type GatewayClients = ReturnType<typeof createGatewayClients>;
type TracingClient = GatewayClients['tracingClient'];
type ThreadsClient = GatewayClients['threadsClient'];
type AgentsClient = GatewayClients['agentsClient'];
type ListSpansRequest = Parameters<TracingClient['listSpans']>[0];
type FlattenedSpan = ReturnType<typeof flattenResourceSpans>[number];

const config = resolveConfig();

const authInterceptor: Interceptor = (next) => async (req) => {
  req.header.set('Authorization', `Bearer ${config.authToken}`);
  return next(req);
};

export const test = base.extend<{ seededRun: SeededRun }>({
  seededRun: [
    async ({ browserName: _browserName }, runFixture) => {
      const seededRun = await seedTracingRun();
      await runFixture(seededRun);
    },
    { scope: 'worker', timeout: SEED_RUN_TIMEOUT_MS },
  ],
  page: async ({ page }, runFixture) => {
    await setupTracingProxy(page);
    await runFixture(page);
  },
});

export { expect } from '@playwright/test';

export const timelineForEvent = (context: SeededRun, eventId: string) =>
  `/agents/threads/${context.threadId}/runs/${context.runId}/timeline?eventId=${encodeURIComponent(eventId)}&follow=false`;

export function formatSnippet(value: string | null | undefined): string | null {
  if (!value) return null;
  const lines = value.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function resolveConfig(): E2EConfig {
  const identityBaseUrl = resolveOptionalEnv('E2E_IDENTITY_GRPC_BASE_URL');
  return {
    gatewayBaseUrl: normalizeBaseUrl(resolveRequiredEnv('E2E_GATEWAY_BASE_URL')),
    identityGrpcBaseUrl: identityBaseUrl ? normalizeBaseUrl(identityBaseUrl) : undefined,
    authToken: resolveRequiredEnv('E2E_AUTH_TOKEN'),
    identityId: resolveRequiredEnv('E2E_IDENTITY_ID'),
    testllmEndpoint: process.env.E2E_TESTLLM_ENDPOINT ?? DEFAULT_TESTLLM_ENDPOINT,
    testllmModel: process.env.E2E_TESTLLM_MODEL_REMOTE_NAME ?? DEFAULT_TESTLLM_MODEL,
    initImage: process.env.E2E_AGENT_INIT_IMAGE ?? DEFAULT_INIT_IMAGE,
  };
}

function resolveRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to run tracing-app e2e tests.`);
  }
  return value;
}

function resolveOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  const normalized = url.toString();
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function createGatewayClients() {
  const transport = createConnectTransport({
    baseUrl: config.gatewayBaseUrl,
    interceptors: [authInterceptor],
  });

  return {
    organizationsClient: createClient(OrganizationsGateway, transport),
    llmClient: createClient(LLMGateway, transport),
    agentsClient: createClient(AgentsGateway, transport),
    threadsClient: createClient(ThreadsGateway, transport),
    tracingClient: createClient(TracingGateway, transport),
  };
}

async function seedTracingRun(): Promise<SeededRun> {
  await ensureIdentityRegistered(config.identityId);
  const { organizationsClient, llmClient, agentsClient, threadsClient, tracingClient } = createGatewayClients();

  const now = Date.now();
  const orgResp = await organizationsClient.createOrganization({
    name: `e2e-tracing-org-${now}`,
  });
  const organizationId = requireString(orgResp.organization?.id, 'CreateOrganization response missing id');

  const providerResp = await llmClient.createLLMProvider({
    endpoint: config.testllmEndpoint,
    authMethod: AuthMethod.BEARER,
    token: 'unused',
    organizationId,
  });
  const providerId = requireString(providerResp.provider?.meta?.id, 'CreateLLMProvider response missing id');

  const modelResp = await llmClient.createModel({
    name: `e2e-tracing-model-${now}`,
    llmProviderId: providerId,
    remoteName: config.testllmModel,
    organizationId,
  });
  const modelId = requireString(modelResp.model?.meta?.id, 'CreateModel response missing id');

  const agentResp = await agentsClient.createAgent({
    name: `e2e-tracing-agent-${now}`,
    role: SEED_AGENT_ROLE,
    model: modelId,
    description: 'Tracing app E2E agent using TestLLM',
    configuration: '{}',
    image: DEFAULT_AGENT_IMAGE,
    initImage: config.initImage,
    organizationId,
  });
  const agentId = requireString(agentResp.agent?.meta?.id, 'CreateAgent response missing id');

  await waitForAgentReady(agentsClient, organizationId, agentId);

  await agentsClient.createEnv({
    name: SEED_ENV_NAME,
    description: 'Tracing app E2E env',
    target: { case: 'agentId', value: agentId },
    source: { case: 'value', value: SEED_ENV_VALUE },
  });

  const threadResp = await threadsClient.createThread({
    participantIds: [agentId, config.identityId],
  });
  const threadId = requireString(threadResp.thread?.id, 'CreateThread response missing id');

  await threadsClient.sendMessage({
    threadId,
    senderId: config.identityId,
    body: SEED_MESSAGE_TEXT,
    fileIds: [],
  });

  const messageStartTimeMin = msToNanos(Math.max(0, Date.now() - SPAN_START_GRACE_MS));

  await waitForAgentReply(threadsClient, threadId, config.identityId);

  const messageSpan = await waitForSpan(
    tracingClient,
    {
      filter: { names: ['invocation.message'], startTimeMin: messageStartTimeMin },
      pageSize: 200,
      pageToken: '',
      orderBy: ListSpansOrderBy.START_TIME_DESC,
    },
    (span) => {
      const threadAttr = getStringAttr(span.resourceAttrs, 'agyn.thread.id');
      if (threadAttr !== threadId) return false;
      const messageText = getStringAttr(span.span.attributes, 'agyn.message.text');
      return messageText === SEED_MESSAGE_TEXT;
    },
    `invocation.message span for thread ${threadId}`,
  );

  const runId = bytesToHex(messageSpan.span.traceId);
  const messageEventId = bytesToHex(messageSpan.span.spanId);
  const messageText = requireString(
    getStringAttr(messageSpan.span.attributes, 'agyn.message.text'),
    'Message span missing text',
  );

  const llmSpan = await waitForSpan(
    tracingClient,
    {
      filter: { traceId: messageSpan.span.traceId, names: ['llm.call'] },
      pageSize: 200,
      pageToken: '',
      orderBy: ListSpansOrderBy.START_TIME_DESC,
    },
    (span) => {
      const responseText = getStringAttr(span.span.attributes, 'agyn.llm.response_text');
      return span.span.name === 'llm.call' && Boolean(responseText);
    },
    `llm.call span for run ${runId}`,
  );

  const llmEventId = bytesToHex(llmSpan.span.spanId);
  const llmResponseText = requireString(
    getStringAttr(llmSpan.span.attributes, 'agyn.llm.response_text'),
    'LLM span missing response text',
  );

  await waitForTraceCompletion(tracingClient, messageSpan.span.traceId);

  return {
    threadId,
    runId,
    messageEventId,
    llmEventId,
    messageText,
    llmResponseText,
  };
}

async function ensureIdentityRegistered(identityId: string): Promise<void> {
  if (!config.identityGrpcBaseUrl) {
    return;
  }
  const identityClient = createIdentityClient();
  try {
    await identityClient.registerIdentity({
      identityId,
      identityType: IdentityType.USER,
    });
  } catch (error) {
    if (error instanceof ConnectError && error.code === Code.AlreadyExists) {
      return;
    }
    throw error;
  }
}

function createIdentityClient() {
  if (!config.identityGrpcBaseUrl) {
    throw new Error('E2E_IDENTITY_GRPC_BASE_URL is required to register identities.');
  }
  const transport = createGrpcTransport({
    baseUrl: config.identityGrpcBaseUrl,
    interceptors: [authInterceptor],
  });
  return createClient(IdentityService, transport);
}

async function waitForAgentReply(
  threadsClient: ThreadsClient,
  threadId: string,
  senderId: string,
): Promise<void> {
  const deadline = Date.now() + MESSAGE_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await threadsClient.getMessages({
      threadId,
      pageSize: 200,
      pageToken: '',
    });
    const agentMessage = response.messages.find((message) => message.senderId && message.senderId !== senderId);
    if (agentMessage) return;
    await sleep(SPAN_WAIT_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for agent reply in thread ${threadId}`);
}

async function waitForAgentReady(
  agentsClient: AgentsClient,
  organizationId: string,
  agentId: string,
): Promise<void> {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const response = await agentsClient.listAgents({
      organizationId,
      pageSize: 200,
      pageToken: '',
    });
    if (response.agents.some((agent) => agent.meta?.id === agentId)) return;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for agent ${agentId} to become available`);
}

async function waitForSpan(
  tracingClient: TracingClient,
  request: ListSpansRequest,
  predicate: (span: FlattenedSpan) => boolean,
  label: string,
): Promise<FlattenedSpan> {
  const deadline = Date.now() + SPAN_WAIT_TIMEOUT_MS;
  const requestBase = { ...request };
  while (Date.now() < deadline) {
    let pageToken = requestBase.pageToken;
    do {
      const response = await tracingClient.listSpans({ ...requestBase, pageToken });
      const spans = flattenResourceSpans(response.resourceSpans);
      const match = spans.find(predicate);
      if (match) return match;
      pageToken = response.nextPageToken;
    } while (pageToken);
    await sleep(SPAN_WAIT_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function waitForTraceCompletion(tracingClient: TracingClient, traceId: Uint8Array): Promise<void> {
  const deadline = Date.now() + TRACE_STATUS_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const summary = await tracingClient.getTraceSummary({ traceId });
    if (summary.status === TraceStatus.COMPLETED || summary.status === TraceStatus.ERROR) {
      return;
    }
    await sleep(SPAN_WAIT_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for trace ${bytesToHex(traceId)} to complete`);
}

function requireString(value: string | undefined | null, message: string): string {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

async function setupTracingProxy(page: Page): Promise<void> {
  await page.route('**/api/agynio.api.gateway.v1.TracingGateway/*', async (route) => {
    const request = route.request();
    const proxyUrl = buildGatewayUrl(request.url());
    const headers = {
      ...request.headers(),
      authorization: `Bearer ${config.authToken}`,
    };
    delete headers.host;
    delete headers['content-length'];

    const response = await route.fetch({
      url: proxyUrl,
      method: request.method(),
      headers,
      postData: request.postDataBuffer() ?? undefined,
    });
    await route.fulfill({ response });
  });
}

function buildGatewayUrl(requestUrl: string): string {
  const request = new URL(requestUrl);
  const target = new URL(config.gatewayBaseUrl);
  target.pathname = request.pathname.replace(/^\/api\/?/, '/');
  target.search = request.search;
  return target.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function msToNanos(ms: number): bigint {
  return BigInt(ms) * 1_000_000n;
}
