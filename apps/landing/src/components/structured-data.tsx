import { PRODUCT_FEATURES } from "@/lib/content";
import {
  APP_URL,
  CONTACT_EMAIL,
  GITHUB_ISSUES_URL,
  GITHUB_LICENSE_URL,
  GITHUB_URL,
  ORGANIZATION_ADDRESS,
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
 * How to reach the people behind this, in the form an engine checks before it
 * recommends anything.
 *
 * Two entries because there are genuinely two routes and they are not
 * interchangeable: the issue tracker is where support actually happens, in
 * public, and the mailbox is for the things that cannot be public. Listing only
 * the email would describe a support process nobody here uses.
 */
const CONTACT_POINTS = [
  {
    "@type": "ContactPoint",
    contactType: "technical support",
    url: GITHUB_ISSUES_URL,
    email: CONTACT_EMAIL,
    availableLanguage: "English",
  },
  {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: CONTACT_EMAIL,
    url: `${SITE_URL}/contact`,
    availableLanguage: "English",
  },
];

/**
 * Who publishes this, what the thing is, and what it costs — the three
 * questions the page answers in prose, said again in the form a machine reads.
 *
 * `@id` and cross-references rather than three unrelated blocks, so an engine
 * that finds the software understands the organization behind it is the same
 * one that owns the site.
 *
 * `address` appears only when there is one. Structured data is checked precisely
 * because it is the claim a machine trusts without reading the page, so an
 * invented `PostalAddress` would be worse than the missing field it papers over
 * — see `ORGANIZATION_ADDRESS`.
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
      description: SITE_DESCRIPTION,
      email: CONTACT_EMAIL,
      contactPoint: CONTACT_POINTS,
      ...(ORGANIZATION_ADDRESS
        ? { address: { "@type": "PostalAddress", ...ORGANIZATION_ADDRESS } }
        : {}),
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
      featureList: [...PRODUCT_FEATURES],
    },
  ],
};

export function SiteStructuredData() {
  return <JsonLd data={SITE_GRAPH} />;
}
