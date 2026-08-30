# CLAUDE.md

Guidance for Claude Code working in this repository.

## Commands

```bash
pnpm install
docker compose up -d mongo          # MongoDB on :27017 (required for api + auth)
cp apps/api/.env.example apps/api/.env   # then set BETTER_AUTH_SECRET
pnpm dev                            # turbo: api :3000, web :5173, landing :4000
pnpm build                          # all workspaces
pnpm lint                           # ESLint, including type-aware promise rules
pnpm lint:fix                       # apply safe ESLint fixes
pnpm format                         # write Prettier formatting
pnpm format:check                   # check formatting without writing
pnpm typecheck                      # source type checks
pnpm test                           # all Vitest spec + end-to-end projects
pnpm test:spec                      # shared, API, and web unit specs
pnpm test:e2e                       # API HTTP + Chromium browser flows
pnpm test:watch                     # interactive Vitest watch mode
pnpm test:coverage                  # whole-repo coverage report
pnpm test:install-browser           # install Chromium for browser tests
pnpm openapi                        # regenerate openapi.json + web api-types.d.ts
```

Vitest is split into named projects: `shared:spec`, `api:spec`, `web:spec`,
`landing:spec`, `api:e2e`, and `web:e2e`. The browser project uses headless Chromium through
Vitest Browser Mode. Install it once with `pnpm test:install-browser`
if the local Playwright cache is empty. ESLint and Prettier are configured once
at the repository root; formatting rules are disabled inside ESLint so the two
tools do not compete. Run type checks from the root so turbo builds
`@thinkclear/shared` first;
`apps/api` and `apps/web` both consume it from `dist/`, so editing
`packages/shared` and typechecking a single app in isolation will check against
a stale build.

Single-workspace commands: `pnpm --filter @thinkclear/api <script>` (likewise
`@thinkclear/web`, `@thinkclear/landing`, `@thinkclear/shared`).

`apps/landing` is nearly outside all of that on purpose: no generated contract
and no dependency on `packages/shared`, so `pnpm --filter @thinkclear/landing
dev` is enough to work on it alone. Its `landing:spec` project is the one thread
back, and it is deliberately thin — the app still imports nothing, but the specs
import `@thinkclear/shared` to check the facts the site now restates to agents
(the MCP tool names and their scopes) against the definitions the API enforces.
That is why `apps/landing/tsconfig.json` excludes `test` and
`tsconfig.test.json` picks it up with a path to shared: the app config cannot
resolve a workspace package at all, so the rule is a compile error rather than a
convention.

## Dev servers

Several Conductor workspaces share this machine and the fixed ports (api :3000,
landing :4000, web :5173), so treat servers as a checked-out resource:

- **Before starting anything**, check what's already listening:
  `lsof -nP -iTCP:3000 -iTCP:4000 -iTCP:5173 -sTCP:LISTEN`. If the ports are
  taken, reuse the running servers (nest/vite/next hot-reload code edits
  automatically) — don't kill another workspace's servers without asking.
- **If you start servers for a task** (verification, browser testing), stop
  them when the task is done and confirm the ports are free again. Don't leave
  background dev servers running at the end of a turn.
- The `thinkclear-mongo` Docker container is shared infra: leave it running if
  it is already up, and leave it up even after stopping the app servers.

## Architecture

Turborepo + pnpm workspaces, four packages:

- `apps/api` — NestJS 11, Mongoose, Better Auth, Swagger, Vercel AI SDK
- `apps/web` — Vite + React 19, Tailwind v4, shadcn/ui, React Flow, React Query
- `apps/landing` — Next.js 16 App Router, React 19, Tailwind v4 (the marketing
  site on `thinkclear.xyz`; deployed separately, see below)
- `packages/shared` — zod schemas + types imported by the api and the web app

### The API contract is generated, in two hops

1. Nest controllers + `@Api*` decorators + DTO classes → `apps/api/openapi.json`
   (`generate-openapi.ts` boots the app without listening and writes the spec)
2. `openapi.json` → `apps/web/src/lib/api-types.d.ts` via `openapi-typescript`

Both files are committed. **Never hand-edit `api-types.d.ts`** — change the API
and run `pnpm openapi`. Any change to a route, DTO, or response shape is
incomplete until that regeneration is committed alongside it.

### Request shapes are described twice, on purpose

