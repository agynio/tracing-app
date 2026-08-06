import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  List,
  MessageSquare,
  Search,
} from 'lucide-react';
import { useOrganizationRuns } from '@/api/hooks/runs';
import type { OrganizationRunSummary } from '@/api/modules/runs';
import { useOrganization } from '@/organization/organization.runtime';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { mapRunStatus } from '@/lib/eventMapping';

type GroupBy = 'none' | 'thread' | 'agent' | 'workload';
type StatusFilter = 'all' | 'running' | 'finished' | 'failed';
type TimeRange = '1h' | '24h' | '7d' | 'all';

const GROUP_OPTIONS: { value: GroupBy; label: string; icon: typeof List; hint?: string }[] = [
  { value: 'none', label: 'None', icon: List },
  { value: 'thread', label: 'Thread', icon: MessageSquare },
  { value: 'agent', label: 'Agent', icon: Bot },
  { value: 'workload', label: 'Workload', icon: Layers, hint: 'Agent instances and sandboxes' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'running', label: 'Running' },
  { value: 'finished', label: 'Finished' },
  { value: 'failed', label: 'Failed' },
];

const TIME_OPTIONS: { value: TimeRange; label: string; hours: number | null }[] = [
  { value: '1h', label: '1h', hours: 1 },
  { value: '24h', label: '24h', hours: 24 },
  { value: '7d', label: '7d', hours: 24 * 7 },
  { value: 'all', label: 'All time', hours: null },
];

