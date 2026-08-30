import type { Metadata } from "next";
import { DocumentPage } from "@/components/document-page";
import { ABOUT_DOCUMENT } from "@/lib/documents";
import { documentMetadata } from "@/lib/document-metadata";

export const metadata: Metadata = documentMetadata(ABOUT_DOCUMENT);

export default function AboutPage() {
  return <DocumentPage doc={ABOUT_DOCUMENT} />;
}
