import {
  APP_URL,
  CONTACT_EMAIL,
  GITHUB_DEPLOYMENT_URL,
  GITHUB_DISCUSSIONS_URL,
  GITHUB_ISSUES_URL,
  GITHUB_LICENSE_URL,
  GITHUB_README_URL,
  GITHUB_URL,
  MCP_AUTHORIZATION_SERVER_METADATA_URL,
  MCP_ENDPOINT,
  MCP_GUIDE_URL,
  MCP_RESOURCE_METADATA_URL,
  SITE_NAME,
} from "@/lib/site";

/**
 * The written pages — about, contact, privacy, and the MCP reference — held as
 * a small document model rather than as JSX.
 *
 * This page serves every URL twice: as HTML to a browser and as markdown to a
 * client that asked for `text/markdown`. Two hand-written copies of the same
 * paragraph is two copies that drift, and the one that drifts is always the
 * machine-readable one, because nobody looks at it. So the prose is written
 * once in this shape and both renderers derive from it —
 * `components/document-page.tsx` into the page's own visual system,
 * `lib/markdown.ts` into CommonMark.
 *
 * The block vocabulary is deliberately narrow. Almost everything a page like
 * this needs to say is a paragraph, a list, a set of links, or a command; a
 * sixth block would be a sign that something here wants to be a real page with
 * a layout instead.
 *
 * `tools` is the one block with no content of its own — it renders `MCP_TOOLS`,
 * as a definition list in HTML and as bullets in markdown. It is a block rather
 * than a hand-written list because the tool names are a contract with a running
 * server, and a page that lists them has to be wrong in both representations at
 * once or in neither.
 */

export type DocumentBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "links"; items: { label: string; href: string; note?: string }[] }
  | { kind: "code"; code: string; caption?: string }
  | { kind: "tools" };

export interface DocumentSection {
  heading: string;
  blocks: DocumentBlock[];
}

export interface SiteDocument {
  /** The path this is served at, leading slash, no trailing slash. */
  path: string;
  /** The `<h1>`, and the first half of the title tag. */
  title: string;
  /** The meta description, and the blockquote at the top of the markdown. */
  description: string;
  /** The standfirst under the heading. One paragraph, no more. */
  lead: string;
  sections: DocumentSection[];
}

