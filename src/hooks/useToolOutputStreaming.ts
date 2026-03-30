import { useCallback, useEffect, useRef, useState } from 'react';
import { runs } from '@/api/modules/runs';
import type { ToolOutputChunk, ToolOutputTerminal } from '@/api/types/agents';

type StreamState = {
  text: string;
  stdoutText: string;
  stderrText: string;
  chunks: ToolOutputChunk[];
  lastSeq: number;
  terminal: ToolOutputTerminal | null;
  hydrated: boolean;
};

type Options = {
  runId: string;
  eventId: string;
  enabled: boolean;
};

const INITIAL_STATE: StreamState = {
  text: '',
  stdoutText: '',
  stderrText: '',
  chunks: [],
  lastSeq: 0,
  terminal: null,
  hydrated: false,
};

export function useToolOutputStreaming({ runId, eventId, enabled }: Options) {
  const [state, setState] = useState<StreamState>(INITIAL_STATE);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const fetchSnapshot = useCallback(
    async () => {
      if (!enabledRef.current) return;
      if (!runId || !eventId) return;
      try {
        setLoading(true);
        const snapshot = await runs.toolOutputSnapshot(runId, eventId);
        setError(null);
        const items = snapshot.items ?? [];
        let nextSeq = 0;
        let nextText = '';
        let nextStdout = '';
        let nextStderr = '';
        for (const chunk of items) {
          nextSeq = Math.max(nextSeq, chunk.seqGlobal);
          nextText += chunk.data;
          if (chunk.source === 'stdout') {
            nextStdout += chunk.data;
          } else {
            nextStderr += chunk.data;
          }
        }
        setState({
          text: nextText,
          stdoutText: nextStdout,
          stderrText: nextStderr,
          chunks: items,
          lastSeq: nextSeq,
          terminal: snapshot.terminal ?? null,
          hydrated: true,
        });
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        setError(normalized);
      } finally {
        setLoading(false);
      }
    },
    [eventId, runId],
  );

  useEffect(() => {
    setState(INITIAL_STATE);
    setError(null);
    setLoading(enabled);
    if (!enabled || !runId || !eventId) return;
    void fetchSnapshot();
  }, [enabled, eventId, fetchSnapshot, runId]);

  return {
    text: state.text,
    stdoutText: state.stdoutText,
    stderrText: state.stderrText,
    chunks: state.chunks,
    terminal: state.terminal,
    hydrated: state.hydrated,
    lastSeq: state.lastSeq,
    loading,
    error,
  };
}
