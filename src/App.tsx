import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthCallbackScreen } from './auth/AuthCallbackScreen';
import { SilentRenewScreen } from './auth/SilentRenewScreen';
import { TooltipProvider } from './components/ui/tooltip';
import { ThemeProvider } from './components/theme-provider';
import { OrganizationProvider } from './organization/OrganizationProvider';
import { useOrganization } from './organization/organization.runtime';
import { RootLayout } from './layout/RootLayout';
import { AgentsRunScreen } from './pages/AgentsRunScreen';
import { MessageRedirectScreen } from './pages/MessageRedirectScreen';
import { NotFoundScreen } from './pages/NotFoundScreen';
import { RunsScreen } from './pages/RunsScreen';

const queryClient = new QueryClient();

/**
 * Links minted before the org left the path still carry it. Adopt it as the
 * selection, then continue to the same place without it.
 */
function LegacyOrgRedirect() {
  const params = useParams<{ orgId: string; runId?: string }>();
  const { selectOrganization } = useOrganization();

  useEffect(() => {
    if (params.orgId) selectOrganization(params.orgId);
  }, [params.orgId, selectOrganization]);

  return <Navigate to={params.runId ? `/runs/${params.runId}` : '/'} replace />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <OrganizationProvider>
          <TooltipProvider delayDuration={200}>
            <Toaster position="top-right" richColors />
            <Routes>
              <Route path="callback" element={<AuthCallbackScreen />} />
              <Route path="silent-renew" element={<SilentRenewScreen />} />
              <Route element={<RootLayout />}>
                <Route index element={<RunsScreen />} />
                <Route path="runs/:runId" element={<AgentsRunScreen />} />
                <Route path="message/:messageId" element={<MessageRedirectScreen />} />
                <Route path=":orgId/runs/:runId" element={<LegacyOrgRedirect />} />
                <Route path=":orgId" element={<LegacyOrgRedirect />} />
                <Route path="*" element={<NotFoundScreen />} />
              </Route>
            </Routes>
          </TooltipProvider>
        </OrganizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
