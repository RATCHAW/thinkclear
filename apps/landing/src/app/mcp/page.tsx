import type { Metadata } from "next";
import { DocumentPage } from "@/components/document-page";
import { MCP_DOCUMENT } from "@/lib/documents";
import { documentMetadata } from "@/lib/document-metadata";

export const metadata: Metadata = documentMetadata(MCP_DOCUMENT);

export default function McpPage() {
  return <DocumentPage doc={MCP_DOCUMENT} />;
}
