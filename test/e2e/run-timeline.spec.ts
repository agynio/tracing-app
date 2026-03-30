import { argosScreenshot } from '@argos-ci/playwright';
import {
  expect,
  runContext,
  runEvents,
  runSummary,
  test,
  type RunContext,
  type RunEventSummary,
} from './fixtures';

const timelinePath = (context: RunContext) =>
  `/agents/threads/${context.threadId}/runs/${context.runId}/timeline`;

const eventLabel = (event: RunEventSummary): string | RegExp => {
  switch (event.type) {
    case 'invocation_message':
    case 'injection':
      return /Message/;
    case 'llm_call':
      return 'LLM Call';
    case 'tool_execution':
      return event.toolName ?? 'Tool Call';
    case 'summarization':
      return 'Summarization';
    default:
      return /Event/;
  }
};

test.describe('run timeline', () => {
  test('renders run timeline on load', async ({ page }) => {
    await page.goto(timelinePath(runContext));

    await expect(page.getByRole('button', { name: /events/ })).toBeVisible();
    await expect(page.getByRole('button', { name: eventLabel(runEvents[0]) })).toBeVisible();
    await argosScreenshot(page, 'run-timeline-loaded');
  });

  test('shows run summary', async ({ page }) => {
    await page.goto(timelinePath(runContext));

    await expect(page.getByText(runSummary.status, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /events/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /tokens/ })).toBeVisible();
    await argosScreenshot(page, 'run-timeline-summary');
  });

  test('redirects unknown paths to default timeline', async ({ page }) => {
    await page.goto(`/agents/threads/${runContext.threadId}/runs/${runContext.runId}/timeline/unknown`);

    await expect(page).toHaveURL(new RegExp(`/agents/threads/${runContext.threadId}/runs/${runContext.runId}/timeline`));
  });
});
