export type RunContext = {
  threadId: string;
  runId: string;
};

export type RunSummary = {
  status: string;
};

export type RunEventSummary = {
  id: string;
  type: string;
  toolName?: string;
  messageText?: string;
  responseText?: string;
  outputText?: string;
};

export const runContext: RunContext = { threadId: 'thread-demo', runId: 'run-demo' };
export const runSummary: RunSummary = { status: 'running' };

export const messageEvent: RunEventSummary = {
  id: 'evt-run-demo-message',
  type: 'invocation_message',
  messageText: 'Provide a quick status update for the current run.',
};

export const llmEvent: RunEventSummary = {
  id: 'evt-run-demo-llm',
  type: 'llm_call',
  responseText: 'The run completed the tool step and summarized the output with one warning.',
};

export const toolEvent: RunEventSummary = {
  id: 'evt-run-demo-tool',
  type: 'tool_execution',
  toolName: 'shell_command',
  outputText: 'Progress: resolved 128 packages\nDone in 3.4s',
};

export const summarizationEvent: RunEventSummary = {
  id: 'evt-run-demo-summary',
  type: 'summarization',
};

export const runEvents: RunEventSummary[] = [summarizationEvent, toolEvent, llmEvent, messageEvent];

export const toolOutputSnippet = 'Resolving packages...';

export const timelineForEvent = (context: RunContext, eventId: string) =>
  `/agents/threads/${context.threadId}/runs/${context.runId}/timeline?eventId=${encodeURIComponent(eventId)}&follow=false`;