const STATUS_DOT: Record<string, string> = {
  running: 'var(--agyn-status-pending)',
  pending: 'var(--agyn-status-pending)',
  finished: 'var(--agyn-status-finished)',
  failed: 'var(--agyn-status-failed)',
  terminated: 'var(--agyn-status-terminated)',
};

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return '—';
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(2)}s`;
}

function formatGroupDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

function formatClock(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function shortId(value: string): string {
  return value.length <= 8 ? value : value.slice(0, 8);
}

type RunGroup = {
  key: string;
  label: string;
  kind: string;
  runs: OrganizationRunSummary[];
};

function RunRow({ run }: { run: OrganizationRunSummary }) {
  const status = mapRunStatus(run.status);
  const isFailed = status === 'failed';

  return (
    <Link
      to={`/runs/${run.runId}`}
      className="flex items-center gap-3 border-b border-border px-4 py-2.5 transition-colors hover:bg-muted"
      data-testid="run-row"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: STATUS_DOT[status] ?? 'var(--agyn-status-terminated)' }}
        aria-label={status}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm', isFailed ? 'text-[var(--agyn-status-failed)]' : 'text-foreground')}>
          {run.messageText ?? 'No message text'}
        </p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          {shortId(run.runId)}
          {run.threadId ? ` · thread ${shortId(run.threadId)}` : ''}
        </p>
      </div>
      <span className="w-20 shrink-0 text-right font-mono text-sm text-foreground">
        {formatDuration(run.durationMs)}
      </span>
      <span className="w-20 shrink-0 text-right font-mono text-sm text-muted-foreground">—</span>
      <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
        {formatClock(run.createdAt)}
      </span>
    </Link>
  );
}

function GroupHeader({
  group,
  isCollapsed,
  onToggle,
}: {
  group: RunGroup;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const total = group.runs.reduce((acc, run) => acc + (run.durationMs ?? 0), 0);
  const Chevron = isCollapsed ? ChevronRight : ChevronDown;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-left transition-colors hover:bg-muted"
      aria-expanded={!isCollapsed}
      data-testid="run-group-header"
    >
      <Chevron className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Bot className="h-4 w-4 shrink-0 text-primary" />
      <span className="truncate font-mono text-sm font-medium text-foreground">{group.label}</span>
      <span className="truncate text-xs text-muted-foreground">
        {group.kind} · {group.runs.length} {group.runs.length === 1 ? 'run' : 'runs'} ·{' '}
        {formatGroupDuration(total)}
      </span>
    </button>
  );
}

export function RunsScreen() {
  const { selectedOrganizationId, isLoading: isOrganizationsLoading } = useOrganization();
  const runsQuery = useOrganizationRuns(selectedOrganizationId ?? undefined);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);

  const visibleRuns = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const hours = TIME_OPTIONS.find((option) => option.value === timeRange)?.hours ?? null;
    const cutoff = hours === null ? null : Date.now() - hours * 3600_000;

    return runs.filter((run) => {
      if (statusFilter !== 'all' && mapRunStatus(run.status) !== statusFilter) return false;
      if (cutoff !== null) {
        const createdAt = Date.parse(run.createdAt);
        if (Number.isFinite(createdAt) && createdAt < cutoff) return false;
      }
      if (!normalized) return true;
      return (
        (run.messageText ?? '').toLowerCase().includes(normalized) ||
        run.runId.toLowerCase().includes(normalized)
      );
    });
  }, [runs, search, statusFilter, timeRange]);

  const groups = useMemo<RunGroup[]>(() => {
    if (groupBy === 'none') return [];
    // Thread is the only grouping the telemetry carries today; agent and
    // workload land in one bucket until their span attributes exist.
    const kind = groupBy === 'thread' ? 'thread' : groupBy === 'agent' ? 'agent instance' : 'workload';
    const byKey = new Map<string, RunGroup>();
    for (const run of visibleRuns) {
      const key = groupBy === 'thread' ? run.threadId ?? 'ungrouped' : 'ungrouped';
      const label = key === 'ungrouped' ? 'Ungrouped' : shortId(key);
      const existing = byKey.get(key);
      if (existing) existing.runs.push(run);
      else byKey.set(key, { key, label, kind, runs: [run] });
    }
    return [...byKey.values()];
  }, [groupBy, visibleRuns]);

  const groupLabel = GROUP_OPTIONS.find((option) => option.value === groupBy)?.label ?? 'None';
  const statusLabel = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? 'All statuses';
  const timeLabel = TIME_OPTIONS.find((option) => option.value === timeRange)?.label ?? '24h';
  const GroupIcon = GROUP_OPTIONS.find((option) => option.value === groupBy)?.icon ?? List;

  const toggleGroup = (key: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isLoading = isOrganizationsLoading || runsQuery.isLoading;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search runs"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="run-search"
          />
        </div>

        <FilterMenu label={statusLabel} testId="status-filter">
          <DropdownMenuRadioGroup
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            {STATUS_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </FilterMenu>

        <FilterMenu label={timeLabel} testId="time-filter">
          <DropdownMenuRadioGroup value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
            {TIME_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </FilterMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              data-testid="group-by"
            >
              <GroupIcon className="h-4 w-4 text-muted-foreground" />
              {groupLabel}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[260px]">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Group by</DropdownMenuLabel>
            {GROUP_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isCurrent = option.value === groupBy;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGroupBy(option.value)}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted',
                    isCurrent && 'bg-muted',
                  )}
                >
                  <span className="flex w-full items-center gap-2 text-sm text-foreground">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {option.label}
                    {isCurrent ? <Check className="ml-auto h-4 w-4" /> : null}
                  </span>
                  {option.hint ? (
                    <span className="pl-6 text-xs text-muted-foreground">{option.hint}</span>
                  ) : null}
                </button>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1">Run</span>
        <span className="w-20 shrink-0 text-right">Duration</span>
        <span className="w-20 shrink-0 text-right">Tokens</span>
        <span className="w-14 shrink-0 text-right">Time</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading runs…</p>
        ) : runsQuery.error ? (
          <p className="p-6 text-sm text-[var(--agyn-status-failed)]">Failed to load runs.</p>
        ) : visibleRuns.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No runs match these filters.</p>
        ) : groupBy === 'none' ? (
          visibleRuns.map((run) => <RunRow key={run.runId} run={run} />)
        ) : (
          groups.map((group) => (
            <div key={group.key}>
              <GroupHeader
                group={group}
                isCollapsed={collapsed.has(group.key)}
                onToggle={() => toggleGroup(group.key)}
              />
              {collapsed.has(group.key)
                ? null
                : group.runs.map((run) => <RunRow key={run.runId} run={run} />)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FilterMenu({
  label,
  testId,
  children,
}: {
  label: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          data-testid={testId}
        >
          {label}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
