import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { RootLayout } from './layout/RootLayout';
import { AgentsRunScreen } from './pages/AgentsRunScreen';
import { HomeScreen } from './pages/HomeScreen';
import { MessageRedirectScreen } from './pages/MessageRedirectScreen';
import { NotFoundScreen } from './pages/NotFoundScreen';
import { OrganizationRunsScreen } from './pages/OrganizationRunsScreen';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="callback" element={<Navigate to="/" replace />} />
            <Route index element={<HomeScreen />} />
            <Route path="message/:messageId" element={<MessageRedirectScreen />} />
            <Route path=":orgId">
              <Route index element={<OrganizationRunsScreen />} />
              <Route path="runs/:runId" element={<AgentsRunScreen />} />
            </Route>
            <Route path="*" element={<NotFoundScreen />} />
          </Route>
        </Routes>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
