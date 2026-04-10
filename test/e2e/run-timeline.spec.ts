import { argosScreenshot } from '@argos-ci/playwright';
import { expect, test, type SeededRun } from './fixtures';

const timelinePath = (context: SeededRun) =>
  `/agents/threads/${context.threadId}/runs/${context.runId}/timeline`;

test.describe('run timeline', () => {
  test('renders run timeline on load', async ({ page, seededRun }) => {
    await page.goto(timelinePath(seededRun));

    const eventsList = page.getByTestId('run-events-list');
    await expect(eventsList).toBeVisible();
    await expect(eventsList.locator(`[data-event-id="${seededRun.messageEventId}"]`)).toContainText(
      'Message • Source',
    );
    await expect(eventsList.locator(`[data-event-id="${seededRun.llmEventId}"]`)).toContainText('LLM Call');
    await argosScreenshot(page, 'run-timeline-loaded');
  });

  test('shows run summary', async ({ page, seededRun }) => {
    await page.goto(timelinePath(seededRun));

    await expect(page.getByText(seededRun.status, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /events/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /tokens/ })).toBeVisible();
    await argosScreenshot(page, 'run-timeline-summary');
  });

  test('redirects unknown paths to default timeline', async ({ page, seededRun }) => {
    await page.goto(`/agents/threads/${seededRun.threadId}/runs/${seededRun.runId}/timeline/unknown`);

    await expect(page).toHaveURL(
      new RegExp(`/agents/threads/${seededRun.threadId}/runs/${seededRun.runId}/timeline`),
    );
  });
});
