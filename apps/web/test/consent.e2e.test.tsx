import { beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react/pure";
import { ConsentPage } from "@/components/consent-page";
import { parseOAuthAuthorization } from "@/lib/oauth-route";
import { visit } from "./browser-url";

const oauth = vi.hoisted(() => ({
  consent: vi.fn(),
  publicClient: vi.fn(),
}));
const leaveApp = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-client", () => ({
  authClient: { oauth2: oauth },
}));
// The decision ends in a real navigation out of the app; the test watches
// where it would have gone rather than following it.
vi.mock("@/lib/navigation", () => ({ leaveApp }));

/** The redirect the authorization server sends a user to the consent screen with. */
const AUTHORIZATION_QUERY =
  "?client_id=mcp-client-9&scope=openid+mindmaps%3Aread+mindmaps%3Awrite" +
  "&redirect_uri=http%3A%2F%2F127.0.0.1%3A8976%2Fcallback&state=xyz&sig=signed";

function authorization() {
  visit(`/consent${AUTHORIZATION_QUERY}`);
  const parsed = parseOAuthAuthorization(
    window.location.pathname + window.location.search,
  );
  if (!parsed) throw new Error("the fixture should parse as an authorization");
  return parsed;
}

describe("granting an agent client access", () => {
  beforeEach(() => {
    oauth.consent.mockReset();
    oauth.publicClient.mockReset();
    leaveApp.mockReset();
    oauth.consent.mockResolvedValue({
      data: { redirect: true, url: "http://127.0.0.1:8976/callback?code=abc" },
      error: null,
    });
    oauth.publicClient.mockResolvedValue({
      data: { client_name: "Claude Code" },
      error: null,
    });
  });

  test("names the client and spells out every scope it is asking for", async () => {
    const screen = await render(
      <ConsentPage authorization={authorization()} email="ada@example.com" />,
    );

    await expect
      .element(screen.getByText("Allow Claude Code to use your mindmaps?"))
      .toBeVisible();
    await expect
      .element(screen.getByText("ada@example.com", { exact: false }))
      .toBeVisible();

    // Every requested scope is described in words, including the read/write
    // split — the whole point of the screen is that nothing is granted
    // silently.
    await expect
      .element(
        screen.getByText("Read your mindmaps and the topics inside them"),
      )
      .toBeVisible();
    await expect
      .element(
        screen.getByText(
          "Create, rename, reorganize, and delete your mindmaps and topics",
        ),
      )
      .toBeVisible();
    await expect.element(screen.getByText("Confirm who you are")).toBeVisible();
  });

  test("sends the approval and hands the browser back to the client", async () => {
    const screen = await render(
      <ConsentPage authorization={authorization()} email="ada@example.com" />,
    );

    await screen.getByRole("button", { name: "Allow access" }).click();

    expect(oauth.consent).toHaveBeenCalledWith({ accept: true });
    await vi.waitFor(() =>
      expect(leaveApp).toHaveBeenCalledWith(
        "http://127.0.0.1:8976/callback?code=abc",
      ),
    );
  });

  test("records a refusal as a decision rather than doing nothing", async () => {
    const screen = await render(
      <ConsentPage authorization={authorization()} email="ada@example.com" />,
    );

    await screen.getByRole("button", { name: "Deny" }).click();

    // Denying still goes through the server, so the client is told no instead
    // of being left waiting on a callback that never comes.
    expect(oauth.consent).toHaveBeenCalledWith({ accept: false });
  });

  test("explains an expired request and leaves the buttons usable", async () => {
    oauth.consent.mockResolvedValue({
      data: null,
      error: { message: "Invalid or expired authorization request" },
    });
    const screen = await render(
      <ConsentPage authorization={authorization()} email="ada@example.com" />,
    );

    await screen.getByRole("button", { name: "Allow access" }).click();

    await expect
      .element(screen.getByText("Invalid or expired authorization request"))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Allow access" }))
      .toBeEnabled();
  });

  test("still shows the scopes when the client's name cannot be fetched", async () => {
    oauth.publicClient.mockRejectedValue(new Error("offline"));
    const screen = await render(
      <ConsentPage authorization={authorization()} email="ada@example.com" />,
    );

    await expect
      .element(screen.getByText("Allow this app to use your mindmaps?"))
      .toBeVisible();
    await expect
      .element(
        screen.getByText("Read your mindmaps and the topics inside them"),
      )
      .toBeVisible();
  });
});
