import { GitHubIcon } from "@/components/icons";
import { Wordmark } from "@/components/wordmark";
import {
  APP_URL,
  GITHUB_DEPLOYMENT_URL,
  GITHUB_DESIGN_URL,
  GITHUB_ISSUES_URL,
  GITHUB_LICENSE_URL,
  GITHUB_README_URL,
  GITHUB_URL,
  isFirstParty,
  MCP_GUIDE_URL,
  SIGN_UP_URL,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/site";

/**
 * The footer is where a page that is not the home page still has to be able to
 * name everything, so the anchors are rooted (`/#features`) and the four written
 * pages are in it. The developer column is deliberately the one that leads with
 * on-site URLs: the MCP reference and `llms.txt` are what somebody — or
 * something — searching this product by name is trying to find, and a column of
 * links that all leave for GitHub gives a crawler nothing here to index.
 */
const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#open-source", label: "Open source" },
      { href: APP_URL, label: "Open the app" },
    ],
  },
  {
    heading: "Developers",
    links: [
      { href: "/mcp", label: "MCP server" },
      { href: "/llms.txt", label: "llms.txt" },
      { href: MCP_GUIDE_URL, label: "Connect an agent" },
      { href: GITHUB_URL, label: "Source on GitHub" },
      { href: GITHUB_DEPLOYMENT_URL, label: "Self-hosting" },
      { href: GITHUB_DESIGN_URL, label: "Design system" },
    ],
  },
  {
    heading: "About",
    links: [
      { href: "/about", label: `About ${SITE_NAME}` },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
      { href: GITHUB_README_URL, label: "Documentation" },
      { href: GITHUB_LICENSE_URL, label: "License (AGPL-3.0)" },
      { href: GITHUB_ISSUES_URL, label: "Report an issue" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-hairline bg-cloud">
      <div className="mx-auto max-w-page px-5 py-14 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <span className="inline-flex text-ink-navy">
              <Wordmark />
            </span>
            <p className="mt-4 max-w-[260px] text-body-sm text-slate-gray">
              {SITE_TAGLINE}
            </p>
            <a
              href={GITHUB_URL}
              rel="noreferrer"
              aria-label={`${SITE_NAME} on GitHub`}
              className="mt-5 inline-flex size-9 items-center justify-center rounded-input border border-hairline bg-paper text-ink-navy transition-colors duration-150 hover:border-mist-gray"
            >
              <GitHubIcon className="size-[18px]" />
            </a>
          </div>

          {/* The column labels name three groups of links, which is a job for
              a label and not for a heading: as `<h2>` they sat in the document
              outline as peers of the sections above, so a screen reader
              walking the page by heading found "Product" and "Developers"
              alongside the actual argument the page is making. `aria-labelledby`
              keeps the grouping without the rank. */}
          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <p
                id={`footer-${column.heading.toLowerCase()}`}
                className="text-caption font-semibold tracking-[0.1em] text-slate-gray uppercase"
              >
                {column.heading}
              </p>
              <ul
                aria-labelledby={`footer-${column.heading.toLowerCase()}`}
                className="mt-4 flex flex-col gap-3"
              >
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      rel={
                        link.href.startsWith("http") && !isFirstParty(link.href)
                          ? "noreferrer"
                          : undefined
                      }
                      className="text-body-sm font-medium text-ink-navy transition-colors duration-150 hover:text-signal-blue"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-6">
          <p className="text-caption text-slate-gray">
            © {year} {SITE_NAME}. Licensed under the GNU AGPL v3.0.
          </p>
          <a
            href={SIGN_UP_URL}
            className="text-caption font-semibold text-ink-navy transition-colors duration-150 hover:text-signal-blue"
          >
            app.thinkclear.xyz
          </a>
        </div>
      </div>
    </footer>
  );
}
