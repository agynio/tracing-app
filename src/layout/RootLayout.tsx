import { useMemo } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { useAccessibleOrganizations } from '@/api/hooks/organizations';
import { MainLayout, type BreadcrumbItem } from '@/components/layouts/MainLayout';

const SHORT_ID_LENGTH = 8;

function formatId(value: string): string {
  if (value.length <= SHORT_ID_LENGTH) return value;
  return `${value.slice(0, SHORT_ID_LENGTH)}...`;
}

export function RootLayout() {
  const location = useLocation();
  const params = useParams<{ orgId?: string; runId?: string; messageId?: string }>();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryOrgId = searchParams.get('orgId')?.trim() || undefined;
  const organizationId = params.orgId ?? queryOrgId;

  const orgQuery = useAccessibleOrganizations(undefined, { enabled: Boolean(organizationId) });
  const organizationLabel = organizationId
    ? orgQuery.data?.find((org) => org.id === organizationId)?.name ?? formatId(organizationId)
    : null;

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [{ label: 'Home', to: '/' }];
    if (organizationId && organizationLabel) {
      items.push({ label: organizationLabel, to: `/${organizationId}` });
    }
    if (params.runId && organizationId) {
      items.push({ label: `Run ${formatId(params.runId)}`, to: `/${organizationId}/runs/${params.runId}` });
    }
    if (params.messageId) {
      items.push({ label: `Message ${formatId(params.messageId)}` });
    }
    return items;
  }, [organizationId, organizationLabel, params.messageId, params.runId]);

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <Outlet />
    </MainLayout>
  );
}