- `packages/shared/src/*.ts` — zod schemas that actually **validate** requests,
  via `new ZodValidationPipe(schema)` on the `@Body()` param. The web app imports
  the same schemas, so both ends agree on what is valid.
- `apps/api/src/mindmaps/mindmap.dto.ts` — Nest DTO classes that exist only to
  **document** the shape for Swagger/OpenAPI (and therefore the web types).

They are not linked. Adding a field means editing the zod schema *and* the DTO
class, then regenerating. A DTO that drifts from its schema produces web types
that lie.

### MCP is the second transport over the same tools

`POST /api/mcp` (apps/api/src/mcp) serves the Model Context Protocol to
outside agent clients. It defines **no tools of its own**: `McpService` adapts
the AI SDK tool set from `MindmapToolsService.forOwner()` into MCP
registrations, so the chat panel and a connected agent call the same objects
and a tool added for one appears in the other. `packages/shared/src/mcp.ts`
derives each tool's required scope from `MUTATING_CHAT_TOOLS`, so a new write
tool cannot become callable with a read-only token by omission.

That derivation is the point, and notes are the worked example: `read_topic_note`
and `set_topic_note` were added for the assistant and reached MCP correctly
scoped with no change in `apps/api/src/mcp`. What a new tool *does* need is a
decision about `isDestructiveMcpTool` — the list is "content that cannot be
typed back" (the deletes, and `set_topic_note`, which replaces a note
wholesale), deliberately narrower than the MCP spec's additive/non-additive
split so the hint keeps meaning something. `mcp.service.spec.ts` asserts the
full tool list against the real `MindmapToolsService`, so adding a tool fails
there until it has been placed.

Serving is per-request and stateless (`createMcpHandler` with
`legacy: "stateless"`, which keeps 2025-era clients working — `reject` would
validate but nothing shipping could connect). The factory builds a fresh
`McpServer` per request from that request's verified token, which is what lets
the token decide the owner and the tool list. Scopes are enforced by
**omission**: an ungranted tool is not registered, so it is "no such tool"
rather than "denied".

Auth is OAuth 2.1, not the session cookie. `auth.ts` adds `jwt()` +
`mcp()` from `@better-auth/mcp`, which makes Better Auth the authorization
server; `requireMcpAuth` verifies the bearer token against its JWKS and answers
an unauthenticated call with the RFC 9728 challenge that bootstraps the whole
flow. Three things follow, and each is load-bearing:

- **`APP_URL` is the app's public origin, not the API's port.** The authorize
  endpoint redirects to `/sign-in` and `/consent`, which the *web* app serves,
  so the issuer has to be the origin those pages are on. `/api` is proxied
  there already.
- **Discovery lives at the origin root**, fixed by RFC 9728/8414, which is the
  one place Better Auth is not mounted. `OAuthDiscoveryController` forwards
  those paths into `auth.handler` unchanged — the plugin's `onRequest` hook
  matches on the raw pathname — so there is no second copy of the metadata.
  Both the vite proxy and `nginx.conf` must pass `/.well-known` through.
- **Both controllers are `@Public()`.** They are not unprotected: the module's
  global session guard would answer a bare 401 with no challenge in it, and a
  client with no cookie would have nowhere to go. `requireMcpAuth` is the check
  that replaces it. `mcp.e2e-spec.ts` imports the real `AuthModule` so removing
  `@Public()` fails the suite rather than silently breaking every client.

`MCP_JWKS_URL` overrides where tokens are verified against. It defaults to
`APP_URL`, which is right when that origin is reachable from the API — but in
the compose stack the API sits *behind* the web container, so it is set to the
API's own address there.

### Auth and ownership

Better Auth is mounted by `AuthModule.forRoot({ auth })` from
`@thallesp/nestjs-better-auth`; `apps/api/src/auth.ts` configures it against the
same Mongo database via its own `MongoClient`. `main.ts` creates the app with
`bodyParser: false` because Better Auth needs the raw body — the auth module
re-adds parsers for everything else. Don't re-enable the global body parser.

Better Auth is also the OAuth authorization server for MCP (see above), so
`auth.ts` carries the `jwt()` and `mcp()` plugins and `baseURL` is `APP_URL`.

