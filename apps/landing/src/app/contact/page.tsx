import type { Metadata } from "next";
import { DocumentPage } from "@/components/document-page";
import { CONTACT_DOCUMENT } from "@/lib/documents";
import { documentMetadata } from "@/lib/document-metadata";

export const metadata: Metadata = documentMetadata(CONTACT_DOCUMENT);

export default function ContactPage() {
  return <DocumentPage doc={CONTACT_DOCUMENT} />;
}