const ABOUT: SiteDocument = {
  path: "/about",
  title: `About ${SITE_NAME}`,
  description: `${SITE_NAME} is an open-source mindmap canvas with a built-in assistant and an MCP server, published under the AGPL-3.0 and free to self-host.`,
  lead: "ThinkClear is a mindmap canvas with an assistant that can build it with you, and an MCP server so the agent you already use can edit the same maps. It is open source, free to use, and free to run yourself.",
  sections: [
    {
      heading: "What it is",
      blocks: [
        {
          kind: "paragraph",
          text: "A mindmap here is a tree of topics with one root, drawn on a canvas you can drag. You type into it, or you say what you are working through and the assistant grafts the branches on: creating topics, renaming them, moving them between parents, deleting the ones that turned out to be wrong. Every topic can carry one markdown note, written as source and read as rendered prose, so the thinking that does not fit in four words on a node has somewhere to live on the node it belongs to.",
        },
        {
          kind: "paragraph",
          text: "The part that is unusual is the second transport. The tools the built-in assistant calls are also served over the Model Context Protocol, so a client like Claude Code or Cursor gets the same twelve tools against the same maps, under the same ownership rules. An edit made from a terminal shows up on the open canvas as it happens, because every server-side write announces itself over a server-sent event stream and the editor reseeds from it.",
        },
      ],
    },
    {
      heading: "Who publishes it",
      blocks: [
        {
          kind: "paragraph",
          text: "ThinkClear is an independent open-source project, not a company. There is no sales team, no seat count, and no contract to sign — which is also why there is no address on this page: there is no registered entity behind it to give one for. The whole source tree is public, including the deployment configuration and the design system, and the issue tracker is where the roadmap actually lives.",
        },
        {
          kind: "links",
          items: [
            {
              label: "Source on GitHub",
              href: GITHUB_URL,
              note: "the monorepo — API, web app, landing page, shared schemas",
            },
            {
              label: "README",
              href: GITHUB_README_URL,
              note: "what it is and how to run it locally",
            },
            {
              label: "License (AGPL-3.0)",
              href: GITHUB_LICENSE_URL,
              note: "network use counts as distribution, so a hosted fork publishes its source too",
            },
            {
              label: "Deployment guide",
              href: GITHUB_DEPLOYMENT_URL,
              note: "the two-host setup this instance runs on",
            },
          ],
        },
      ],
    },
    {
      heading: "How it is built",
      blocks: [
        {
          kind: "paragraph",
          text: "The API is NestJS on MongoDB with Better Auth, which doubles as the OAuth 2.1 authorization server the MCP endpoint authenticates against. The app is React on Vite with React Flow for the canvas. This page is Next.js, deployed separately, and it imports nothing from the rest of the repository on purpose — a copy change here should never be a reason to rebuild the API.",
        },
        {
          kind: "paragraph",
          text: "Everything the assistant can do goes through the same service the HTTP routes do, so there is exactly one place ownership is checked. Another person's mindmap and a mindmap that does not exist are both a 404, from every transport.",
        },
      ],
    },
    {
      heading: "What it costs",
      blocks: [
        {
          kind: "paragraph",
          text: "Nothing. Sign up with an email address and a password, or with Google, and you are in — no credit card, no trial clock, no call with anyone. Connecting an agent is self-serve too: there is no key to request, because the OAuth flow issues the token itself the first time your client calls the endpoint.",
        },
        {
          kind: "paragraph",
          text: "The hosted instance is run at the maintainer's expense and is offered as-is. If that is not a footing you want to build on, the alternative is not a bigger plan — it is running the same code yourself, which costs a container and a MongoDB and no license.",
        },
      ],
    },
  ],
};

const CONTACT: SiteDocument = {
  path: "/contact",
  title: `Contact ${SITE_NAME}`,
  description: `How to reach ${SITE_NAME}: the public issue tracker for bugs and features, discussions for questions, and an email address for anything that should not be public.`,
  lead: "Most things are better in public, where the next person with the same problem can find the answer. Bugs and feature requests go to the issue tracker; anything that should not be public goes to the mailbox at the bottom.",
  sections: [
    {
      heading: "Report a bug or ask for a feature",
      blocks: [
        {
          kind: "paragraph",
          text: "The GitHub issue tracker is the real one — it is where the work is planned, not a form that forwards somewhere else. Include what you did, what happened, and what you expected; if it involves an agent, the client you connected and the tool it called narrow it down faster than anything else.",
        },
        {
          kind: "links",
          items: [
            {
              label: "Open an issue",
              href: GITHUB_ISSUES_URL,
              note: "bugs, feature requests, anything reproducible",
            },
            {
              label: "Start a discussion",
              href: GITHUB_DISCUSSIONS_URL,
              note: "questions, self-hosting help, ideas that are not yet a request",
            },
          ],
        },
      ],
    },
    {
      heading: "Security",
      blocks: [
        {
          kind: "paragraph",
          text: "Please do not open a public issue for a vulnerability. Email the address below with enough detail to reproduce it and give it a few days before disclosing anywhere else. This is a small project with no bounty programme and no dedicated inbox rotation, so what you get in return is a straight answer about whether it is real and when it is fixed.",
        },
      ],
    },
    {
      heading: "Everything else",
      blocks: [
        {
          kind: "paragraph",
          text: `Licensing questions, press, data requests about your own account, or anything that does not belong in a public thread: ${CONTACT_EMAIL}. It is read by one person, so expect a human reply rather than a fast one.`,
        },
        {
          kind: "links",
          items: [
            {
              label: `Email ${CONTACT_EMAIL}`,
              href: `mailto:${CONTACT_EMAIL}`,
            },
            {
              label: "Delete your account",
              href: `${APP_URL}/?account=profile`,
              note: "from the account screen in the app, no email required",
            },
          ],
        },
      ],
    },
  ],
};

