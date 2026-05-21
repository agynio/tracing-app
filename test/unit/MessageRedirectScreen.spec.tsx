// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MessageRedirectScreen } from '../../src/pages/MessageRedirectScreen';

const { findRunByMessageIdMock } = vi.hoisted(() => ({
  findRunByMessageIdMock: vi.fn(),
}));

vi.mock('@/api/modules/runs', () => ({
  runs: {
    findRunByMessageId: findRunByMessageIdMock,
  },
}));

function renderMessageRedirectScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const view = render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={['/message/message-123?orgId=org-1']}
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <Routes>
            <Route path="message/:messageId" element={<MessageRedirectScreen />} />
            <Route path=":orgId/runs/:runId" element={<div>run destination</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );

  return {
    ...view,
    queryClient,
  };
}

describe('MessageRedirectScreen', () => {
  afterEach(() => {
    findRunByMessageIdMock.mockReset();
  });

  it('polls with backoff until a run is found and redirects', async () => {
    findRunByMessageIdMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ runId: 'run-123' });

    const { getByText, queryClient } = renderMessageRedirectScreen();

    expect(findRunByMessageIdMock).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(findRunByMessageIdMock).toHaveBeenCalledTimes(2), { timeout: 2_500 });
    await new Promise((resolve) => window.setTimeout(resolve, 1_500));

    expect(findRunByMessageIdMock).toHaveBeenCalledTimes(2);

    await waitFor(() => expect(findRunByMessageIdMock).toHaveBeenCalledTimes(3), { timeout: 2_000 });
    await waitFor(() => expect(getByText('run destination')).toBeTruthy());

    expect(findRunByMessageIdMock).toHaveBeenCalledWith('org-1', 'message-123');

    queryClient.clear();
  });
});
