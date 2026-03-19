import {
  expect,
  formatSnippet,
  llmEvent,
  messageEvent,
  runContext,
  test,
  toolEvent,
  timelineForEvent,
} from './fixtures';

test.describe('event details', () => {
  test('shows LLM call details', async ({ page }) => {
    await page.goto(timelineForEvent(runContext, llmEvent.id));

    await expect(page.getByRole('heading', { name: 'LLM Call' })).toBeVisible();
    await expect(page.getByText('Context', { exact: true })).toBeVisible();
    await expect(page.getByText('Output', { exact: true })).toBeVisible();
  });

  test('shows tool execution details', async ({ page }) => {
    const toolLabel = toolEvent.toolName ?? 'Tool Call';
    await page.goto(timelineForEvent(runContext, toolEvent.id));

    await expect(page.getByRole('heading', { name: toolLabel })).toBeVisible();
    await expect(page.getByText('Output', { exact: true })).toBeVisible();
  });

  test('shows invocation message', async ({ page }) => {
    await page.goto(timelineForEvent(runContext, messageEvent.id));

    await expect(page.getByRole('heading', { name: /Message/ })).toBeVisible();
    await expect(page.getByText('Content', { exact: true })).toBeVisible();

    const messageSnippet = formatSnippet(messageEvent.messageText);
    if (messageSnippet) {
      await expect(page.getByText(messageSnippet)).toBeVisible();
    }
  });
});
