import { organizationsClient } from '@/api/client';
import type { Organization } from '@/gen/agynio/api/organizations/v1/organizations_pb';

export type OrganizationSummary = {
  id: string;
  name: string;
};

function toOrganizationSummary(org: Organization): OrganizationSummary {
  if (!org.id) {
    throw new Error('Organization is missing an id');
  }
  return {
    id: org.id,
    name: org.name,
  };
}

export const organizations = {
  listAccessible: async (identityId?: string): Promise<OrganizationSummary[]> => {
    const resp = await organizationsClient.listAccessibleOrganizations({
      identityId: identityId ?? '',
    });
    return resp.organizations.map(toOrganizationSummary);
  },
};
