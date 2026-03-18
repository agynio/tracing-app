import { expect, isMocked, test } from './fixtures';

const DEFAULT_TIMELINE_PATH = '/agents/threads/thread-demo/runs/run-demo/timeline';

test.describe('run timeline', () => {
  test('renders run timeline on load', async ({ page }) => {
    await page.goto(DEFAULT_TIMELINE_PATH);

    if (!isMocked) {
      await expect(page.getByRole('button', { name: /events/ })).toBeVisible();
      return;
    }

    await expect(page.getByRole('button', { name: /Message.*Source/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /LLM Call/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /shell_command/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Summarization/ })).toBeVisible();
  });

  test('shows run summary', async ({ page }) => {
    await page.goto(DEFAULT_TIMELINE_PATH);

    if (!isMocked) {
      await expect(page.getByRole('button', { name: /events/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /tokens/ })).toBeVisible();
      return;
    }

    await expect(page.getByText('running', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /4\s+events/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /200\s+tokens/ })).toBeVisible();
  });

  test('redirects unknown paths to default timeline', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/agents\/threads\/thread-demo\/runs\/run-demo\/timeline/);
    await expect(page.getByRole('button', { name: /LLM Call/ })).toBeVisible();
  });
});
