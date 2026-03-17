import { useCallback, useMemo } from 'react';
import { Activity, ScrollText } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layouts/MainLayout';
import type { MenuItem } from '@/components/Sidebar';

export const DEFAULT_THREAD_ID = 'thread-demo';
export const DEFAULT_RUN_ID = 'run-demo';
export const DEFAULT_TIMELINE_PATH = `/agents/threads/${DEFAULT_THREAD_ID}/runs/${DEFAULT_RUN_ID}/timeline`;

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'tracing',
    label: 'Tracing',
    icon: <Activity className="w-4 h-4" />,
    items: [
      {
        id: 'timeline',
        label: 'Timeline',
        icon: <ScrollText className="w-4 h-4" />,
      },
    ],
  },
];

function isTimelinePath(pathname: string): boolean {
  return pathname.includes('/agents/threads/') && pathname.includes('/runs/') && pathname.endsWith('/timeline');
}

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const timelinePath = useMemo(
    () => (isTimelinePath(location.pathname) ? location.pathname : DEFAULT_TIMELINE_PATH),
    [location.pathname],
  );

  const handleMenuItemSelect = useCallback(
    (itemId: string) => {
      if (itemId !== 'timeline') return;
      if (location.pathname !== timelinePath) {
        navigate(timelinePath);
      }
    },
    [location.pathname, navigate, timelinePath],
  );

  return (
    <MainLayout menuItems={MENU_ITEMS} selectedMenuItem="timeline" onMenuItemSelect={handleMenuItemSelect}>
      <Outlet />
    </MainLayout>
  );
}