**A social provider is registered only if its whole credential is present.**
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` must both be set or Google is not
in `socialProviders` at all — a self-hosted instance with no Google app is the
normal case, not a misconfiguration. `SOCIAL_PROVIDERS` in `auth.ts` is that
decision made once, and `GET /api/me` reports it so the account screen can hide
a button rather than render one that 400s on press. The candidate list and the
on-screen labels live in `packages/shared/src/account.ts`, next to the MCP
scopes and for the same reason.

`accountLinking.trustedProviders` includes Google, so signing in with Google at
an address an account already has *joins* that account instead of starting a
second one. The trust being extended is specifically that the provider verified
the address — the join is keyed on email, so a provider that does not verify
must stay off that list.

Every resource route takes `@Session() session: UserSession` and passes
`session.user.id` into the service. In `MindmapsService` and
`ConversationsService`, **every query is scoped by `ownerId`** and a miss goes
through `orNotFound()`, so another user's document and a nonexistent one are
both a 404. Invalid ObjectIds short-circuit there too (otherwise Mongoose's
CastError becomes a 500). Follow that shape for new resources — no service
method should read a document by `_id` alone.

### The assistant is app-level, not canvas-level

`POST /api/chat` (apps/api/src/ai) streams an AI SDK UI-message response from
`streamText` with tools. The tools live in `MindmapToolsService` and call
`MindmapsService`, so the assistant does the **whole mindmap CRUD surface** —
list, read, create, rename, delete, plus topic edits — under the same
ownership scoping and `findMindmapGraphIssues` checks as the HTTP routes. That
is deliberate so a future MCP server can reuse the same service without the
chat transport. Tool errors are returned to the model as data
(`{ error, issues }`), not thrown, so it can repair a bad edit in one round
trip. Models are reached through LLM Gateway (`createGateway` from the `ai`
package, same wiring as vivace's coach): `LLM_GATEWAY_API_KEY` in
`apps/api/.env` is required (503 without it), the model comes from
`AI_CHAT_MODEL` written vendor/model (default `deepseek/deepseek-v4-flash`),
and `LLM_GATEWAY_URL` overrides the endpoint for a self-hosted gateway.

The open mindmap is **context, not scope**: `mindmapId` in the request body
only tells the system prompt what "this mindmap" resolves to. The assistant
works with nothing open.

The chat route is documented in Swagger but the web client calls it through
the AI SDK's `DefaultChatTransport` (plain fetch) — an SSE stream can't ride
the generated openapi-fetch client. `MUTATING_CHAT_TOOLS` in
`packages/shared/src/chat.ts` is the web ↔ api contract for which tool names
write to the database: the assistant panel invalidates the mindmap query when
one finishes, and the canvas reseeds via the `updatedAt` check below.

The canvas' seed-once rule has one exception for this: `MindmapEditor` tracks
the `updatedAt` it seeded from (advanced by its own saves) and, when the
fetched document carries an `updatedAt` it didn't produce, reseeds React Flow
state and drops any pending autosave — otherwise the debounced PATCH would
overwrite the server-side edit with the stale local graph.

### Server-side writes announce themselves over SSE

`GET /api/events` (apps/api/src/events) streams one tiny event per mindmap
write — `{ mindmapId, updatedAt }`, `updatedAt: null` for a deletion — to the
signed-in owner, which is how an MCP client's edit appears on the open canvas
as it happens. The event deliberately never carries the graph: the client's
whole reaction is invalidating the mindmap list, so the canvas' `updatedAt`
reconciliation stays the single place server edits merge into local state.

The emit lives in `MindmapsService.changed()`, not in a controller, because
the HTTP routes, the assistant's tools, and MCP all write through that
service's three mutating methods — a transport that could write silently would
be a transport that bypassed ownership scoping too. The web side is
`useMindmapEvents()` (mounted once in the workspace shell) plus
`isForeignMindmapChange` in `packages/shared/src/events.ts`, which drops the
echo of the client's own saves: the event a save triggers can outrun the PATCH
response, and refetching in that window makes the canvas read its own write as
someone else's and reseed mid-edit. That is also why `useSaveMindmapGraph`
carries a `mutationKey` — the hook checks it for an in-flight save before
invalidating.

Auth is the ordinary session cookie: EventSource cannot set headers and does
not need to, since the stream rides the same-origin `/api` path every proxy
already forwards (nginx's `proxy_buffering off` and 1h read timeout cover it).
A heartbeat event every 15s keeps intermediaries from cutting the idle
connection; reconnection is EventSource's own.

### Chat history is a real resource

Conversations live in `apps/api/src/conversations` with full CRUD
(`/api/conversations`), and `conversationId` is **required** on `POST
/api/chat` — there is no such thing as an unsaved chat. The web client creates
the conversation (titled from the first message via
`conversationTitleFromMessage` in shared) before sending, so the id round trip
is a plain REST call rather than something smuggled through the stream.

The chat route writes twice per turn: the incoming messages up front, so a
failed or abandoned generation still leaves the question in the history, and
the whole turn again from `toUIMessageStream`'s `onEnd`. `messages` is stored
as opaque Mixed documents because the `UIMessage` shape belongs to the `ai`
package; `MAX_CONVERSATION_MESSAGES` bounds both what is stored and what
`chatRequestSchema` will accept, so history can always be replayed.

The list route projects `messages` away — `ConversationSummaryDto` vs
`ConversationDto` — and sorts by `updatedAt`, which every turn bumps.

`components/assistant-panel.tsx` (AI SDK Elements from
`components/ai-elements/`, vendored via the shadcn registry, restyled with the
design-system tokens) stays mounted so the conversation survives closing the
panel. It never remounts `useChat`; switching conversations calls
`setMessages` from the fetched document, tracked by a `seededId` so the
conversation adopted mid-send is not reseeded over its own live stream.
`components/assistant-history.tsx` is a layer *over* the chat rather than a
replacement for it, for the same reason. Both editable lists — the library and
history — share `components/list-row.tsx`.

### Notes are a field on a node, not a resource

Every topic can carry one `note`: **markdown source**, capped at
`MAX_NOTE_LENGTH`, stored on the node subdocument and therefore saved by the
same graph PATCH the canvas already debounces. There is no notes endpoint and
no second fetch — the note rides in the mindmap document the list route
already returns.

Absent and empty are the same thing, and the rule is *store absent*: the
canvas' `flush` omits a blank note, `set_topic_note` deletes the key, and every
reader (the pill's indicator, the outline's `(note)` marker) is a plain truthy
check. Anything that maps a node must carry `note` through —
`MindmapToolsService.plainNodes` reads a document and writes the whole array
back, so a field missing there is a field the next rename erases.

A note is **written as raw markdown and read as rendered markdown**, the way a
pull request description is:

- `components/note-window.tsx` — `NoteWindows`, a window manager, and the
  window itself. Each note is a floating window, dragged by its header and
  resized from a corner grip, clamped to a min and a max and always kept inside
  the viewport. Its **Edit** tab is a plain `<textarea>` holding markdown
  source; its **Preview** tab renders that same *live draft*, so the two can
  never disagree and switching waits on no save.

  **Opening a note never closes another.** Windows cascade down and right of
  the last one placed so the title bar underneath stays visible and grabbable,
  and a press anywhere in a window raises it — `onPointerDownCapture`, so it
  fires ahead of the header's drag and the textarea's focus, including on a
  press that lands on a button. The manager owns every rect in one map, which
  is what lets the cascade know where the run is up to; a window whose rect
  didn't change skips re-rendering while another is dragged.
- `components/note-preview.tsx` — the hover card on a topic that has a note.
  Clipped to a fixed height and faded at the cut rather than scrolled: a hover
  card you have to scroll should have been a window, and Edit is that window.
- `components/note-markdown.tsx` — Tiptap, used purely as a **renderer**
  (`editable: false`, no input rules, no Placeholder). It is reached only
  through `note-markdown-lazy.ts`; that indirection is not ceremony, because
  two surfaces load it and a second `lazy()` over the same module would be a
  second component type, so moving between them would rebuild ProseMirror for
  nothing.

Because the source *is* the document, there is no serializer between what is
typed and what is stored — so `maxLength` on the textarea is the whole length
rule (paste included), and a note that is too long to save is unrepresentable
rather than something to detect. It is also why nothing intercepts a click on a
link in either read surface: `openOnClick` is off and the editor is never
editable, so the anchor Tiptap rendered is just an anchor.

The window is rendered inside the canvas' `ReactFlowProvider` but *outside* its
dissolve wrapper, so it reads and writes the same node data the topics do
without fading and scaling with the map behind it. Typing settles into node data
on its own short debounce before the canvas' autosave picks it up, and flushes
on close, on topic switch, and on unmount. Markdown → document parsing is the
official `@tiptap/markdown` extension (`contentType: "markdown"`); the
extension set is deliberately only what markdown can spell, which is why
Underline is off — there would be no source that produces it.

Three things about the window that look incidental and are not. Its whole
header is a drag handle, so a press that lands on a control inside it must
*not* start a gesture — capturing the pointer there retargets the rest of it
and the button never sees its click. The first window of a run is anchored to
the topic that was pressed, except when notes were already open on first
render: those came from the address bar, there is no gesture to feel connected
to, and the canvas is still fitting the map to the viewport, so that run opens
centred instead. And **position and the enter/exit animation are on different
elements** — the outer box carries `translate3d` and never transitions, the
inner one scales and fades — because sharing a `transform` means the last
pointer move and the release landing in one commit sends the window gliding to
where it was dropped, 200ms after the hand let go.

The assistant reaches notes through `read_topic_note` / `set_topic_note`, and
`read_mindmap`'s outline marks a topic that has one rather than inlining the
prose — a map where every topic carried a paragraph would push the tree itself
out of the model's attention.

### The account is a place, not a menu

`components/account-dialog.tsx` is where everything about the *person* lives —
profile, sign-in methods, preferences, and connected agents — as opposed to the
library and the assistant, which are about their mindmaps. It is a **modal**, not a fourth
floating surface: the library and assistant float over the canvas because they
are used *while* working, and something opened twice a year should not be
permanently reachable chrome. Its height is fixed for the same reason list rows
are pinned — a box that resizes as you move between sections turns navigating it
into something you have to watch.

Adding a section is adding an entry to `ACCOUNT_SECTIONS` in
`lib/workspace-route.ts` and a case in `account-dialog.tsx`. The four that exist
are the shape the next one should follow:

- **Profile** — name, email, sign out. Sign out moved here out of the library
  footer, which is now purely the way in: `openAccount()` *closes* the library,
  because this is a move rather than a layer, and two stacked modals would mean
  Escape backing out through a sheet the user had already left.
- **Sign-in** — `authClient.listAccounts()` for what is linked, `GET /api/me`
  for what this deployment can offer. Both have to agree before a row is drawn;
  an unconfigured provider is absent rather than disabled.
- **Preferences** — how the app behaves rather than who is using it. See below;
  the one setting is the canvas' layout direction, chosen from two drawings of
  the shape rather than from a select, and written on press with no Save button
  because the canvas behind the dialog is the confirmation.
- **MCP** — the endpoint, the per-client setup guide, and the connected agents.
  One section rather than three because it is one task read at different times.
  `lib/mcp-connection.ts` holds the guide **as data**, with the endpoint
  substituted in from one place, so supporting another client is adding an entry
  rather than writing prose in a component. That endpoint is derived from
  `window.location.origin`, not fetched: the one-origin rule is what makes the
  guess correct, and an origin where it were wrong is one where the client's own
  RFC 9728 discovery would have failed too.

Connected agents are the other half of the consent screen, which promises in so
many words that a grant can be revoked "from your account" — `oauth2.getConsents`
/ `oauth2.deleteConsent`, with the client's registered name fetched per row the
way the consent screen fetches it, since a client id is not something a person
recognizes.

Sections are addressable (`?account=mcp`), which pays for itself twice: "here is
how you connect Claude Code" is a link somebody can be sent, and `linkSocial`'s
`callbackURL` is just the URL the app is already on, so coming back from Google
restores the screen with nothing saved and nothing to restore. Switching
sections `replace`s rather than pushes — Back should leave settings, not walk
back through tabs.

### Preferences belong to the person, and the canvas reads them

`packages/shared/src/preferences.ts` is the whole set — today, `layoutDirection`,
which is `"down"` or `"right"` and decides which way every mindmap grows from its
root. They live on the server (`GET /api/me`, `PATCH /api/me/preferences`, one
`preferences` document per `ownerId` in `apps/api/src/me`) rather than in
`localStorage`, and that is not a preference about preferences: the canvas
*derives node positions* from the direction and saves them back into the mindmap,
so two devices disagreeing would keep rewriting each other's graph.

Three things follow from that:

- **They ride on `/api/me`.** The canvas needs the direction to draw its first
  frame, and a route of its own would be a second round trip landing after the
  map had already painted the wrong way round. The document is upserted on first
  change, so "no row" is the ordinary answer and means the defaults —
  `MeService.findPreferences` never 404s, and every field falls back
  individually, which is what lets a patch store only what changed.
- **The layout is written on two named axes, not on x and y.** In
  `mindmap-canvas.tsx`, *main* is the axis depth advances along and *cross* the
  one siblings spread across; growing down means main = y, and growing right
  swaps them. Everything that has to agree with the layout reads the same one
  answer: which handles a connector leaves from and arrives at, where a new
  branch is seeded, and how `buildTree` ranks siblings (by their cross
  coordinate, so a branch dropped between two others stays between them).
  `TopicNodeView` gets it from `LayoutDirectionContext`, because `nodeTypes` has
  nowhere to pass a prop through.
- **Changing it arms the autosave by itself.** Every other relayout is downstream
  of an edit that already started the debounce; this one moves every topic with
  nobody having edited anything, so `MindmapEditor` arms it on the change. Without
  that the new coordinates are never persisted, and the next reload ranks siblings
  by positions laid out for the direction the user just left.
- **And it calls `updateNodeInternals` on every topic.** React Flow measures a
  node's handles once and routes every connector from that cache, so moving a
  handle in JSX moves the dot and nothing else: the tree turns and the lines keep
  departing the side they used to, looping the long way round. It looks like a
  layout bug, it is invisible to any assertion about where the topics are, and it
  fixes itself on reload — which is exactly as long as the stale measurement
  lives. The `edgeBox` assertion in `workspace.e2e.test.tsx` is there to catch it.

### Web state split

- **Server state → React Query.** `apps/web/src/hooks/use-mindmaps.ts` owns all
  mindmap fetching/mutation, `hooks/use-conversations.ts` all chat history.
  Rename and delete are optimistic with rollback; the canvas autosave writes
  the response straight into the list cache instead of invalidating, since it
  fires on a debounce. `conversationKeys.list` and `conversationKeys.detail`
  are deliberately siblings, not parent and child — every finished turn
  invalidates the list, and a detail nested under that prefix would refetch on
  the same beat and race the live `useChat` messages.
- **UI state → the URL.** There is no client-side UI store; `window.location`
  is it. `lib/workspace-route.ts` is the whole grammar — `/mindmaps/<id>` for
  the canvas, `?library`, `?assistant` / `?assistant=history`,
  `?account` / `?account=<section>` for account settings (bare means the first
  section, so the commonest link is the short one),
  `?note=<id>,<id>` for the topics whose notes are open (front-most last), and
  `?chat=<id>` for the conversation the assistant holds whether or not the
  panel is open — and `hooks/use-workspace-route.ts` binds it to React with
  `useSyncExternalStore` over `popstate`. Nothing mirrors the URL, so Back, a
  reload, and a pasted link all land in the same place, and a caller that can
  only write a URL (the point: assistant-driven navigation) can drive the app.
  Navigate through the named transitions in that hook file rather than writing
  `history.pushState` — they hold the rules about what closes what, and keep a
  move that changes two things (open a mindmap, close the library) to one
  history entry. Invariants that *can* be expressed as grammar are: the
  serializer can't write history without the panel, which is what makes
  "closing the assistant puts history away" impossible to get wrong. `note` is
  bound the same way to the mindmap it hangs off — the ids name topics of that
  map — so closing the canvas puts every note away on its own. Notes do *not*
  fight the assistant for room: they are windows over the canvas, not a second
  panel, so any number of them coexist with it.
  Where each window sits and how big it is are deliberately not in the URL:
  that is transient chrome, not somewhere the user can be. Which window is in
  *front* is there, because it is the difference between a shared link that
  restores the arrangement and one that restores a pile — and because raising
  goes through `replace` rather than `push`, so Back still undoes opening a
  note rather than looking at one.
- The ids in the URL are intentionally never reconciled against the server —
  `useActiveMindmap()` resolves the mindmap id against the fetched list, so a
  deleted mindmap's or conversation's id, or a stale link to one, is inert
  rather than a dangling reference to clean up. `note` behaves the same way:
  a topic deleted out from under its own open note just closes the window,
  because nothing else keys off that id.

The canvas (`components/mindmap-canvas.tsx`) is keyed by mindmap id so switching
maps remounts the editor; React Flow state is seeded once from the fetched
document and then owned locally, which is what stops background refetches from
clobbering an in-progress edit.

All web requests go to the current origin — Vite proxies `/api` to :3000 (nginx
does it in the docker image) so the session cookie stays first-party. Don't
point the client at `http://localhost:3000` directly.

