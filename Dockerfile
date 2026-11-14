FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/mobile/package.json apps/mobile/package-lock.json ./apps/mobile/
RUN npm ci --prefix apps/mobile --no-audit --no-fund
COPY apps/mobile ./apps/mobile
COPY scripts/build-production.mjs ./scripts/build-production.mjs
RUN node scripts/build-production.mjs

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 QUAD_DB=/data/quad.sqlite
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gosu ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY backend ./backend
RUN rm -rf backend/tests
COPY scripts/container-entrypoint.sh scripts/restore-backup.mjs ./scripts/
COPY --from=build /app/apps/mobile/dist ./apps/mobile/dist
RUN chmod +x scripts/container-entrypoint.sh && mkdir /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/scripts/container-entrypoint.sh"]
