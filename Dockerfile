# ============================
# Production dependencies
# ============================
FROM node:26-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

# ============================
# Test stage (CI builds this target on every platform)
# ============================
FROM deps AS test
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm test

# ============================
# Runtime
# ============================
FROM node:26-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
# Package managers are not needed at runtime and only add attack surface
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js ./
COPY src ./src
COPY public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]
