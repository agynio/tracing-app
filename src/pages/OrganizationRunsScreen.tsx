import { Link, useParams } from 'react-router-dom';
import { useAccessibleOrganizations } from '@/api/hooks/organizations';
import { useOrganizationRuns } from '@/api/hooks/runs';
import { StatusIndicator } from '@/components/StatusIndicator';
import { formatTimestamp, mapRunStatus } from '@/lib/eventMapping';

const RUN_ID_SLICE = 8;

function formatRunId(runId: string): string {
  if (runId.length <= RUN_ID_SLICE) return runId;
  return `${runId.slice(0, RUN_ID_SLICE)}...`;
}

export function OrganizationRunsScreen() {
  const params = useParams<{ orgId: string }>();
  const organizationId = params.orgId;

  const organizationsQuery = useAccessibleOrganizations(undefined, { enabled: Boolean(organizationId) });
  const runsQuery = useOrganizationRuns(organizationId);

  if (!organizationId) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--agyn-status-failed)]">
        Organization id is required.
      </div>
    );
  }

  const orgName = organizationsQuery.data?.find((org) => org.id === organizationId)?.name;

  if (runsQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--agyn-text-subtle)]">
        Loading runs...
      </div>
    );
  }

  if (runsQuery.error) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--agyn-status-failed)]">
        Failed to load runs.
      </div>
    );
  }

  const runs = runsQuery.data ?? [];

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--agyn-dark)]">Runs</h1>
        <p className="text-sm text-[var(--agyn-text-subtle)]">
          Organization: {orgName ?? organizationId}
        </p>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--agyn-border-subtle)] bg-white p-6 text-sm text-[var(--agyn-text-subtle)]">
          No runs found for this organization.
        </div>
      ) : (
        <ul className="space-y-3">
          {runs.map((run) => (
            <li key={run.runId} className="rounded-lg border border-[var(--agyn-border-subtle)] bg-white">
              <Link
                to={`/${organizationId}/runs/${run.runId}`}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <StatusIndicator status={mapRunStatus(run.status)} size="sm" showTooltip={false} />
                    <span className="text-sm font-medium text-[var(--agyn-dark)]">
                      Run {formatRunId(run.runId)}
                    </span>
                  </div>
                  <span className="truncate text-xs text-[var(--agyn-text-subtle)]">
                    {run.messageText ?? 'No message text'}
                  </span>
                </div>
                <span className="text-xs text-[var(--agyn-text-subtle)]">
                  {formatTimestamp(run.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
