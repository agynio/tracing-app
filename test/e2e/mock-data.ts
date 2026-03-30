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

export const runContext: RunContext = { threadId: 'thread-demo', runId: '0123456789abcdef0123456789abcdef' };
export const runSummary: RunSummary = { status: 'running' };

export const messageEvent: RunEventSummary = {
  id: 'aaaaaaaaaaaaaaaa',
  type: 'invocation_message',
  messageText: 'Provide a quick status update for the current run.',
};

export const llmEvent: RunEventSummary = {
  id: 'bbbbbbbbbbbbbbbb',
  type: 'llm_call',
  responseText: 'The run completed the tool step and summarized the output with one warning.',
};

export const toolEvent: RunEventSummary = {
  id: 'cccccccccccccccc',
  type: 'tool_execution',
  toolName: 'shell_command',
  outputText: 'Resolving packages...\nProgress: resolved 128 packages\nDone in 3.4s',
};

export const summarizationEvent: RunEventSummary = {
  id: 'dddddddddddddddd',
  type: 'summarization',
};

export const runEvents: RunEventSummary[] = [summarizationEvent, toolEvent, llmEvent, messageEvent];

export const toolOutputSnippet = 'Resolving packages...';

export const timelineForEvent = (context: RunContext, eventId: string) =>
  `/agents/threads/${context.threadId}/runs/${context.runId}/timeline?eventId=${encodeURIComponent(eventId)}&follow=false`;
