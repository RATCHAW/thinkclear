import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

/**
 * The share card, generated at build time from this file rather than checked
 * in as a PNG — so the claim on it cannot drift from the claim on the page
 * without somebody editing the same repository.
 *
 * Next reads the three exports below and writes both `og:image` and
 * `twitter:image` from them, which is what makes the `summary_large_image`
 * card in `layout.tsx` an actual promise rather than a declaration with
 * nothing behind it.
 *
 * Everything here is inline styles and flex on purpose. This renders through
 * Satori, not a browser: there is no cascade, no Tailwind, and no `filter`, so
 * the blobs that sit behind the product visuals on the page are a radial
 * gradient here instead of a blur.
 */
export const alt = `${SITE_NAME} — an open-source mindmap canvas with an assistant and an MCP server`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        backgroundColor: "#0b3558",
        backgroundImage:
          "radial-gradient(circle at 92% 8%, rgba(229, 92, 255, 0.38), rgba(11, 53, 88, 0) 55%)",
        fontFamily: "sans-serif",
      }}
    >
      {/* The Unknotting, in the skin app/icon.svg uses: root yellow on Ink
            Navy. Drawn on the wordmark's own 24×24 grid, scaled up. */}
      <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
        <svg width="54" height="54" viewBox="0 0 24 24" fill="none">
          <g
            stroke="#ffe600"
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.4 5.8C8.6 5.8 8.6 18.2 13.4 18.2H20.6" />
            <path d="M3.4 18.2C8.6 18.2 8.6 5.8 13.4 5.8H20.6" />
          </g>
        </svg>
        <span
          style={{
            fontSize: "38px",
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: "#ffffff",
          }}
        >
          {SITE_NAME}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: "80px",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "#ffffff",
          }}
        >
          Think out loud.
        </div>
        <div
          style={{
            fontSize: "80px",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "#0099ff",
          }}
        >
          The map keeps up.
        </div>
        <div
          style={{
            marginTop: "28px",
            maxWidth: "880px",
            fontSize: "28px",
            lineHeight: 1.45,
            color: "#a6bbd1",
          }}
        >
          A mindmap canvas with an assistant that can build it — and an MCP
          server so your own agent can too.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          fontSize: "22px",
          fontWeight: 600,
          color: "#a6bbd1",
        }}
      >
        <span>Open source, AGPL-3.0</span>
        <span style={{ color: "#476788" }}>·</span>
        <span>MCP over OAuth 2.1</span>
        <span style={{ color: "#476788" }}>·</span>
        <span>Self-host with one compose file</span>
      </div>
    </div>,
    size,
  );
}
