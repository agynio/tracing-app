import type { APIRequestContext } from '@playwright/test';
import {
  expect,
  fetchRunContext,
  fetchRunEvents,
  formatSnippet,
  test,
  type RunContext,
  type RunEventSummary,
} from './fixtures';

const timelineForEvent = (context: RunContext, eventId: string) =>
  `/agents/threads/${context.threadId}/runs/${context.runId}/timeline?eventId=${encodeURIComponent(eventId)}&follow=false`;

const findEvent = async (
  context: RunContext,
  runEventType: string[],
  request: APIRequestContext,
): Promise<RunEventSummary | null> => {
  const events = await fetchRunEvents(request, context.runId, { types: runEventType, limit: 50, order: 'desc' });
  return events[0] ?? null;
};

test.describe('event details', () => {
  test('shows LLM call details', async ({ page }) => {
    const context = await fetchRunContext(page.request);
    test.skip(!context, 'No run data available in the cluster.');
    if (!context) return;

    const llmEvent = await findEvent(context, ['llm_call'], page.request);
    test.skip(!llmEvent, 'No LLM call events available in the cluster run.');
    if (!llmEvent) return;

    await page.goto(timelineForEvent(context, llmEvent.id));

    await expect(page.getByRole('heading', { name: 'LLM Call' })).toBeVisible();
    await expect(page.getByText('Context', { exact: true })).toBeVisible();
    await expect(page.getByText('Output', { exact: true })).toBeVisible();
  });

  test('shows tool execution details', async ({ page }) => {
    const context = await fetchRunContext(page.request);
    test.skip(!context, 'No run data available in the cluster.');
    if (!context) return;

    const toolEvent = await findEvent(context, ['tool_execution'], page.request);
    test.skip(!toolEvent, 'No tool execution events available in the cluster run.');
    if (!toolEvent) return;

    const toolLabel = toolEvent.toolName ?? 'Tool Call';
    await page.goto(timelineForEvent(context, toolEvent.id));

    await expect(page.getByRole('heading', { name: toolLabel })).toBeVisible();
    await expect(page.getByText('Output', { exact: true })).toBeVisible();
  });

  test('shows invocation message', async ({ page }) => {
    const context = await fetchRunContext(page.request);
    test.skip(!context, 'No run data available in the cluster.');
    if (!context) return;

    const messageEvent = await findEvent(context, ['invocation_message', 'injection'], page.request);
    test.skip(!messageEvent, 'No message events available in the cluster run.');
    if (!messageEvent) return;

    await page.goto(timelineForEvent(context, messageEvent.id));

    await expect(page.getByRole('heading', { name: /Message/ })).toBeVisible();
    await expect(page.getByText('Content', { exact: true })).toBeVisible();

    const messageSnippet = formatSnippet(messageEvent.messageText);
    if (messageSnippet) {
      await expect(page.getByText(messageSnippet)).toBeVisible();
    }
  });
});
