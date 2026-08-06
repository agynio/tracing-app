import { Outlet, useParams } from 'react-router-dom';
import { TopBar } from '@/components/TopBar';

const SHORT_ID_LENGTH = 8;

function shortId(value: string): string {
  return value.length <= SHORT_ID_LENGTH ? value : value.slice(0, SHORT_ID_LENGTH);
}

export function RootLayout() {
  const params = useParams<{ runId?: string; messageId?: string }>();
  const contextId = params.runId ?? params.messageId;

  return (
    <div className="flex h-screen flex-col bg-muted/40">
      <TopBar
        backTo={contextId ? '/' : undefined}
        contextLabel={contextId ? shortId(contextId) : undefined}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
