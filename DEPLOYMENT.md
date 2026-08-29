# Deployment

The web app ships to **Vercel**, the API to a **VPS through Coolify**, and
MongoDB runs beside the API. GitHub Actions gates both.

## Domains

| | | |
|---|---|---|
| `thinkclear.xyz` | the landing page | `apps/landing` — in this repository, but its own Vercel project and its own deploy |
| `www.thinkclear.xyz` | — | 308 to the apex; the apex is the canonical host |
| `app.thinkclear.xyz` | **the app** | Vercel; the only origin a browser or an MCP client ever talks to |
| `api.thinkclear.xyz` | the API | Coolify on the VPS; reachable, but nothing is meant to arrive there directly |

The registrar holds one zone for all of them — see [DNS](#dns) for the record
set and for what in it belongs to somebody else.

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
                     https://app.thinkclear.xyz           (the only origin)
browser / MCP client ──────────────────────────►  Vercel  ──┬─► /            static SPA
                                                            ├─► /api/*       ──┐
                                                            └─► /.well-known/* ─┤ rewrite
                                                                                ▼
                                                                 https://api.thinkclear.xyz
                                                                     Coolify → thinkclear-api
                                                                                ▼
                                                                             MongoDB

     https://thinkclear.xyz  ─►  landing (apps/landing, second Vercel project,
                                          separate deploy, no rewrites)
```

Tokens are audience-bound to `MCP_RESOURCE_URL`, which defaults to
`$APP_URL/api/mcp` — `https://app.thinkclear.xyz/api/mcp`, the Vercel origin.

**The API host is written literally in `vercel.json`**, because Vercel does not
interpolate environment variables into that file. It is the only per-deployment
value in the repository, so if the API ever moves, both rewrite destinations
there are what has to change with it.

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
| Domain | `https://api.thinkclear.xyz` |
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
| `APP_URL` | `https://app.thinkclear.xyz` | **the Vercel origin, not this API's, and not the landing's** |
| `CLIENT_ORIGIN` | `https://app.thinkclear.xyz` | comma-separated; `APP_URL` is trusted regardless |
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

`APP_URL` is the mistake worth naming twice: point it at `api.thinkclear.xyz` or
at the landing's `thinkclear.xyz` and everything works until someone authorizes
an MCP client, who then lands on a 404 where the consent screen should be.

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

Add `app.thinkclear.xyz` as the domain. It must be the same host as `APP_URL`.

### The landing page project

`apps/landing` is a **second Vercel project** on `thinkclear.xyz`, from the same
repository. Two projects on one root domain do not collide. Set it up as:

| | |
|---|---|
| Root Directory | `apps/landing` |
| Include source files outside the Root Directory | **on** — it is a pnpm workspace |
| Framework | Next.js |
| Build Command | **not overridden** |
| Output Directory | **not overridden** |
| Environment variables | **none** |
| Domains | `thinkclear.xyz` (production), `www.thinkclear.xyz` (308 → apex) |

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

### DNS

One zone at the registrar covers all three hosts. Nothing is shared between
them, so a change to one cannot break another — but they do all live in the
same record set, and the mail records are in there too.

| Type | Host | Value | |
|---|---|---|---|
| A | `@` | `216.198.79.1` | the landing, on Vercel |
| CNAME | `www` | the per-domain `*.vercel-dns-017.com.` target Vercel shows | 308s to the apex |
| CNAME | `app` | `cname.vercel-dns.com.` | the app, on Vercel |
| A | `api` | the VPS address | the API, behind Coolify |
| MX + TXT | `@` | the registrar's mail forwarding and its SPF | **not ours — leave alone** |

The apex is canonical and `www` redirects to it, not the other way round.
Vercel's "add domain" dialog offers the opposite by default, and taking it
would make `SITE_URL`, the `canonical` link tag, and the `app.` / `api.`
sibling hosts all disagree with what is actually served.

Two records, both additive, and neither of them touches the app's `app` CNAME,
the API's `api` A record, or the mail forwarding on the apex. Confirm the whole
set afterwards rather than only the record you added:

```bash
for h in thinkclear.xyz www.thinkclear.xyz app.thinkclear.xyz api.thinkclear.xyz; do
  dig +short @1.1.1.1 "$h"
done
dig +short @1.1.1.1 thinkclear.xyz MX        # must still be the forwarders
curl -sI https://www.thinkclear.xyz/         # 308 → https://thinkclear.xyz/
```

A machine that queried the apex before the record existed caches the *absence*
for the zone's negative TTL — an hour here — so `dig` can answer while `curl`
on the same machine still says "could not resolve". That is local, not a
deployment problem: check from a public resolver before believing it.

### The landing page and the session

A link from `thinkclear.xyz` to `app.thinkclear.xyz` needs nothing — that is a
plain navigation, and the app authenticates on arrival. But the session cookie is
**host-only**: it is set on `app.thinkclear.xyz` and the landing cannot read it,
so a landing that wants to render "Welcome back" instead of "Sign up" cannot,
today.

That is deliberate rather than missing. Making it possible means widening the
cookie to `Domain=.thinkclear.xyz` (Better Auth's `advanced.crossSubDomainCookies`),
which hands it to *every* current and future subdomain — a real tradeoff, and one
worth making on purpose if the landing ever needs it. Until then the narrower
cookie is the better default.

### Preview deployments

Every branch gets a Vercel URL whose rewrites point at **production**. Two
consequences worth deciding about rather than discovering:

- a preview writes to the production database;
- sign-in fails on a preview until its origin is trusted, because Better Auth
  rejects a state-changing request from an `Origin` it does not know.

To let previews sign in, add the wildcard to the API's `CLIENT_ORIGIN`:

```
CLIENT_ORIGIN=https://app.thinkclear.xyz,https://*-your-team.vercel.app
```

To keep previews visual-only, change nothing — they render, and auth stops them.

---

## 4. GitHub

The **Production** environment and every repository variable are already set on
`RATCHAW/thinkclear`:

| Variable | Value | |
|---|---|---|
| `COOLIFY_URL` | `http://<coolify-host>:8000` | where Coolify's API answers |
| `COOLIFY_VIA_TAILSCALE` | `true` | set when that address is a Tailscale CGNAT one, so the API is tailnet-only |
| `COOLIFY_APP_UUID` | `<app-uuid>` | Coolify names the app `thinkclear:main-<uuid>` |
| `APP_ORIGIN` | `https://app.thinkclear.xyz` | the post-deploy health check |

`COOLIFY_APP_UUID` is the one worth checking before the first deploy, because it
names *which application Coolify builds* — wrong here means deploying over
something else rather than failing:

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_URL/api/v1/applications/$COOLIFY_APP_UUID" | jq '{name, fqdn, git_branch}'
```

**Still to set — the deploy workflow cannot run without them.** The three
secrets are scoped to the **Production environment** rather than the repository,
because the deploy job is the only thing that declares `environment: Production`
— so no pull-request-triggered workflow can read a production credential:

```bash
gh secret set COOLIFY_TOKEN      --env Production --repo RATCHAW/thinkclear
gh secret set TS_OAUTH_CLIENT_ID --env Production --repo RATCHAW/thinkclear
gh secret set TS_OAUTH_SECRET    --env Production --repo RATCHAW/thinkclear
```

`COOLIFY_TOKEN` comes from Coolify → Keys & Tokens → API tokens. The Tailscale
pair is an OAuth client with the `tag:ci` tag; scope that tag in your ACL to that
one host and port — the deploy job holds credentials to production and should be
able to reach nothing else.

The environment has no protection rules. If you want deployments to it
restricted to `main`, that is one call — the manual rollback path still works,
since `workflow_dispatch` runs the workflow on `main` and checks out the older
`ref` from there:

```bash
gh api -X PUT repos/RATCHAW/thinkclear/environments/Production \
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
curl -fsS https://app.thinkclear.xyz/api/health          # {"status":"ok","database":"connected",…}
curl -fsS https://app.thinkclear.xyz/.well-known/oauth-protected-resource/api/mcp | jq
claude mcp add --transport http thinkclear https://app.thinkclear.xyz/api/mcp
```

The second one is the check that the origin is wired correctly end to end: it is
served by the API, at a path only the rewrite can reach, and its contents are
the URLs an MCP client will be sent to next — which should name
`app.thinkclear.xyz`, never `api.thinkclear.xyz`.

## Running the deployed shape locally

```bash
docker compose --profile full up --build
```

nginx on :5173 in front of the API on :3000 and Mongo — the same one-origin
topology Vercel's rewrites produce, which is why it is worth reaching for when
something works in `pnpm dev` and not in production.
