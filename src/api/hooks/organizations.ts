import { useQuery } from '@tanstack/react-query';
import { organizations } from '@/api/modules/organizations';

export function useAccessibleOrganizations(identityId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    enabled: options?.enabled ?? true,
    queryKey: ['organizations', 'accessible', identityId ?? ''],
    queryFn: () => organizations.listAccessible(identityId),
    refetchOnWindowFocus: false,
  });
}
