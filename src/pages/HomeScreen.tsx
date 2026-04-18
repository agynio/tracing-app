import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccessibleOrganizations } from '@/api/hooks/organizations';

export function HomeScreen() {
  const navigate = useNavigate();
  const organizationsQuery = useAccessibleOrganizations();

  useEffect(() => {
    const organizations = organizationsQuery.data ?? [];
    if (organizations.length === 1) {
      navigate(`/${organizations[0].id}`, { replace: true });
    }
  }, [organizationsQuery.data, navigate]);

  if (organizationsQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--agyn-text-subtle)]">
        Loading organizations...
      </div>
    );
  }

  if (organizationsQuery.error) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--agyn-status-failed)]">
        Failed to load organizations.
      </div>
    );
  }

  const organizations = organizationsQuery.data ?? [];
  if (organizations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--agyn-text-subtle)]">
        No accessible organizations found.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--agyn-dark)]">Organizations</h1>
        <p className="text-sm text-[var(--agyn-text-subtle)]">Select an organization to view runs.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {organizations.map((org) => (
          <Link
            key={org.id}
            to={`/${org.id}`}
            className="rounded-lg border border-[var(--agyn-border-subtle)] bg-white p-4 transition-colors hover:border-[var(--agyn-blue)]"
          >
            <div className="text-base font-medium text-[var(--agyn-dark)]">{org.name}</div>
            <div className="mt-1 text-xs text-[var(--agyn-text-subtle)]">{org.id}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
