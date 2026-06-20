import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";

/**
 * Race regression tests for AuthContext:
 *  - getSession() can resolve AFTER onAuthStateChange fires INITIAL_SESSION
 *  - rapid login -> logout -> login must converge to the final state
 *  - unmount during in-flight getSession() must not setState (no warning)
 */

type AuthCb = (event: string, session: any) => void;
let authCb: AuthCb | null = null;
let getSessionResolve: ((v: any) => void) | null = null;
const unsubscribe = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: AuthCb) => {
        authCb = cb;
        return { data: { subscription: { unsubscribe } } };
      },
      getSession: () =>
        new Promise((resolve) => {
          getSessionResolve = resolve;
        }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({}),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}));

vi.mock("@/lib/sentry", () => ({ captureError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/userProfileQuery", () => ({
  fetchUserProfile: vi.fn(),
  userProfileQueryKey: (id: string) => ["profile", id],
}));

function Probe() {
  const { user, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.id ?? "none"}</span>
    </div>
  );
}

function renderWithProviders() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authCb = null;
  getSessionResolve = null;
  unsubscribe.mockClear();
});

describe("AuthContext race conditions", () => {
  it("handles onAuthStateChange firing before getSession resolves", async () => {
    renderWithProviders();
    expect(screen.getByTestId("loading").textContent).toBe("true");

    // Auth event arrives first (real Supabase often emits INITIAL_SESSION early)
    await act(async () => {
      authCb!("INITIAL_SESSION", { user: { id: "user-A" } });
    });
    expect(screen.getByTestId("user").textContent).toBe("user-A");

    // getSession resolves later with the same session — must not regress user
    await act(async () => {
      getSessionResolve!({ data: { session: { user: { id: "user-A" } } } });
    });
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );
    expect(screen.getByTestId("user").textContent).toBe("user-A");
  });

  it("converges on the last event during rapid login/logout/login", async () => {
    renderWithProviders();

    await act(async () => {
      authCb!("SIGNED_IN", { user: { id: "user-1" } });
      authCb!("SIGNED_OUT", null);
      authCb!("SIGNED_IN", { user: { id: "user-2" } });
    });

    await act(async () => {
      getSessionResolve!({ data: { session: null } }); // stale snapshot
    });

    // Final state must reflect the latest auth event, not the stale snapshot
    expect(screen.getByTestId("user").textContent).toBe("user-2");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("does not setState after unmount when getSession resolves late", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = renderWithProviders();

    unmount();
    expect(unsubscribe).toHaveBeenCalled();

    // Late resolution after unmount must be a no-op
    await act(async () => {
      getSessionResolve!({ data: { session: { user: { id: "late" } } } });
    });

    expect(errSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("unmounted"),
    );
    errSpy.mockRestore();
  });
});
