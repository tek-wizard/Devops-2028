FROM node:22-alpine AS build

WORKDIR /app

COPY app/package.json ./
RUN npm install --omit=dev

COPY app/ ./
RUN npm test

FROM node:22-alpine AS production

WORKDIR /app

# a non root user, so a compromise inside the container is not root
RUN addgroup -S appuser && adduser -S appuser -G appuser

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/app.js /app/server.js ./

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
