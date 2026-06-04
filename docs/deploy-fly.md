# Deploy the processing daemon to Fly.io

This moves the background daemon (`scripts/local-processor.mjs`) off your PC and
onto a small always-on Fly worker, so deals process even when your machine is
off. The Next.js web app stays on Vercel (Hobby/free is fine) — only the daemon
moves here.

The daemon has **no web server**. It listens to Supabase Realtime and runs the
Claude Vision pipeline. Files in this setup: `Dockerfile`, `.dockerignore`,
`fly.toml`.

## Cost

A `shared-cpu-1x` / 1GB machine running 24/7 is roughly **$5/month** (drop to
512MB in `fly.toml` for ~$3). Fly requires a payment method even for small usage.
Your Anthropic API spend is unchanged — that's separate from hosting.

## One-time setup

1. **Install flyctl** and sign in:
   ```powershell
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   fly auth signup   # or: fly auth login
   ```

2. **Create the app** using the committed `fly.toml` (don't deploy yet):
   ```powershell
   fly launch --no-deploy --copy-config --name dealcheck-daemon
   ```
   If the name is taken, change `app = "..."` in `fly.toml` and rerun.

3. **Set secrets** (these become the daemon's environment — replace the
   placeholders with your real values; do NOT commit them):
   ```powershell
   fly secrets set `
     ANTHROPIC_API_KEY="sk-ant-..." `
     NEXT_PUBLIC_SUPABASE_PROJECT_ID="your-project-ref" `
     SUPABASE_SERVICE_KEY="your-service-role-key" `
     BATCH_ENABLED="true" `
     BATCH_MIN_DEALS="2" `
     BATCH_MAX_WAIT_MIN="10" `
     PREPROCESS_IMAGES="true"
   ```
   These mirror your local `.env.local`. The web app's Clerk keys are NOT needed
   here — the daemon never touches auth.

4. **Deploy:**
   ```powershell
   fly deploy
   ```

5. **Confirm exactly one instance** and watch it boot:
   ```powershell
   fly scale count 1
   fly logs
   ```
   You should see the daemon connect and `recoverStuckDeals` run, then
   `waiting for deals…`.

## Critical: run only ONE daemon

The daemon is not designed to run in parallel — two copies would both pick up the
same deals and process them twice. So:

- **Stop the daemon on your PC** (Ctrl+C in its terminal) once Fly is live.
- **Keep `fly scale count 1`.** Never scale above 1.

## Everyday operations

- **Logs:** `fly logs` (live) — the per-deal cost/cache/timing lines print here.
- **Change a setting** (e.g. tune the legibility gate later):
  ```powershell
  fly secrets set LEGIBILITY_THRESHOLD="120"   # triggers a restart
  ```
- **Restart** (e.g. after a code change + `fly deploy`): deploying restarts it.
  To restart without redeploying: `fly apps restart dealcheck-daemon`.
- **Status:** `fly status`.

## When you change daemon code

Redeploy from the repo root:
```powershell
fly deploy
```
The new machine starts with your latest `lib/` + `scripts/` and re-queues any
in-flight deals on boot.

## Notes

- Region: `primary_region` in `fly.toml` defaults to `sea` (Seattle). For lowest
  latency set it to match your Supabase project region.
- The image excludes `.env.local`, `evals/`, `docs/`, and `.next` (see
  `.dockerignore`) but keeps `compliance-prompt.md` and `lib/examples/*.md`,
  which the daemon reads at runtime.
