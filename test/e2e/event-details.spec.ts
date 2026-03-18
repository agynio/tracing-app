import { expect, isMocked, test } from './fixtures';

const DEFAULT_TIMELINE_PATH = '/agents/threads/thread-demo/runs/run-demo/timeline';
const timelineForEvent = (eventId: string) =>
  `${DEFAULT_TIMELINE_PATH}?eventId=${eventId}&follow=false`;

test.describe('event details', () => {
  test('shows LLM call details', async ({ page }) => {
    await page.goto(isMocked ? timelineForEvent('evt-run-demo-llm') : DEFAULT_TIMELINE_PATH);

    if (!isMocked) {
      await expect(page.getByRole('heading', { level: 3 })).toBeVisible();
      return;
    }

    await expect(page.getByRole('heading', { name: 'LLM Call' })).toBeVisible();
    await expect(page.getByText('openai')).toBeVisible();
    await expect(page.getByText('gpt-4o-mini')).toBeVisible();
    await expect(page.getByText('The run completed the tool step and summarized the output with one warning.')).toBeVisible();
    await expect(page.getByRole('button', { name: /200\s+tokens/ })).toBeVisible();
    await expect(page.getByText(/12\s+tokens/)).toBeVisible();
  });

  test('shows tool execution details', async ({ page }) => {
    await page.goto(isMocked ? timelineForEvent('evt-run-demo-tool') : DEFAULT_TIMELINE_PATH);

    if (!isMocked) {
      await expect(page.getByRole('heading', { level: 3 })).toBeVisible();
      return;
    }

    await expect(page.getByRole('heading', { name: 'shell_command' })).toBeVisible();
    await expect(page.getByText('pnpm install', { exact: true })).toBeVisible();
    await expect(page.getByText('Resolving packages...')).toBeVisible();
  });

  test('shows invocation message', async ({ page }) => {
    await page.goto(isMocked ? timelineForEvent('evt-run-demo-message') : DEFAULT_TIMELINE_PATH);

    if (!isMocked) {
      await expect(page.getByRole('heading', { level: 3 })).toBeVisible();
      return;
    }

    await expect(page.getByRole('heading', { name: /Message.*Source/ })).toBeVisible();
    await expect(page.getByText('Provide a quick status update for the current run.')).toBeVisible();
  });
});