### The landing page shares the repository and nothing else

`apps/landing` is the marketing site — Next.js 16 App Router, static, no data
and no session. It is in the monorepo so that a claim about the product and the
code that makes the claim true move in one commit, and it is coupled to nothing
here on purpose:

- **It imports no workspace package.** `lib/site.ts` is the entire contract
  with the rest of the product: the app's origin, the MCP endpoint, the OAuth
  discovery URLs, and the GitHub URLs, written literally for the same reason the
  API host is literal in the root `vercel.json`. A landing that imported
  `@thinkclear/shared` would make a marketing copy change a reason to rebuild
  the API. It is enforced rather than remembered: `tsconfig.json` has no path to
  any workspace package, so app code that reached for one would not compile.
  Where the site has to restate something the API owns — the MCP tool names and
  their scopes, in `lib/content.ts` — the copy is checked against the original
  in `test/content.spec.ts`, which is allowed the import the app is not.
- **It has its own visual system, and that is the point.** `apps/web`
  implements DESIGN.md; `apps/landing/src/app/globals.css` implements the
  Calendly-derived one — navy ink on cool marble, one vivid blue for filled
  actions, decorative magenta and cyan blobs behind the product visuals. A page
  read once by somebody deciding and an app read all day by somebody working
  want different things. The **canvas palette is the exception**: the mindmap
  mock is drawn in the app's own `#ffe600` / `#2b78e4`, because a screenshot
  recolored to match the page around it stops being a screenshot.
