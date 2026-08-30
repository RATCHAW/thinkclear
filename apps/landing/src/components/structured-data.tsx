import {
  APP_URL,
  GITHUB_LICENSE_URL,
  GITHUB_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

/**
 * One `<script type="application/ld+json">`, rendered on the server like
 * everything else on this page.
 *
 * Keep it a plain component rather than reaching for `next/script`: this is
 * data in the markup, not code to execute, and a strategy that defers it would
 * mean a crawler reading the static HTML — which is most of them, and every
 * validator — finds nothing there.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // The payload is a literal in this repository, not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Who publishes this, what the thing is, and what it costs — the three
 * questions the page answers in prose, said again in the form a machine reads.
 *
 * `@id` and cross-references rather than three unrelated blocks, so an engine
 * that finds the software understands the organization behind it is the same
 * one that owns the site.
 */
const SITE_GRAPH = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      sameAs: [GITHUB_URL],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: SITE_NAME,
      url: APP_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web browser",
      isAccessibleForFree: true,
      license: GITHUB_LICENSE_URL,
      codeRepository: GITHUB_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
      featureList: [
        "Mindmap canvas with drag-and-drop topics",
        "AI assistant that creates, renames, moves and deletes topics",
        "Markdown notes on every topic",
        "MCP server so external agents can edit the same mindmaps",
        "Self-hostable under AGPL-3.0",
      ],
    },
  ],
};

export function SiteStructuredData() {
  return <JsonLd data={SITE_GRAPH} />;
}
