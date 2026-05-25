import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { runs } from '@/api/modules/runs';
import { messageRunLookupTimedOut, messageRunRedirectRefetchInterval } from '@/pages/utils/messageRedirectPolling';

export function MessageRedirectScreen() {
  const navigate = useNavigate();
  const params = useParams<{ messageId: string }>();
  const [searchParams] = useSearchParams();
  const messageId = params.messageId;
  const resolvedMessageId = messageId ?? '';
  const organizationId = searchParams.get('orgId')?.trim() || '';
  const [lookupStartedAtMs, setLookupStartedAtMs] = useState(() => Date.now());
  const [nowMs, setNowMs] = useState(() => Date.now());

  const query = useQuery({
    enabled: Boolean(resolvedMessageId && organizationId),
    queryKey: ['runs', 'message', organizationId, resolvedMessageId],
    queryFn: () => runs.findRunByMessageId(organizationId, resolvedMessageId),
    refetchInterval: (lookupQuery) =>
      messageRunRedirectRefetchInterval(lookupQuery.state.data, lookupStartedAtMs, Date.now()),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const startedAtMs = Date.now();
    setLookupStartedAtMs(startedAtMs);
    setNowMs(startedAtMs);
  }, [organizationId, resolvedMessageId]);

  useEffect(() => {
    if (query.data?.runId || messageRunLookupTimedOut(lookupStartedAtMs, nowMs)) return;
    const timeoutId = window.setTimeout(() => setNowMs(Date.now()), 1_000);
    return () => window.clearTimeout(timeoutId);
  }, [lookupStartedAtMs, nowMs, query.data?.runId]);

  useEffect(() => {
    if (!organizationId || !query.data?.runId) return;
    navigate(`/${organizationId}/runs/${query.data.runId}`, { replace: true });
  }, [navigate, organizationId, query.data]);

  if (!messageId) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--agyn-status-failed)]">
        Message id is required.
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--agyn-status-failed)]">
        Organization id query parameter is required.
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--agyn-text-subtle)]">
        Resolving message...
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--agyn-status-failed)]">
        Failed to locate message.
      </div>
    );
  }

  if (!query.data?.runId) {
    if (messageRunLookupTimedOut(lookupStartedAtMs, nowMs)) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-[var(--agyn-text-subtle)]">
          <div>No run found for message.</div>
          <button
            type="button"
            className="text-[var(--agyn-blue)] hover:text-[var(--agyn-blue)]/80"
            onClick={() => {
              const startedAtMs = Date.now();
              setLookupStartedAtMs(startedAtMs);
              setNowMs(startedAtMs);
              void query.refetch();
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--agyn-text-subtle)]">
        Resolving message...
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center text-sm text-[var(--agyn-text-subtle)]">
      Redirecting to run...
    </div>
  );
}