- **Server components by default.** Three things are interactive — the
  small-screen menu, the feature accordion, and the scroll reveals — and each is
  the only client boundary in its subtree. The mocks and icons reach
  `feature-showcase.tsx` as already-rendered elements passed in as props, so
  none of them is in the browser bundle. There is no icon package and no motion
  library; the whole icon set is `components/icons.tsx` and the motion is CSS.
- **`Reveal` shares one IntersectionObserver** (`lib/reveal-observer.ts`) and
  unsubscribes each element as it fires, because the reveal is once-only.
- **`next.config.ts` sets three things that all have to stay.**
  `turbopack.root` and `outputFileTracingRoot` are both the *workspace* root and
  must be equal — dependencies are hoisted there, so a build rooted at
  `apps/landing` traces a subset of what it compiled against. `agentRules: false`
  stops `next dev` writing its own `AGENTS.md` and `CLAUDE.md` into the app
  directory on every start.

`pnpm dev` now starts three servers; the landing takes **:4000** so it does not
collide with the API on :3000.

#### Every page here is served twice

The same URL answers with HTML to a browser and with markdown to a client that
sends `Accept: text/markdown` (the acceptmarkdown.com convention). `src/proxy.ts`
— Next 16's name for what used to be `middleware.ts` — makes the choice with
`lib/accept.ts`, which implements RFC 9110 §12.5.1 properly: **specificity
before q-value**, so the fully wildcarded `Accept` that curl and most crawlers
send still gets HTML, and only a client that names markdown more specifically
(or with a higher q) gets markdown. An `Accept` this site can satisfy in neither
form is a 406. RSC requests are skipped outright — the router's own `Accept` is
`text/x-component`, and negotiating it would 406 client-side navigation.

