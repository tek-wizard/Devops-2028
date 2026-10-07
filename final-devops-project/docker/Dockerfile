# ---------- build and test ----------
FROM node:22-alpine AS build

WORKDIR /app

COPY application/package.json ./
RUN npm install --omit=dev

COPY application/ ./
RUN npm test

# ---------- runtime ----------
FROM node:22-alpine AS production

WORKDIR /app

# patched base packages, found by the image scan in session 17
RUN apk upgrade --no-cache

# npm is only needed to build, and it drags in packages with known CVEs
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

RUN addgroup -S app && adduser -S app -G app

# The app writes to /data. It runs as a non root user, so the directory has to
# exist and be owned by that user, otherwise the first write fails with EACCES.
RUN mkdir -p /data && chown -R app:app /data
VOLUME /data

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/tasks.js /app/server.js ./

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
