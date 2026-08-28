import { expect, beforeEach, describe, test, vi } from "vitest";
import { render } from "vitest-browser-react/pure";
import { AuthPage } from "@/components/auth-page";

const auth = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  signIn: { email: auth.signInEmail },
  signUp: { email: auth.signUpEmail },
}));

describe("authentication journey", () => {
  beforeEach(() => {
    auth.signInEmail.mockReset();
    auth.signUpEmail.mockReset();
    auth.signInEmail.mockResolvedValue({ data: {}, error: null });
    auth.signUpEmail.mockResolvedValue({ data: {}, error: null });
  });

  test("validates and submits a new account in the browser", async () => {
    const screen = await render(<AuthPage />);

    await screen
      .getByRole("button", { name: "Don't have an account? Sign up" })
      .click();
    await expect
      .element(screen.getByText("Create an account", { exact: true }))
      .toBeVisible();

    await screen.getByLabelText("Email").fill("ada@example.com");
    await screen.getByLabelText("Password").fill("short");
    await screen.getByRole("button", { name: "Sign up", exact: true }).click();

    await expect.element(screen.getByText("Name is required")).toBeVisible();
    expect(auth.signUpEmail).not.toHaveBeenCalled();

    await screen.getByLabelText("Name").fill("Ada Lovelace");
    await screen.getByLabelText("Password").fill("analytical-engine");
    await screen.getByRole("button", { name: "Sign up", exact: true }).click();

    expect(auth.signUpEmail).toHaveBeenCalledWith({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "analytical-engine",
    });
  });

  test("shows an authentication error and keeps the form usable", async () => {
    auth.signInEmail.mockResolvedValue({
      data: null,
      error: { message: "Invalid email or password" },
    });
    const screen = await render(<AuthPage />);

    await screen.getByLabelText("Email").fill("ada@example.com");
    await screen.getByLabelText("Password").fill("wrong-password");
    await screen.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect
      .element(screen.getByText("Invalid email or password"))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Sign in", exact: true }))
      .toBeEnabled();
    expect(auth.signInEmail).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "wrong-password",
    });
  });
});