Two consequences worth knowing before changing any of it:

- **`Vary` is set in two places and has to say the same thing in both.** Next
  owns `Vary` on an App Router page response and overwrites whatever
  `next.config.ts` puts there — silently, since every *other* custom header
  lands. So the proxy sets it on the responses it builds and
  `apps/landing/vercel.json` sets it on the statically served ones, with Next's
  four `Next-Router-*` entries restated alongside `Accept` because a bare
  `Vary: Accept` would trade one cache-poisoning bug for another.
  `test/content.spec.ts` asserts the two copies are equal.
- **The prose is written once, as data.** `lib/documents.ts` holds `/about`,
  `/contact`, `/privacy` and `/mcp` as a small block model;
  `components/document-page.tsx` renders it into the visual system and
  `lib/markdown.ts` into CommonMark. Two hand-written copies would drift, and
  the one that drifts is always the machine-readable one because nobody looks at
  it. Same reason `lib/content.ts` holds the FAQ the section, the `FAQPage`
  markup, and the markdown all read.

The 404 is part of this rather than an afterthought: `app/not-found.tsx` spends
itself on recovery links, and an unmatched path asked for in markdown gets the
same list as CommonMark with a real 404 status. `/llms.txt` (llmstxt.org shape,
with the when-to-use guidance an agent is actually holding) and
`/.well-known/mcp.json` are both routes built from the same constants, not
checked-in files, so the endpoint they name cannot fall behind the one that
exists.

