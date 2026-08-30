import { describe, expect, it } from "vitest";
import { negotiate, parseAcceptHeader } from "@/lib/accept";

describe("parseAcceptHeader", () => {
  it("reads a media range and its q-value", () => {
    expect(parseAcceptHeader("text/markdown;q=0.9")).toEqual([
      { type: "text", subtype: "markdown", quality: 0.9 },
    ]);
  });

  it("defaults a range with no q to 1", () => {
    expect(parseAcceptHeader("text/html")[0]?.quality).toBe(1);
  });

  it("is case-insensitive and tolerates whitespace", () => {
    expect(parseAcceptHeader(" TEXT/Markdown ;  Q=0.5 ")).toEqual([
      { type: "text", subtype: "markdown", quality: 0.5 },
    ]);
  });

  // A range nobody can act on is not a preference. Keeping it would let a
  // malformed header decide what gets served.
  it("drops ranges that are not a media range or carry an impossible q", () => {
    expect(
      parseAcceptHeader("garbage, text/html, */;q=2, text/plain;q=-1"),
    ).toEqual([{ type: "text", subtype: "html", quality: 1 }]);
  });

  it("treats a missing header as no preference at all", () => {
    expect(parseAcceptHeader(null)).toEqual([]);
    expect(parseAcceptHeader("")).toEqual([]);
  });
});

describe("negotiate", () => {
  it("serves HTML when nothing was asked for", () => {
    expect(negotiate(null)).toBe("html");
    expect(negotiate("")).toBe("html");
  });

  // The case the whole specificity rule exists for: curl, crawlers, and every
  // client that did not think about it send a bare wildcard, and answering that
  // with markdown would break the ordinary web.
  it("serves HTML for a fully wildcarded Accept", () => {
    expect(negotiate("*/*")).toBe("html");
    expect(negotiate("text/*")).toBe("html");
  });

  it("serves HTML for what a browser sends", () => {
    expect(
      negotiate(
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      ),
    ).toBe("html");
  });

  it("serves markdown when it is named and HTML is not", () => {
    expect(negotiate("text/markdown")).toBe("markdown");
    expect(negotiate("text/markdown, */*;q=0.1")).toBe("markdown");
    expect(negotiate("text/x-markdown")).toBe("markdown");
  });

  it("honours q-values when both are named", () => {
    expect(negotiate("text/markdown;q=1.0, text/html;q=0.9")).toBe("markdown");
    expect(negotiate("text/markdown;q=0.9, text/html;q=1.0")).toBe("html");
    expect(negotiate("text/markdown, text/html")).toBe("html");
  });

  // `q=0` is a refusal. A client that explicitly rules markdown out still gets
  // the page, and one that rules both out gets a 406.
  it("treats q=0 as a refusal of that type", () => {
    expect(negotiate("text/markdown;q=0, */*")).toBe("html");
    expect(negotiate("text/html;q=0, text/markdown")).toBe("markdown");
  });

  it("is unacceptable when this site can serve nothing the client will take", () => {
    expect(negotiate("application/json")).toBe("unacceptable");
    expect(negotiate("text/plain")).toBe("unacceptable");
    expect(negotiate("text/html;q=0, text/markdown;q=0")).toBe("unacceptable");
  });

  it("accepts xhtml as a request for the HTML representation", () => {
    expect(negotiate("application/xhtml+xml")).toBe("html");
  });
});