const PRIVACY: SiteDocument = {
  path: "/privacy",
  title: "Privacy",
  description: `What ${SITE_NAME} stores, what leaves the server, and what it does not collect. No analytics, no advertising, no third-party trackers on this page or in the app.`,
  lead: "This page describes the hosted instance at app.thinkclear.xyz. A self-hosted copy stores the same things in a database you control, and none of it reaches anyone here.",
  sections: [
    {
      heading: "What this marketing page collects",
      blocks: [
        {
          kind: "paragraph",
          text: "Nothing. thinkclear.xyz is a set of static files with no analytics script, no advertising pixel, no third-party embeds, and no cookies of its own. Fonts are served from this origin rather than a font host, so loading the page does not tell anyone else that you did. The hosting provider keeps ordinary request logs, as every web server does.",
        },
      ],
    },
    {
      heading: "What the app stores",
      blocks: [
        {
          kind: "paragraph",
          text: "An account is an email address, a display name, and either a password hash or a link to the identity provider you signed in with. Everything else in the database is content you made: your mindmaps and their topics, the markdown notes on those topics, your conversations with the assistant, your layout preference, and the list of agent clients you have granted access to.",
        },
        {
          kind: "paragraph",
          text: "Every one of those rows is scoped to the account that owns it, and every read is filtered by owner before it is filtered by anything else. There is no admin view that browses other people's maps.",
        },
      ],
    },
    {
      heading: "What leaves the server",
      blocks: [
        {
          kind: "list",
          items: [
            "Messages you send to the assistant, and the parts of a mindmap it reads to answer them, go to the configured model provider through LLM Gateway. That is the one place your content is handled by a third party, and it happens only when you use the assistant.",
            "If you sign in with Google, Google learns that you signed in here — the ordinary consequence of using it as an identity provider. Signing in with an email and password involves no third party at all.",
            "Nothing is sold, and nothing is shared for advertising. There is no advertising.",
          ],
        },
      ],
    },
    {
      heading: "Cookies and tokens",
      blocks: [
        {
          kind: "paragraph",
          text: "The app sets one session cookie, first-party and host-only on app.thinkclear.xyz. It is not readable by this page, and it is deliberately not widened to cover the whole domain. There are no tracking cookies, so there is no consent banner to dismiss.",
        },
        {
          kind: "paragraph",
          text: "An agent connected over MCP holds an OAuth access token instead of a cookie, bound to the scopes you approved on a consent screen. A token granted read access is served a tool list with no way to edit anything — the restriction is that the tools are not registered, not that the calls are refused. Every grant is listed in the account screen and can be revoked there, which takes the agent's access away immediately.",
        },
      ],
    },
    {
      heading: "Keeping and deleting",
      blocks: [
        {
          kind: "paragraph",
          text: "Content is kept until you delete it. Deleting a mindmap or a conversation removes the document; deleting your account from the account screen removes the account and the content that hangs off it. Backups of the database roll over on their own schedule, so a deletion can survive in a backup for a short window after it has left the live database.",
        },
        {
          kind: "paragraph",
          text: "If you would rather none of this were somebody else's problem, the source is AGPL-3.0 and the deployment guide is public: run it yourself and the only privacy policy that applies is your own.",
        },
        {
          kind: "links",
          items: [
            { label: "Self-hosting guide", href: GITHUB_DEPLOYMENT_URL },
            {
              label: `Data questions: ${CONTACT_EMAIL}`,
              href: `mailto:${CONTACT_EMAIL}`,
            },
          ],
        },
      ],
    },
  ],
};

