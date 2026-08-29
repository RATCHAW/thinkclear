import { ClosingCta } from "@/components/closing-cta";
import { DetailsSection } from "@/components/details-section";
import { FaqSection } from "@/components/faq-section";
import { FeaturesSection } from "@/components/features-section";
import { Hero } from "@/components/hero";
import { HowItWorksSection } from "@/components/how-it-works-section";
import { McpSection } from "@/components/mcp-section";
import { OpenSourceSection } from "@/components/open-source-section";
import { ProofStrip } from "@/components/proof-strip";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * The page is a server component and so is every section on it. Three things
 * are interactive — the small-screen menu, the feature accordion, and the
 * scroll reveals — and each of those is the only client boundary in its
 * subtree, with the mocks and icons handed down as already-rendered elements.
 */
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <ProofStrip />
        <FeaturesSection />
        <McpSection />
        <DetailsSection />
        <HowItWorksSection />
        <OpenSourceSection />
        <FaqSection />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