### Deployment: two hosts, one origin

`DEPLOYMENT.md` is the operational guide. What matters when *changing* things:

The app is on Vercel at `app.thinkclear.xyz` and the API is on a VPS behind
Coolify at `api.thinkclear.xyz`, but the browser never learns that.
`vercel.json` rewrites `/api/*` and `/.well-known/*` to the API host, which is
the production copy of what `apps/web/nginx.conf` does in the compose stack and
what the vite proxy does in dev. **Three unrelated things break if that stops
being true**: the session cookie stops being first-party, Better Auth's
`authorize` redirect to `/sign-in` and `/consent` lands on a host that serves no
pages, and RFC 9728 discovery is no longer at the origin root where an MCP
client looks. So routing changes come in pairs — `vercel.json` and `nginx.conf`
describe the same thing and are checked by different people.

The API host is written literally in `vercel.json` because Vercel does not
interpolate environment variables into it. That is the one value in the
repository that is per-deployment.

`thinkclear.xyz` is the **landing app** — `apps/landing`, in this repository
since it is the same product's front door, but a **separate Vercel project with
its own deploy**, its own `vercel.json`, and no rewrites. It shares the
lockfile and the toolchain and nothing else: it imports no workspace package,
reaches the app only by URL, and holds its own copy of the visual system (see
below). The session cookie is host-only on `app.thinkclear.xyz`, so the landing
cannot read it — widening it to `Domain=.thinkclear.xyz` would hand it to every
present and future subdomain, and that is a decision to make deliberately
rather than inherit.

