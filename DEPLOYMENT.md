# Deployment

The web app ships to **Vercel**, the API to a **VPS through Coolify**, and
MongoDB runs beside the API. GitHub Actions gates both.

Every host below is a placeholder — substitute your own. The hosted instance
runs exactly this shape on `thinkclear.xyz`, and nothing in the repository is
tied to those names except the one value called out in
[`vercel.json`](#the-one-per-deployment-value).

| | | |
|---|---|---|
| `app.example.com` | **the app** | Vercel; the only origin a browser or an MCP client ever talks to |
| `api.example.com` | the API | Coolify on the VPS; reachable, but nothing is meant to arrive there directly |
| `example.com` | the landing page | `apps/landing` — optional, its own Vercel project ([below](#the-landing-page-project)) |

If you only want the app, you need the first two. A single host works as well:
serve the app from `example.com` and the API from `api.example.com`.

## The one thing to understand first

**The app is one origin.** Not "mostly" — structurally. Three things in this
codebase depend on it:

- the session cookie is first-party, because the browser only ever talks to the
  origin it was served from;
- `APP_URL` is Better Auth's `baseURL`, and its OAuth `authorize` endpoint
  answers with a *relative* redirect to `/sign-in` and `/consent` — pages the
  **web** app serves;
- OAuth discovery is fixed by RFC 9728 / RFC 8414 at `/.well-known/...` on the
  **origin root**, which is where an MCP client looks before it has any
  credentials.

So the API is never a second public origin the browser knows about. Vercel
rewrites `/api/*` and `/.well-known/*` through to it, exactly as nginx does in
the compose stack. `vercel.json` is the production copy of `apps/web/nginx.conf`;
when you change routing in one, change it in the other.

```
                     https://app.example.com              (the only origin)
browser / MCP client ──────────────────────────►  Vercel  ──┬─► /            static SPA
                                                            ├─► /api/*       ──┐
                                                            └─► /.well-known/* ─┤ rewrite
                                                                                ▼
                                                                   https://api.example.com
                                                                     Coolify → the API image
                                                                                ▼
                                                                             MongoDB

     https://example.com  ─►  landing (apps/landing, second Vercel project,
                                       separate deploy, no rewrites)
```

Tokens are audience-bound to `MCP_RESOURCE_URL`, which defaults to
`$APP_URL/api/mcp` — the Vercel origin, never the API's own host.

### The one per-deployment value

**The API host is written literally in `vercel.json`**, because Vercel does not
interpolate environment variables into that file. It is the only place in the
repository that names a deployment, so a fork changes both rewrite destinations
there and nothing else.

---

## 1. MongoDB

Either a Coolify-managed MongoDB service on the same VPS (add **+ New → Database
→ MongoDB**; use its internal hostname in `MONGODB_URI`, so the database is
never published to the internet) or MongoDB Atlas.

Whichever you choose, it holds both the app's documents and Better Auth's
tables — `auth.ts` opens its own `MongoClient` against the same database.

---

## 2. The API on Coolify

**+ New → Application → your repository**, then:

| Setting | Value |
|---|---|
| Build Pack | Dockerfile |
| Dockerfile Location | `apps/api/Dockerfile` |
| Base Directory | `/` (the build context is the repository root) |
| Port | `3000` |
| Domain | `https://api.example.com` |
| Health Check | `/api/health` on port 3000 |
| **Auto Deploy** | **off** |

Auto Deploy is off on purpose. `.github/workflows/deploy.yml` is the only thing
that deploys, so there is one trigger, one log, and one answer to "what is
running" — and a deploy is gated on the tests rather than on a push landing.

### Environment

| Variable | Value | |
|---|---|---|
| `MONGODB_URI` | `mongodb://…` | internal hostname, not a published port |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | rotating it signs every existing session out |
| `APP_URL` | `https://app.example.com` | **the app's origin, not this API's, and not the landing's** |
| `CLIENT_ORIGIN` | `https://app.example.com` | comma-separated; `APP_URL` is trusted regardless |
| `MCP_JWKS_URL` | `http://127.0.0.1:3000/api/auth/jwks` | verifying our own tokens has no reason to leave the container |
| `PORT` | `3000` | |
| `DOCS_USER` | `openssl rand -hex 8` | HTTP basic auth on `/docs` and the raw spec beside it |
| `DOCS_PASSWORD` | `openssl rand -base64 32` | leave either unset and the docs are not served at all |
| `LLM_GATEWAY_API_KEY` | from [llmgateway.io](https://llmgateway.io) | absent, `POST /api/chat` answers 503 and the rest of the app works |
| `AI_CHAT_MODEL` | `deepseek/deepseek-v4-flash` | vendor/model |
| `MCP_RESOURCE_URL` | *unset* | defaults to `$APP_URL/api/mcp`, which is what clients connect to |
| `LLM_GATEWAY_URL` | *unset* | only for a self-hosted gateway |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from the Google console | both or neither — see below |

Google sign-in is off unless **both** halves are set, and the account screen
asks `GET /api/me` which providers came back rather than assuming: half a
credential produces a deployment with no Google button, not one that fails on
press. The authorized redirect URI in the Google console is
`$APP_URL/api/auth/callback/google` — the *app's* origin again, since that is
where `/api` is proxied from.

**Both are set on the hosted instance**, and that is now load-bearing outside
the API: the landing page's FAQ answers "can I sign in with Google" with a
plain yes rather than a hedge, so unsetting either half here turns a marketing
claim into a lie about a button that is no longer drawn. Check it without a
session with
`curl -s -X POST $API/api/auth/sign-in/social -H 'content-type: application/json' -d '{"provider":"google","callbackURL":"/"}'`
— `PROVIDER_NOT_FOUND` means the running container does not have the
credentials, whatever the dashboard says.

`APP_URL` is the mistake worth naming twice: point it at the API's host or at
the landing's and everything works until someone authorizes an MCP client, who
then lands on a 404 where the consent screen should be.

---

## 3. The web app on Vercel

Import the repository. **Leave the Root Directory at the repository root** —
`vercel.json` at the root supplies the install, build, and output settings, and
the build has to run from there because `apps/web` compiles against
`@thinkclear/shared`'s `dist`, which turbo builds first:

```
installCommand    pnpm install --frozen-lockfile
buildCommand      pnpm turbo run build --filter=@thinkclear/web
outputDirectory   apps/web/dist
```

**No environment variables.** The web app reads none — every request goes to the
current origin. Nothing about the deployment is baked into the bundle.

Add `app.example.com` as the domain. It must be the same host as `APP_URL`.

### DNS

Each host is one record, and they share nothing, so a change to one cannot break
another:

| Type | Host | Value |
|---|---|---|
| CNAME | `app` | the target Vercel shows for the domain |
| A | `api` | the VPS address |
| A / CNAME | `@`, `www` | only if you deploy the landing — the values Vercel shows |

If you run the landing on the apex, keep the apex canonical and redirect `www`
to it. Vercel's "add domain" dialog offers the opposite by default, and taking
it would make `SITE_URL`, the `canonical` link tag, and the `app.` / `api.`
sibling hosts all disagree with what is actually served.

### Preview deployments

Every branch gets a Vercel URL whose rewrites point at **production**. Two
consequences worth deciding about rather than discovering:

- a preview writes to the production database;
- sign-in fails on a preview until its origin is trusted, because Better Auth
  rejects a state-changing request from an `Origin` it does not know.

To let previews sign in, add the wildcard to the API's `CLIENT_ORIGIN`:

```
CLIENT_ORIGIN=https://app.example.com,https://*-your-team.vercel.app
```

To keep previews visual-only, change nothing — they render, and auth stops them.

### The landing page project

`apps/landing` is optional and only needed if you want the marketing site. It is
a **second Vercel project** from the same repository. Two projects on one root
domain do not collide. Set it up as:

| | |
|---|---|
| Root Directory | `apps/landing` |
| Include source files outside the Root Directory | **on** — it is a pnpm workspace |
| Framework | Next.js |
| Build Command | **not overridden** |
| Output Directory | **not overridden** |
| Environment variables | **none** |
| Domains | `example.com` (production), `www.example.com` (308 → apex) |

**Leave Build Command and Output Directory unset**, and that is worth saying in
its own sentence because getting it wrong is silent until the deploy. Those two
fields come from `apps/landing/vercel.json` and the Next.js preset; a project
created by copying the app's settings arrives carrying
`--filter=@thinkclear/web` and `apps/web/dist`, which builds the wrong workspace
and then fails looking for a `dist` the Next.js app never produces. The
symptom names `apps/web` in a project whose root directory is `apps/landing`,
which is the tell.

It has **no rewrites**, which is the difference that matters: the app's
`vercel.json` proxies `/api` and `/.well-known` because the whole one-origin rule
depends on it, and the landing proxies nothing because it serves nothing but
static pages. It reaches the app by link, at the URLs in
`apps/landing/src/lib/site.ts` — the only place either origin is written down.

A link from the landing to the app needs nothing — that is a plain navigation,
and the app authenticates on arrival. But the session cookie is **host-only**:
it is set on the app's host and the landing cannot read it, so a landing that
wants to render "Welcome back" instead of "Sign up" cannot, today. That is
deliberate rather than missing. Making it possible means widening the cookie to
`Domain=.example.com` (Better Auth's `advanced.crossSubDomainCookies`), which
hands it to *every* current and future subdomain — a real tradeoff, and one
worth making on purpose if the landing ever needs it.

---

## 4. GitHub

`deploy.yml` needs a **Production** environment plus these repository
variables:

| Variable | Value | |
|---|---|---|
| `COOLIFY_URL` | `http://<coolify-host>:8000` | where Coolify's API answers |
| `COOLIFY_VIA_TAILSCALE` | `true` | set when that address is a Tailscale CGNAT one, so the API is tailnet-only |
| `COOLIFY_APP_UUID` | the application's uuid | Coolify names the app `<repo>:main-<uuid>` |
| `APP_ORIGIN` | `https://app.example.com` | the post-deploy health check |

`COOLIFY_APP_UUID` is the one worth checking before the first deploy, because it
names *which application Coolify builds* — wrong here means deploying over
something else rather than failing:

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_URL/api/v1/applications/$COOLIFY_APP_UUID" | jq '{name, fqdn, git_branch}'
```

The secrets are scoped to the **Production environment** rather than the
repository, because the deploy job is the only thing that declares
`environment: Production` — so no pull-request-triggered workflow can read a
production credential:

```bash
gh secret set COOLIFY_TOKEN      --env Production --repo <owner>/<repo>
gh secret set TS_OAUTH_CLIENT_ID --env Production --repo <owner>/<repo>   # tailnet only
gh secret set TS_OAUTH_SECRET    --env Production --repo <owner>/<repo>   # tailnet only
```

`COOLIFY_TOKEN` comes from Coolify → Keys & Tokens → API tokens. The Tailscale
pair is an OAuth client with the `tag:ci` tag, needed only when
`COOLIFY_VIA_TAILSCALE` is set; scope that tag in your ACL to that one host and
port — the deploy job holds credentials to production and should be able to
reach nothing else.

Restricting deployments to `main` is one call on the environment, and the manual
rollback path still works, since `workflow_dispatch` runs the workflow on `main`
and checks out the older `ref` from there:

```bash
gh api -X PUT repos/<owner>/<repo>/environments/Production \
  -F 'deployment_branch_policy[protected_branches]=true' \
  -F 'deployment_branch_policy[custom_branch_policies]=false'
```

---

## What runs when

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | pull request, merge queue | format, lint, typecheck, specs, build, generated-contract drift; browser + API end-to-end in a second job |
| `deploy.yml` | push to `main`, manual | revalidates everything, pins Coolify to the tested commit, deploys, polls, then checks `/api/health` through the public origin |
| `security.yml` | PR, push, weekly | gitleaks over full history, actionlint, zizmor, `pnpm audit`; trivy over both images weekly |

Three things in `deploy.yml` are load-bearing:

- **It pins `git_commit_sha` before deploying.** `POST /deploy` builds the branch
  head *at build time*, so a second commit landing mid-build would ship
  something the checks never saw.
- **It polls the deployment.** Without that the job is green the moment Coolify
  accepts the request, and a failed build looks exactly like a shipped one.
- **It skips when only the web changed.** Scope is a `git diff` against the
  previous head; no usable base (manual run, first push, force push) deploys
  rather than guesses.

`apps/web` is deliberately absent from it. Vercel deploys from its own git
integration, there is no env coupling to sequence, and previews come free.

## Rolling back

Coolify keeps previous deployments — redeploy one from the application's
Deployments tab. To roll back to a specific commit instead, run the **Deploy**
workflow manually with `ref` set to that commit: it revalidates, re-pins, and
redeploys. Vercel rolls back independently by promoting an earlier deployment.

## Verifying a deployment

```bash
curl -fsS https://app.example.com/api/health          # {"status":"ok","database":"connected",…}
curl -fsS https://app.example.com/.well-known/oauth-protected-resource/api/mcp | jq
claude mcp add --transport http thinkclear https://app.example.com/api/mcp
```

The second one is the check that the origin is wired correctly end to end: it is
served by the API, at a path only the rewrite can reach, and its contents are
the URLs an MCP client will be sent to next — which should name the app's
origin, never the API's.

## Running the deployed shape locally

```bash
docker compose --profile full up --build
```

nginx on :5173 in front of the API on :3000 and Mongo — the same one-origin
topology Vercel's rewrites produce, which is why it is worth reaching for when
something works in `pnpm dev` and not in production.
