import {
  FAQ_QUESTIONS,
  MCP_TOOLS,
  PRODUCT_FEATURES,
  WHEN_NOT_TO_USE,
  WHEN_TO_USE,
} from "@/lib/content";
import {
  findDocument,
  SITE_DOCUMENTS,
  type DocumentBlock,
  type SiteDocument,
} from "@/lib/documents";
import {
  APP_URL,
  CONTACT_EMAIL,
  GITHUB_DEPLOYMENT_URL,
  GITHUB_ISSUES_URL,
  GITHUB_LICENSE_URL,
  GITHUB_README_URL,
  GITHUB_URL,
  LLMS_TXT_URL,
  MCP_AUTHORIZATION_SERVER_METADATA_URL,
  MCP_ENDPOINT,
  MCP_MANIFEST_URL,
  MCP_RESOURCE_METADATA_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  SITEMAP_URL,
} from "@/lib/site";

/**
 * The markdown half of this site.
 *
 * Every URL here answers twice: HTML to a browser, CommonMark to a client that
 * asked for `text/markdown`. This module renders the second one — from the same
 * arrays and docs the first is rendered from, so the two cannot describe
 * different products.
 *
 * It is imported by the middleware, so it stays pure string assembly: no
 * filesystem, no Node built-ins, nothing that would not run on an edge runtime.
 */

const join = (parts: string[]): string =>
  `${parts.filter(Boolean).join("\n\n")}\n`;

const bullets = (items: readonly string[]): string =>
  items.map((item) => `- ${item}`).join("\n");

const toolBullets = (): string =>
  bullets(
    MCP_TOOLS.map(
      (tool) => `\`${tool.name}\` (${tool.scope}): ${tool.summary}`,
    ),
  );

function renderBlock(block: DocumentBlock): string {
  switch (block.kind) {
    case "paragraph":
      return block.text;
    case "list":
      return bullets(block.items);
    case "links":
      return block.items
        .map(
          (item) =>
            `- [${item.label}](${item.href})${item.note ? `: ${item.note}` : ""}`,
        )
        .join("\n");
    case "code":
      return [
        block.caption ? `${block.caption}:` : "",
        "```",
        block.code,
        "```",
      ]
        .filter(Boolean)
        .join("\n");
    case "tools":
      return toolBullets();
  }
}

/**
 * A page as markdown: the H1, the description as a blockquote, the standfirst,
 * then each section under an H2. The blockquote is the same sentence the HTML
 * serves as its meta description — an agent reading only the first three lines
 * of this file should already know whether to keep going.
 */
export function renderDocumentMarkdown(doc: SiteDocument): string {
  return join([
    `# ${doc.title}`,
    `> ${doc.description}`,
    doc.lead,
    ...doc.sections.flatMap((section) => [
      `## ${section.heading}`,
      ...section.blocks.map(renderBlock),
    ]),
    "---",
    bullets([
      `Home: ${SITE_URL}`,
      `Open the app: ${APP_URL}`,
      `Agent index: ${LLMS_TXT_URL}`,
    ]),
  ]);
}

/**
 * The home page as markdown.
 *
 * Not a transcription of the marketing copy — the hero's job is to make
 * somebody curious, and repeating it to a machine wastes both our time. This is
 * the same page's *claims*: what it is, when to reach for it, how to connect,
 * and the answers to the questions the FAQ already holds.
 */
export function renderHomeMarkdown(): string {
  return join([
    `# ${SITE_NAME}`,
    `> ${SITE_DESCRIPTION}`,
    "ThinkClear is a mindmap canvas with an assistant that can build it with you. A mindmap is a tree of topics with one root; every topic can carry one markdown note. The tools the assistant calls are also served over the Model Context Protocol, so the agent you already use edits the same maps, and its edits appear on the open canvas as they happen.",
    "## What it does",
    bullets(PRODUCT_FEATURES),
    "## When to use ThinkClear",
    bullets(WHEN_TO_USE),
    "## When not to use it",
    bullets(WHEN_NOT_TO_USE),
    "## Getting access",
    "Free, self-serve, no credit card and no seat count. Sign up with an email address and a password, or with Google — signing in with Google at an address the account already has joins it rather than starting a second one. Connecting an agent needs no API key either: the MCP server answers an unauthenticated call with an RFC 9728 challenge, your client registers itself through dynamic client registration, and you approve the scopes on a consent screen. Grants are revoked from the account screen.",
    bullets([
      `Sign up: ${APP_URL}`,
      `MCP endpoint (Streamable HTTP): ${MCP_ENDPOINT}`,
      `Self-host instead: ${GITHUB_DEPLOYMENT_URL}`,
    ]),
    "## MCP tools",
    toolBullets(),
    "## Questions",
    FAQ_QUESTIONS.map(
      (entry) => `### ${entry.question}\n\n${entry.answer}`,
    ).join("\n\n"),
    "## More",
    bullets([
      `[MCP reference](${SITE_URL}/mcp)`,
      `[About](${SITE_URL}/about)`,
      `[Contact](${SITE_URL}/contact)`,
      `[Privacy](${SITE_URL}/privacy)`,
      `[Source on GitHub](${GITHUB_URL})`,
    ]),
  ]);
}