`APP_URL` is the app's Vercel origin — never the API's domain, and never the
landing's. Same rule the compose stack already encodes, now with a public
consequence. `CLIENT_ORIGIN` is a **comma-separated list** on top of it, which is
how Vercel's per-branch preview origins get trusted (Better Auth matches
wildcards: `https://*-team.vercel.app`); without that a preview renders perfectly
and fails at sign-in.

`GET /api/health` exists for the platform, not for users: the container's
`HEALTHCHECK` and Coolify's probe both read it, and it answers **503** when Mongo
is not connected so a rollout that cannot reach its database is reported as
failed. It is `@Public()` for the same reason the MCP routes are — the session
guard would answer a probe 401, which is a working API refusing an anonymous
caller and indistinguishable from a broken one.

`apps/api/Dockerfile` is two stages so the Nest CLI and typescript never reach
the runtime image; both stages install from the same lockfile, so what ships is a
subset of what was compiled against. It runs as `node`, not root.

CI/CD is three workflows. The one thing to know about `deploy.yml` is that it
pins Coolify's `git_commit_sha` **before** triggering, because `POST /deploy`
otherwise builds the branch head at build time — a second commit landing
mid-build would deploy something the checks never saw. It also polls the
deployment, since without that a failed build looks exactly like a shipped one.
Coolify's own auto-deploy must stay off, or there are two answers to "what is
running". `ci.yml` and `deploy.yml` both regenerate the OpenAPI contract and fail
on a diff, which is what makes "run `pnpm openapi`" enforceable rather than
remembered — and that step needs MongoDB, because `generate-openapi.ts` boots the
real `AppModule` and `MongooseModule.forRoot` awaits a connection.

## Design system

`DESIGN.md` is the source of truth for the visual system, and its
**Implementation Map** section maps every `{token}` to the Tailwind utility that
implements it — read it before writing UI. Tokens live in
`apps/web/src/index.css`.

- Reference tokens (`text-display-md`, `bg-cloud`, `shadow-soft-lift`,
  `rounded-xl`), never raw hex or px.
- Dark bands use the `surface-ink` class. There is no dark theme; the `dark:`
  variant is class-gated so it can never fire from `prefers-color-scheme`.
- Use `cn()` from `lib/utils.ts` for class merging — it registers the custom
  token scales with tailwind-merge, without which `text-body-md` is treated as
  a color and silently dropped.
- Motion rules (easings, ≤300ms, transform/opacity/color only, no `ease-in`)
  are in DESIGN.md › Motion, derived from the `emil-design-eng` skill.
- The React Flow canvas deliberately deviates: it uses a roadmap.sh-style
  yellow-on-blue palette because it is content, not app chrome.

New shadcn components: `pnpm dlx shadcn@latest add <component>` from `apps/web`.
They inherit the system via the semantic aliases, but expect to fix radii and
type — generated defaults use `text-sm`/`rounded-md`.
