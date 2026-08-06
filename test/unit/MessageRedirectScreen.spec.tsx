// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OrganizationContext } from "@/organization/organization.runtime";
import { MessageRedirectScreen } from "../../src/pages/MessageRedirectScreen";

const { findRunByMessageIdMock } = vi.hoisted(() => ({
  findRunByMessageIdMock: vi.fn(),
}));

vi.mock("@/api/modules/runs", () => ({
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
        <OrganizationContext.Provider
          value={{
            organizations: [{ id: "org-1", name: "Org One" }],
            selectedOrganizationId: "org-1",
            selectOrganization: () => {},
            isLoading: false,
          }}
        >
          <MemoryRouter
            initialEntries={["/message/message-123?orgId=org-1"]}
            future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
          >
            <Routes>
              <Route
                path="message/:messageId"
                element={<MessageRedirectScreen />}
              />
              <Route path="runs/:runId" element={<div>run destination</div>} />
            </Routes>
          </MemoryRouter>
        </OrganizationContext.Provider>
      </QueryClientProvider>
    </StrictMode>,
  );

  return {
    ...view,
    queryClient,
  };
}

describe("MessageRedirectScreen", () => {
  afterEach(() => {
    findRunByMessageIdMock.mockReset();
  });

  it("polls until a run is found and redirects", async () => {
    findRunByMessageIdMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ runId: "run-123" });

    const { getByText, queryClient } = renderMessageRedirectScreen();

    expect(findRunByMessageIdMock).toHaveBeenCalledTimes(1);

    await waitFor(
      () => expect(findRunByMessageIdMock).toHaveBeenCalledTimes(2),
      { timeout: 2_500 },
    );
    await waitFor(
      () => expect(findRunByMessageIdMock).toHaveBeenCalledTimes(3),
      { timeout: 2_500 },
    );
    await waitFor(() => expect(getByText("run destination")).toBeTruthy());

    expect(findRunByMessageIdMock).toHaveBeenCalledWith("org-1", "message-123");

    queryClient.clear();
  });
});
