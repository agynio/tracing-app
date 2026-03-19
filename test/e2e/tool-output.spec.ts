import {
  expect,
  fetchRunContext,
  fetchToolOutputSnippet,
  findToolEvent,
  test,
  timelineForEvent,
} from './fixtures';

test.describe('tool output', () => {
  test('displays tool output chunks', async ({ page }) => {
    const context = await fetchRunContext();
    const toolEvent = await findToolEvent(context);
    const outputSnippet = await fetchToolOutputSnippet(context.runId, toolEvent.id);

    const toolLabel = toolEvent.toolName ?? 'Tool Call';
    await page.goto(timelineForEvent(context, toolEvent.id));

    await expect(page.getByRole('heading', { name: toolLabel })).toBeVisible();
    await expect(page.getByText('Output', { exact: true })).toBeVisible();
    await expect(page.getByText(outputSnippet)).toBeVisible();
  });
});
