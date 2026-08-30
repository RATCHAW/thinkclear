import {
  APP_URL,
  GITHUB_URL,
  MCP_AUTHORIZATION_SERVER_METADATA_URL,
  MCP_ENDPOINT,
  MCP_RESOURCE_METADATA_URL,
  SITE_DESCRIPTION,
  SITE_URL,
} from "@/lib/site";
import { MCP_TOOLS } from "@/lib/content";

/**
 * `/.well-known/mcp.json` — where a client looks for an MCP server when all it
 * has is a domain name.
 *
 * There is no ratified well-known URI for this yet: the spec has two competing
 * enhancement proposals in flight and clients probe different paths. What *is*
 * published and stable is the registry's `server.json` schema, so the body is
 * that schema — `$schema`, a reverse-DNS `name`, `description`, `version`,
 * `repository`, `websiteUrl`, and a `remotes` entry naming the transport — and
 * the file sits at the path most clients try. A document that validates against
 * a real schema at a path that may move is a better bet than an invented shape
 * at a path that is certain.
 *
 * `auth` is not in the registry schema and is added deliberately: everything a
 * client needs to authorize is in the two RFC documents below, and a manifest
 * that named the endpoint without naming them would send it to a 401 with
 * nothing to do about it.
 */
export const MCP_MANIFEST = {
  $schema:
    "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  name: "xyz.thinkclear/mindmaps",
  description: SITE_DESCRIPTION,
  version: "1.0.0",
  repository: { url: GITHUB_URL, source: "github" },
  websiteUrl: `${SITE_URL}/mcp`,
  remotes: [
    {
      type: "streamable-http",
      url: MCP_ENDPOINT,
    },
  ],
  auth: {
    type: "oauth2",
    dynamicClientRegistration: true,
    resourceMetadata: MCP_RESOURCE_METADATA_URL,
    authorizationServerMetadata: MCP_AUTHORIZATION_SERVER_METADATA_URL,
    scopes: [...new Set(MCP_TOOLS.map((tool) => tool.scope))],
  },
  documentation: {
    reference: `${SITE_URL}/mcp`,
    setupGuide: `${APP_URL}/?account=mcp`,
    llmsTxt: `${SITE_URL}/llms.txt`,
  },
} as const;