/**
 * The body of a 404, in markdown.
 *
 * A status code tells an agent the path was wrong; it does not tell it what to
 * try instead, and an agent that cannot recover from a wrong guess gives up on
 * the whole domain. So the body is a map out: every page there is, plus the two
 * machine-readable indexes it should have read first.
 */
export function renderNotFoundMarkdown(path: string): string {
  return join([
    "# 404 — page not found",
    `> There is no page at \`${path}\` on ${SITE_URL}. This site is small; the list below is all of it.`,
    "## Pages",
    bullets([
      `[Home](${SITE_URL}): what ThinkClear is`,
      ...SITE_DOCUMENTS.map(
        (doc) => `[${doc.title}](${SITE_URL}${doc.path}): ${doc.description}`,
      ),
    ]),
    "## Start here instead",
    bullets([
      `[llms.txt](${LLMS_TXT_URL}): the index of this site, written for agents`,
      `[sitemap.xml](${SITEMAP_URL}): every URL`,
      `[MCP manifest](${MCP_MANIFEST_URL}): the endpoint and its transport, as JSON`,
      `[The app](${APP_URL}): the product itself, which is not on this domain`,
    ]),
  ]);
}

/**
 * `/llms.txt`, in the shape llmstxt.org specifies: an H1, a blockquote summary,
 * details that are not headings, then H2 sections of markdown link lists.
 *
 * The one section that is not a link list is "When to use ThinkClear", and it
 * earns the exception — it is the question an agent is actually holding when it
 * arrives here, and a list of links does not answer it.
 */
export function renderLlmsTxt(): string {
  return join([
    `# ${SITE_NAME}`,
    `> ${SITE_DESCRIPTION}`,
    "The product lives at app.thinkclear.xyz; this domain is its front door. Everything an agent can do here is done over MCP against that app, authorized with OAuth 2.1 — there is no separate REST API and no API key to request.",
    "Every page on this site also answers to `Accept: text/markdown` with a markdown rendering of itself, so there is no need to parse the HTML.",
    "## When to use ThinkClear",
    bullets(WHEN_TO_USE),
    "## When not to use it",
    bullets(WHEN_NOT_TO_USE),
    "## Connecting an agent",
    bullets([
      `[MCP endpoint](${MCP_ENDPOINT}): Streamable HTTP. Unauthenticated calls answer 401 with an RFC 9728 challenge.`,
      `[MCP manifest](${MCP_MANIFEST_URL}): name, version, transport and auth, as JSON.`,
      `[MCP reference](${SITE_URL}/mcp): the endpoint, the twelve tools, and the two scopes.`,
      `[Protected resource metadata](${MCP_RESOURCE_METADATA_URL}): RFC 9728.`,
      `[Authorization server metadata](${MCP_AUTHORIZATION_SERVER_METADATA_URL}): RFC 8414, with dynamic client registration.`,
      `[Setup guide, per client](${APP_URL}/?account=mcp): inside the app, once signed in.`,
    ]),
    "## Tools",
    toolBullets(),
    "## Pages",
    bullets([
      `[Home](${SITE_URL}): what it is, how it works, and the FAQ.`,
      ...SITE_DOCUMENTS.map(
        (doc) => `[${doc.title}](${SITE_URL}${doc.path}): ${doc.description}`,
      ),
    ]),
    "## Optional",
    bullets([
      `[Source on GitHub](${GITHUB_URL}): the whole monorepo.`,
      `[README](${GITHUB_README_URL}): running it locally.`,
      `[Self-hosting guide](${GITHUB_DEPLOYMENT_URL}): the two-host deployment.`,
      `[License](${GITHUB_LICENSE_URL}): AGPL-3.0.`,
      `[Issue tracker](${GITHUB_ISSUES_URL}): bugs and feature requests.`,
      `[Contact](mailto:${CONTACT_EMAIL}): anything that should not be public.`,
      `[Sitemap](${SITEMAP_URL}): every URL on this domain.`,
    ]),
  ]);
}

/**
 * The markdown for a path, and the status it should be served with.
 *
 * One function because the middleware needs both answers at once and there is
 * no third case: either this site has the page or it is telling the caller
 * where to look instead.
 */
export function markdownForPath(path: string): {
  body: string;
  status: number;
} {
  if (path === "/") return { body: renderHomeMarkdown(), status: 200 };
  const doc = findDocument(path);
  if (doc) return { body: renderDocumentMarkdown(doc), status: 200 };
  return { body: renderNotFoundMarkdown(path), status: 404 };
}
