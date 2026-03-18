import {
  expect,
  fetchRunContext,
  fetchToolOutputSnippet,
  findToolEvent,
  formatSnippet,
  test,
  timelineForEvent,
} from './fixtures';

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
