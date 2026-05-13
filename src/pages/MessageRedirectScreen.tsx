import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { runs } from '@/api/modules/runs';
import { messageRunRedirectRefetchInterval } from '@/pages/utils/messageRedirectPolling';

export function MessageRedirectScreen() {
  const navigate = useNavigate();
  const params = useParams<{ messageId: string }>();
  const [searchParams] = useSearchParams();
  const messageId = params.messageId;
  const resolvedMessageId = messageId ?? '';
  const organizationId = searchParams.get('orgId')?.trim() || '';

  const query = useQuery({
    enabled: Boolean(resolvedMessageId && organizationId),
    queryKey: ['runs', 'message', organizationId, resolvedMessageId],
    queryFn: () => runs.findRunByMessageId(organizationId, resolvedMessageId),
    refetchInterval: (lookupQuery) => messageRunRedirectRefetchInterval(lookupQuery.state.data),
    refetchOnWindowFocus: false,
  });

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
