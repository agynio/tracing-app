import {
  expect,
  fetchRunContext,
  findEvent,
  formatSnippet,
  test,
  timelineForEvent,
} from './fixtures';

test.describe('event details', () => {
  test('shows LLM call details', async ({ page }) => {
    const context = await fetchRunContext();
    const llmEvent = await findEvent(context, ['llm_call']);

    await page.goto(timelineForEvent(context, llmEvent.id));

    await expect(page.getByRole('heading', { name: 'LLM Call' })).toBeVisible();
    await expect(page.getByText('Context', { exact: true })).toBeVisible();
    await expect(page.getByText('Output', { exact: true })).toBeVisible();
  });

  test('shows tool execution details', async ({ page }) => {
    const context = await fetchRunContext();
    const toolEvent = await findEvent(context, ['tool_execution']);

    const toolLabel = toolEvent.toolName ?? 'Tool Call';
    await page.goto(timelineForEvent(context, toolEvent.id));

    await expect(page.getByRole('heading', { name: toolLabel })).toBeVisible();
    await expect(page.getByText('Output', { exact: true })).toBeVisible();
  });

  test('shows invocation message', async ({ page }) => {
    const context = await fetchRunContext();
    const messageEvent = await findEvent(context, ['invocation_message', 'injection']);

    await page.goto(timelineForEvent(context, messageEvent.id));

    await expect(page.getByRole('heading', { name: /Message/ })).toBeVisible();
    await expect(page.getByText('Content', { exact: true })).toBeVisible();

    const messageSnippet = formatSnippet(messageEvent.messageText);
    if (messageSnippet) {
      await expect(page.getByText(messageSnippet)).toBeVisible();
    }
  });
});
