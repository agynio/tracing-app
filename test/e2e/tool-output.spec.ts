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
    expect(context, 'No run data available in the cluster.').toBeTruthy();
    if (!context) return;

    const toolEvent = await findToolEvent(context, page.request);
    expect(toolEvent, 'No tool execution events available in the cluster run.').toBeTruthy();
    if (!toolEvent) return;

    const outputSnippet =
      formatSnippet(await fetchToolOutputSnippet(page.request, context.runId, toolEvent.id))
      ?? formatSnippet(toolEvent.outputText);
    expect(outputSnippet, 'No tool output available for the cluster run.').toBeTruthy();
    if (!outputSnippet) return;

    const toolLabel = toolEvent.toolName ?? 'Tool Call';
    await page.goto(timelineForEvent(context, toolEvent.id));

    await expect(page.getByRole('heading', { name: toolLabel })).toBeVisible();
    await expect(page.getByText('Output', { exact: true })).toBeVisible();
    await expect(page.getByText(outputSnippet)).toBeVisible();
  });
});
