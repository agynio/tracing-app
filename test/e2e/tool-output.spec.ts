import { expect, isMocked, test } from './fixtures';

const DEFAULT_TIMELINE_PATH = '/agents/threads/thread-demo/runs/run-demo/timeline';
const timelineForEvent = (eventId: string) =>
  `${DEFAULT_TIMELINE_PATH}?eventId=${eventId}&follow=false`;

test.describe('tool output', () => {
  test('displays tool output chunks', async ({ page }) => {
    await page.goto(isMocked ? timelineForEvent('evt-run-demo-tool') : DEFAULT_TIMELINE_PATH);

    if (!isMocked) {
      await expect(page.getByRole('heading', { level: 3 })).toBeVisible();
      return;
    }

    await expect(page.getByText('Resolving packages...')).toBeVisible();
    await expect(page.getByText(/Dependencies installed/)).toBeVisible();
    await expect(page.getByText('warning: using mock data')).toBeVisible();
  });
});
