import {
  expect,
  fetchRunContext,
  fetchRunEvents,
  fetchRunSummary,
  test,
  type RunContext,
  type RunEventSummary,
  type RunSummary,
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

let runContext: RunContext | null = null;
let runSummary: RunSummary | null = null;
let runEvents: RunEventSummary[] = [];

test.beforeAll(async ({ request }) => {
  runContext = await fetchRunContext(request);
  if (!runContext) return;
  runSummary = await fetchRunSummary(request, runContext.runId);
  runEvents = await fetchRunEvents(request, runContext.runId, { limit: 50, order: 'desc' });
});

test.describe('run timeline', () => {
  test('renders run timeline on load', async ({ page }) => {
    test.skip(!runContext, 'No run data available in the cluster.');
    test.skip(runEvents.length === 0, 'No events available for the cluster run.');

    if (!runContext || runEvents.length === 0) return;

    await page.goto(timelinePath(runContext));

    await expect(page.getByRole('button', { name: /events/ })).toBeVisible();
    await expect(page.getByRole('button', { name: eventLabel(runEvents[0]) })).toBeVisible();
  });

  test('shows run summary', async ({ page }) => {
    test.skip(!runContext || !runSummary, 'No run summary available in the cluster.');
    if (!runContext || !runSummary) return;

    await page.goto(timelinePath(runContext));

    await expect(page.getByText(runSummary.status, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /events/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /tokens/ })).toBeVisible();
  });

  test('redirects unknown paths to default timeline', async ({ page }) => {
    test.skip(!runContext, 'No run data available in the cluster.');
    if (!runContext) return;

    await page.goto(`/agents/threads/${runContext.threadId}/runs/${runContext.runId}/timeline/unknown`);

    await expect(page).toHaveURL(/\/agents\/threads\/thread-demo\/runs\/run-demo\/timeline/);
  });
});
