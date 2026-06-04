# Worker image for the DealCheck Vision processing daemon
# (scripts/local-processor.mjs). This is NOT the Next.js web app — it has no HTTP
# server. It subscribes to Supabase Realtime and runs the Claude Vision pipeline.
# Deployed to Fly.io as a single always-on worker.

FROM node:22-bookworm-slim

WORKDIR /app

# Production deps only. The daemon never imports next/eslint/tailwind (those are
# the web app's). sharp ships prebuilt linux binaries, so no apt packages needed.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Runtime source: the daemon, shared lib, and the prompt/example files that
# vision.mjs reads from disk at runtime (compliance-prompt.md, lib/examples/*.md).
# Secrets are injected by Fly (fly secrets set), never baked into the image —
# .env.local is excluded via .dockerignore.
COPY . .

ENV NODE_ENV=production

CMD ["node", "scripts/local-processor.mjs"]
