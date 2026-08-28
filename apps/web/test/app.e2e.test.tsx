import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react/pure";
import App from "@/App";
import { useUiStore } from "@/stores/ui-store";
import { createFakeMindmapApi } from "./fake-mindmap-api";

const auth = vi.hoisted(() => ({
  session: { data: null as Session | null, isPending: false },
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => auth.session,
  signIn: { email: auth.signInEmail },
  signUp: { email: auth.signUpEmail },
  signOut: auth.signOut,
}));

describe("application session routing", () => {
  beforeEach(() => {
    auth.session.data = null;
    auth.session.isPending = false;
    useUiStore.setState({ selectedMindmapId: null, libraryOpen: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("shows the account form to a signed-out visitor", async () => {
    const screen = await render(<App />, { wrapper: testProviders() });

    await expect
      .element(screen.getByText("Sign in", { exact: true }).nth(0))
      .toBeVisible();
    await expect.element(screen.getByLabelText("Email")).toBeVisible();
  });

  test("shows the workspace to an authenticated user", async () => {
    auth.session.data = {
      user: { id: "user-1", email: "ada@example.com", name: "Ada" },
    };
    const api = createFakeMindmapApi();
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    const screen = await render(<App />, { wrapper: testProviders() });

    await expect
      .element(screen.getByRole("heading", { name: "No mindmap open" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Open library" }))
      .toBeVisible();
  });
});

type Session = {
  user: { id: string; email: string; name: string };
};

function testProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function TestProviders({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}
