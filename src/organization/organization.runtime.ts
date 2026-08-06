import { createContext, useContext } from 'react';

export type OrganizationOption = {
  id: string;
  name: string;
};

export type OrganizationContextValue = {
  organizations: OrganizationOption[];
  selectedOrganizationId: string | null;
  selectOrganization: (organizationId: string) => void;
  isLoading: boolean;
};

export const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export function useOrganization(): OrganizationContextValue {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error('useOrganization must be used within OrganizationProvider');
  return ctx;
}
