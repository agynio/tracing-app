import { argosScreenshot } from '@argos-ci/playwright';
import { expect, formatSnippet, test, timelineForEvent } from './fixtures';

test.describe('event details', () => {
  test('shows LLM call details', async ({ page, seededRun }) => {
    await page.goto(timelineForEvent(seededRun, seededRun.llmEventId));

    await expect(page.getByTestId('run-event-details-heading')).toHaveText('LLM Call');
    const context = page.getByTestId('run-event-details-llm-context');
    await expect(context).toBeVisible();

    const messageSnippet = formatSnippet(seededRun.messageText) ?? seededRun.messageText;
    await expect(context).toContainText(messageSnippet);

    const output = page.getByTestId('run-event-details-llm-output');
    await expect(output).toBeVisible();
    const outputSnippet = formatSnippet(seededRun.llmResponseText) ?? seededRun.llmResponseText;
    await expect(output).toContainText(outputSnippet);

    await argosScreenshot(page, 'event-details-llm-call');
  });

  test('shows invocation message', async ({ page, seededRun }) => {
    await page.goto(timelineForEvent(seededRun, seededRun.messageEventId));

    await expect(page.getByTestId('run-event-details-heading')).toContainText('Message • Source');
    const content = page.getByTestId('run-event-details-message-content');
    await expect(content).toContainText(seededRun.messageText);

    await argosScreenshot(page, 'event-details-invocation-message');
  });
});
