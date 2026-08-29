import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

/**
 * Manrope is the design reference's stated substitute for Gilroy, which is
 * licensed. `next/font` downloads it at build time and serves it from this
 * origin, so there is no request to a font host on the critical path and no
 * layout shift while it arrives.
 */
const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — think out loud, and let the map keep up`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  keywords: [
    "mindmap",
    "AI mindmap",
    "MCP",
    "Model Context Protocol",
    "Claude Code",
    "open source",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — think out loud, and let the map keep up`,
    description: SITE_TAGLINE,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — think out loud, and let the map keep up`,
    description: SITE_TAGLINE,
  },
};

export const viewport: Viewport = {
  themeColor: "#f8f9fb",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <a
          href="#main"
          className="sr-only rounded-button focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:bg-paper focus:px-4 focus:py-2 focus:text-body-sm focus:font-semibold focus:text-ink-navy focus:shadow-lift"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
