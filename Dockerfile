# Runs the FULL application, including the owner editor, on any host that can
# run a container (Render, Fly.io, Railway, a VPS). GitHub Pages cannot do this
# — see README.md — so this is the deployment that makes /owner reachable.
#
# The container needs a PERSISTENT VOLUME mounted at /data. Without one the
# SQLite database and every uploaded photograph are erased on each redeploy.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
# Database and uploads live together on the mounted volume.
ENV DATABASE_PATH=/data/site.sqlite
COPY --from=build /app ./
VOLUME ["/data"]
EXPOSE 3000
# Setup is idempotent: it migrates, seeds only when the site row is absent, and
# never overwrites later owner edits. It fails closed if the secrets are absent.
CMD ["sh", "-c", "node scripts/run.cjs scripts/setup.ts && npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