const MCP: SiteDocument = {
  path: "/mcp",
  title: `${SITE_NAME} MCP server`,
  description: `Connect an agent to ${SITE_NAME} over the Model Context Protocol: one Streamable HTTP endpoint, OAuth 2.1 with dynamic client registration, twelve tools for reading and editing mindmaps.`,
  lead: "One endpoint, Streamable HTTP, OAuth 2.1. There is no API key to request and nothing to paste — the server registers your client itself and issues the token on first call.",
  sections: [
    {
      heading: "The endpoint",
      blocks: [
        { kind: "code", code: MCP_ENDPOINT },
        {
          kind: "paragraph",
          text: "Streamable HTTP transport, served statelessly: every request builds a fresh server from the token it carries, which is what lets the token decide both the owner and the tool list. Clients speaking the 2025-era protocol revisions are accepted as well as current ones.",
        },
        {
          kind: "code",
          caption: "Claude Code",
          code: `claude mcp add --transport http thinkclear ${MCP_ENDPOINT}`,
        },
      ],
    },
    {
      heading: "Authorization",
      blocks: [
        {
          kind: "paragraph",
          text: "An unauthenticated call is answered with 401 and an RFC 9728 challenge naming the protected resource metadata, which names the authorization server, which advertises dynamic client registration. Your client walks that chain on its own: it registers itself, opens a browser, you approve the scopes on a consent screen, and it holds a token it refreshes without asking again. Grants are listed in the app's account screen and revoked from there.",
        },
        {
          kind: "links",
          items: [
            {
              label: "Protected resource metadata",
              href: MCP_RESOURCE_METADATA_URL,
              note: "RFC 9728 — what the endpoint is and which server authorizes it",
            },
            {
              label: "Authorization server metadata",
              href: MCP_AUTHORIZATION_SERVER_METADATA_URL,
              note: "RFC 8414 — endpoints, scopes, and the registration URL",
            },
            {
              label: "Setup guide, per client",
              href: MCP_GUIDE_URL,
              note: "inside the app, once you are signed in",
            },
          ],
        },
        {
          kind: "paragraph",
          text: "Both documents carry a path because the resource and the issuer do. There is nothing at the bare /.well-known/oauth-authorization-server, and that is correct rather than missing: this server's issuer is app.thinkclear.xyz/api/auth, and metadata served at the origin root would claim an issuer that does not match where it was fetched from.",
        },
      ],
    },
    {
      heading: "Tools",
      blocks: [
        {
          kind: "paragraph",
          text: "Twelve, and they are the same objects the built-in assistant calls — one definition, two transports, so anything the chat panel can do to a mindmap a connected agent can do too. Prefer the batch calls: add_topics takes a nested tree and the rename, move and delete tools take lists, so a reorganization is one round trip rather than twenty.",
        },
        { kind: "tools" },
        {
          kind: "paragraph",
          text: "A tool that returns an error also returns the issues that caused it, which is a repair instruction rather than a refusal — fix the edit and call again instead of asking the user what to do.",
        },
      ],
    },
    {
      heading: "Scopes",
      blocks: [
        {
          kind: "list",
          items: [
            "mindmaps:read — read your mindmaps and the topics inside them.",
            "mindmaps:write — create, rename, reorganize, and delete your mindmaps and topics.",
          ],
        },
        {
          kind: "paragraph",
          text: "Ask for the narrower one when the job only reads. Scopes are enforced by leaving tools out of the registration, so a read-only token is served a tool list with no way to edit anything and the agent never plans a call that was going to be refused.",
        },
      ],
    },
  ],
};

/** Every written page, in the order they appear in the sitemap. */
export const SITE_DOCUMENTS: SiteDocument[] = [MCP, ABOUT, CONTACT, PRIVACY];

export const ABOUT_DOCUMENT = ABOUT;
export const CONTACT_DOCUMENT = CONTACT;
export const PRIVACY_DOCUMENT = PRIVACY;
export const MCP_DOCUMENT = MCP;

export function findDocument(path: string): SiteDocument | undefined {
  return SITE_DOCUMENTS.find((document) => document.path === path);
}
