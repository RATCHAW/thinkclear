import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react/pure";
import App from "@/App";
import { visit } from "./browser-url";
import { createFakeApi } from "./fake-api";

const auth = vi.hoisted(() => ({
  session: { data: null as Session | null, isPending: false },
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  signOut: vi.fn(),
  oauth2: { consent: vi.fn(), publicClient: vi.fn() },
}));
const leaveApp = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-client", () => ({
  useSession: () => auth.session,
  signIn: { email: auth.signInEmail },
  signUp: { email: auth.signUpEmail },
  signOut: auth.signOut,
  authClient: { oauth2: auth.oauth2 },
}));
vi.mock("@/lib/navigation", () => ({ leaveApp }));

/** The signed query Better Auth redirects an authorization through. */
const AUTHORIZATION_QUERY =
  "?client_id=mcp-client-9&scope=mindmaps%3Aread&redirect_uri=http%3A%2F%2F127.0.0.1%3A8976%2Fcb&sig=signed";

describe("application session routing", () => {
  beforeEach(() => {
    auth.session.data = null;
    auth.session.isPending = false;
    leaveApp.mockReset();
    auth.oauth2.publicClient.mockResolvedValue({ data: null, error: null });
    visit("/");
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
    const api = createFakeApi();
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    const screen = await render(<App />, { wrapper: testProviders() });

    await expect
      .element(screen.getByRole("heading", { name: "No mindmap open" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Open library" }))
      .toBeVisible();
  });

  test("asks a signed-out visitor to sign in before an agent client's request", async () => {
    visit(`/sign-in${AUTHORIZATION_QUERY}`);
    const screen = await render(<App />, { wrapper: testProviders() });

    // The form stays on this URL, so finishing it lands back in the flow
    // rather than dropping the authorization on the floor.
    await expect.element(screen.getByLabelText("Email")).toBeVisible();
    expect(leaveApp).not.toHaveBeenCalled();
  });

  test("resumes an authorization once there is a session to grant it", async () => {
    auth.session.data = {
      user: { id: "user-1", email: "ada@example.com", name: "Ada" },
    };
    visit(`/sign-in${AUTHORIZATION_QUERY}`);
    await render(<App />, { wrapper: testProviders() });

    // Back to the authorization server with the signed query intact — it
    // decides what comes next, which is the consent screen.
    await vi.waitFor(() =>
      expect(leaveApp).toHaveBeenCalledWith(
        `/api/auth/oauth2/authorize${AUTHORIZATION_QUERY}`,
        "replace",
      ),
    );
  });

  test("shows the consent screen instead of the workspace mid-authorization", async () => {
    auth.session.data = {
      user: { id: "user-1", email: "ada@example.com", name: "Ada" },
    };
    visit(`/consent${AUTHORIZATION_QUERY}`);
    const screen = await render(<App />, { wrapper: testProviders() });

    await expect
      .element(screen.getByRole("button", { name: "Allow access" }))
      .toBeVisible();
  });

  test("opens the workspace normally on those paths without a signed request", async () => {
    auth.session.data = {
      user: { id: "user-1", email: "ada@example.com", name: "Ada" },
    };
    const api = createFakeApi();
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    // `/consent` typed by hand approves nothing; there is no request to show.
    visit("/consent");
    const screen = await render(<App />, { wrapper: testProviders() });

    await expect
      .element(screen.getByRole("heading", { name: "No mindmap open" }))
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
