import type { Metadata } from "next";
import { DocumentPage } from "@/components/document-page";
import { PRIVACY_DOCUMENT } from "@/lib/documents";
import { documentMetadata } from "@/lib/document-metadata";

export const metadata: Metadata = documentMetadata(PRIVACY_DOCUMENT);

export default function PrivacyPage() {
  return <DocumentPage doc={PRIVACY_DOCUMENT} />;
}
