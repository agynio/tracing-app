import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from './components/ui/tooltip';
import { RootLayout, DEFAULT_TIMELINE_PATH } from './layout/RootLayout';
import { AgentsRunScreen } from './pages/AgentsRunScreen';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/agents/threads/:threadId/runs/:runId/timeline" element={<AgentsRunScreen />} />
          </Route>
          <Route path="*" element={<Navigate to={DEFAULT_TIMELINE_PATH} replace />} />
        </Routes>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
