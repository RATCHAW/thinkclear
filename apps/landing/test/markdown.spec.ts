import { describe, expect, it } from "vitest";
import { SITE_DOCUMENTS } from "@/lib/documents";
import {
  markdownForPath,
  renderLlmsTxt,
  renderNotFoundMarkdown,
} from "@/lib/markdown";
import { MCP_ENDPOINT, SITE_NAME, SITE_URL } from "@/lib/site";

describe("markdownForPath", () => {
  it("serves the home page", () => {
    const { body, status } = markdownForPath("/");
    expect(status).toBe(200);
    expect(body.startsWith(`# ${SITE_NAME}\n`)).toBe(true);
  });

  it("serves every page in the sitemap's document list", () => {
    for (const doc of SITE_DOCUMENTS) {
      const { body, status } = markdownForPath(doc.path);
      expect(status).toBe(200);
      expect(body).toContain(`# ${doc.title}`);
      expect(body).toContain(`> ${doc.description}`);
    }
  });

  // The audit item this exists for: a 404 that only says 404 leaves an agent
  // with nowhere to go, so the body has to name the way out.
  it("answers an unknown path with 404 and a way to recover", () => {
    const { body, status } = markdownForPath("/no-such-page");
    expect(status).toBe(404);
    expect(body).toContain("/no-such-page");
    expect(body).toContain(`${SITE_URL}/llms.txt`);
    expect(body).toContain(`${SITE_URL}/sitemap.xml`);
    for (const doc of SITE_DOCUMENTS) {
      expect(body).toContain(`${SITE_URL}${doc.path}`);
    }
  });

  it("never renders an empty body", () => {
    for (const path of ["/", "/nope", ...SITE_DOCUMENTS.map((d) => d.path)]) {
      expect(markdownForPath(path).body.trim().length).toBeGreaterThan(200);
    }
  });
});

describe("trust anchor pages", () => {
  // AI agents check About, Contact and Privacy to decide whether a business is
  // real, and a stub reads as an absence. 500 characters is the floor the audit
  // names; these are held to it in the representation a machine actually reads.
  it.each(["/about", "/contact", "/privacy"])(
    "%s carries enough content to be worth reading",
    (path) => {
      expect(markdownForPath(path).body.length).toBeGreaterThan(500);
    },
  );
});

describe("llms.txt", () => {
  const llms = renderLlmsTxt();
  const lines = llms.split("\n");

  // llmstxt.org: an H1 first, then a blockquote, then details, then H2 sections
  // whose items are markdown links.
  it("opens with the H1 and the blockquote the format requires", () => {
    expect(lines[0]).toBe(`# ${SITE_NAME}`);
    expect(lines[2]?.startsWith("> ")).toBe(true);
  });

  it("has exactly one H1", () => {
    expect(lines.filter((line) => /^# /.test(line))).toHaveLength(1);
  });

  it("tells an agent when to reach for this and when not to", () => {
    expect(llms).toContain("## When to use ThinkClear");
    expect(llms).toContain("## When not to use it");
  });

  it("names the MCP endpoint and the discovery documents", () => {
    expect(llms).toContain(MCP_ENDPOINT);
    expect(llms).toContain("/.well-known/oauth-protected-resource/api/mcp");
    expect(llms).toContain("/.well-known/oauth-authorization-server/api/auth");
  });

  it("links every page on the site", () => {
    for (const doc of SITE_DOCUMENTS) {
      expect(llms).toContain(`](${SITE_URL}${doc.path})`);
    }
  });

  it("keeps the secondary links under the conventional Optional section", () => {
    expect(llms).toContain("## Optional");
  });
});

describe("renderNotFoundMarkdown", () => {
  it("quotes the path that missed", () => {
    expect(renderNotFoundMarkdown("/x")).toContain("`/x`");
  });
});
