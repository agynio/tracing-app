import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAccessibleOrganizations } from '@/api/hooks/organizations';
import { OrganizationContext, type OrganizationOption } from './organization.runtime';

const STORAGE_KEY = 'tracing-organization-id';

function readStoredOrganizationId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredOrganizationId(value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // A blocked localStorage only costs the selection across reloads.
  }
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const organizationsQuery = useAccessibleOrganizations();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(() =>
    readStoredOrganizationId(),
  );

  const organizations = useMemo<OrganizationOption[]>(
    () => (organizationsQuery.data ?? []).map((org) => ({ id: org.id, name: org.name })),
    [organizationsQuery.data],
  );

  // The org picker screen is gone, so a selection is resolved here: the stored
  // one when it is still accessible, otherwise the first available.
  useEffect(() => {
    if (organizations.length === 0) return;
    const isValid = organizations.some((org) => org.id === selectedOrganizationId);
    if (isValid) return;
    const next = readStoredOrganizationId();
    const fallback = organizations.find((org) => org.id === next)?.id ?? organizations[0].id;
    setSelectedOrganizationId(fallback);
    writeStoredOrganizationId(fallback);
  }, [organizations, selectedOrganizationId]);

  const selectOrganization = useCallback((organizationId: string) => {
    setSelectedOrganizationId(organizationId);
    writeStoredOrganizationId(organizationId);
  }, []);

  const value = useMemo(
    () => ({
      organizations,
      selectedOrganizationId,
      selectOrganization,
      isLoading: organizationsQuery.isLoading,
    }),
    [organizations, organizationsQuery.isLoading, selectOrganization, selectedOrganizationId],
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}
