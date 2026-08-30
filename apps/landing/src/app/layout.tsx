import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { SiteStructuredData } from "@/components/structured-data";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
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

/**
 * `og:image` and `twitter:image` are deliberately absent here: `next` fills
 * both in from `app/opengraph-image.tsx`, and a hand-written entry would
 * override the generated one and go stale the first time that file changed.
 *
 * There is no `keywords` — no engine has read it in fifteen years, and the
 * words it listed are ones the title and the copy should be earning anyway.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
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
        <SiteStructuredData />
      </body>
    </html>
  );
}
