import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { runs } from '@/api/modules/runs';

const MESSAGE_REDIRECT_REFETCH_BASE_MS = 1_000;
const MESSAGE_REDIRECT_REFETCH_MAX_MS = 5_000;

export function MessageRedirectScreen() {
  const navigate = useNavigate();
  const params = useParams<{ messageId: string }>();
  const [searchParams] = useSearchParams();
  const refetchCountRef = useRef(0);
  const messageId = params.messageId;
  const resolvedMessageId = messageId ?? '';
  const organizationId = searchParams.get('orgId')?.trim() || '';
  const queryKey = useMemo(
    () => ['runs', 'message', organizationId, resolvedMessageId] as const,
    [organizationId, resolvedMessageId],
  );

  const query = useQuery({
    enabled: Boolean(resolvedMessageId && organizationId),
    queryKey,
    queryFn: () => runs.findRunByMessageId(organizationId, resolvedMessageId),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    refetchCountRef.current = 0;
  }, [queryKey]);

  useEffect(() => {
    if (!resolvedMessageId || !organizationId || query.data === undefined || query.data?.runId) return;

    const refetchDelay = Math.min(
      MESSAGE_REDIRECT_REFETCH_BASE_MS * 2 ** refetchCountRef.current,
      MESSAGE_REDIRECT_REFETCH_MAX_MS,
    );
    refetchCountRef.current += 1;

    const timeoutId = window.setTimeout(() => {
      void query.refetch();
    }, refetchDelay);

    return () => window.clearTimeout(timeoutId);
  }, [organizationId, query, query.data, resolvedMessageId]);

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
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--agyn-text-subtle)]">
        Waiting for run to appear...
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center text-sm text-[var(--agyn-text-subtle)]">
      Redirecting to run...
    </div>
  );
}
