FROM node:22-alpine AS build

WORKDIR /app

COPY app/package.json ./
RUN npm install --omit=dev

COPY app/ ./
RUN npm test

FROM node:22-alpine AS production

WORKDIR /app

# The scan also flagged an OpenSSL CVE in the base image, so pull in the
# patched Alpine packages before anything else.
RUN apk upgrade --no-cache

# a non root user, so a compromise inside the container is not root
RUN addgroup -S appuser && adduser -S appuser -G appuser

# The image scan flagged HIGH CVEs in packages bundled with npm itself
# (pacote, picomatch, sigstore). The running app only needs node, not npm,
# so removing npm takes those packages out of the image entirely.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/app.js /app/server.js ./

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
