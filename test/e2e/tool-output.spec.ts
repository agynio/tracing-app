import {
  expect,
  runContext,
  test,
  toolEvent,
  toolOutputSnippet,
  timelineForEvent,
} from './fixtures';

test.describe('tool output', () => {
  test('displays tool output chunks', async ({ page }) => {
    const toolLabel = toolEvent.toolName ?? 'Tool Call';
    await page.goto(timelineForEvent(runContext, toolEvent.id));

    await expect(page.getByRole('heading', { name: toolLabel })).toBeVisible();
    await expect(page.getByText('Output', { exact: true })).toBeVisible();
    await expect(page.getByText(toolOutputSnippet)).toBeVisible();
  });
});
