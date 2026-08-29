import { describe, expect, it } from "vitest";
import { authorizeUrl, parseOAuthAuthorization } from "../src/lib/oauth-route";

const SIGNED =
  "?client_id=mcp-client-9&scope=openid+mindmaps%3Aread&redirect_uri=http%3A%2F%2F127.0.0.1%3A8976%2Fcb&sig=abc123";

describe("the authorization surface's URL grammar", () => {
  it("reads the client and scopes out of an authorization redirect", () => {
    expect(parseOAuthAuthorization(`/consent${SIGNED}`)).toEqual({
      screen: "consent",
      clientId: "mcp-client-9",
      scopes: ["openid", "mindmaps:read"],
      query: SIGNED,
    });
  });

  it("recognizes the login screen the same flow redirects through", () => {
    expect(parseOAuthAuthorization(`/sign-in${SIGNED}`)?.screen).toBe(
      "sign-in",
    );
  });

  it("ignores those paths without a signature", () => {
    // Someone typing /consent gets the ordinary app, not an approval screen
    // for a request that does not exist.
    expect(parseOAuthAuthorization("/consent")).toBeNull();
    expect(
      parseOAuthAuthorization("/consent?client_id=mcp-client-9&scope=openid"),
    ).toBeNull();
    expect(parseOAuthAuthorization("/sign-in")).toBeNull();
  });

  it("is not entered from anywhere else in the app", () => {
    expect(parseOAuthAuthorization(`/${SIGNED}`)).toBeNull();
    expect(parseOAuthAuthorization(`/mindmaps/abc${SIGNED}`)).toBeNull();
  });

  it("survives a request that asked for nothing but identity", () => {
    expect(
      parseOAuthAuthorization("/consent?client_id=c&sig=abc")?.scopes,
    ).toEqual([]);
  });

  it("hands the signed query back byte for byte", () => {
    const authorization = parseOAuthAuthorization(`/sign-in${SIGNED}`);

    // Re-encoding it would break the signature, so the resume URL has to
    // carry the original text rather than a round-tripped copy.
    expect(authorizeUrl(authorization!)).toBe(
      `/api/auth/oauth2/authorize${SIGNED}`,
    );
  });
});
