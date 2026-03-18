import type { APIRequestContext } from '@playwright/test';
import {
  expect,
  fetchRunContext,
  fetchRunEvents,
  fetchToolOutputSnippet,
  formatSnippet,
  test,
  type RunContext,
  type RunEventSummary,
} from './fixtures';

const timelineForEvent = (context: RunContext, eventId: string) =>
  `/agents/threads/${context.threadId}/runs/${context.runId}/timeline?eventId=${encodeURIComponent(eventId)}&follow=false`;

const findToolEvent = async (context: RunContext, request: APIRequestContext): Promise<RunEventSummary | null> => {
  const events = await fetchRunEvents(request, context.runId, { types: ['tool_execution'], limit: 50, order: 'desc' });
  return events[0] ?? null;
};

test.describe('tool output', () => {
  test('displays tool output chunks', async ({ page }) => {
    const context = await fetchRunContext(page.request);
    test.skip(!context, 'No run data available in the cluster.');
    if (!context) return;

    const toolEvent = await findToolEvent(context, page.request);
    test.skip(!toolEvent, 'No tool execution events available in the cluster run.');
    if (!toolEvent) return;

    const outputSnippet =
      formatSnippet(await fetchToolOutputSnippet(page.request, context.runId, toolEvent.id))
      ?? formatSnippet(toolEvent.outputText);
    test.skip(!outputSnippet, 'No tool output available for the cluster run.');
    if (!outputSnippet) return;

    const toolLabel = toolEvent.toolName ?? 'Tool Call';
    await page.goto(timelineForEvent(context, toolEvent.id));

    await expect(page.getByRole('heading', { name: toolLabel })).toBeVisible();
    await expect(page.getByText('Output', { exact: true })).toBeVisible();
    await expect(page.getByText(outputSnippet)).toBeVisible();
  });
});
