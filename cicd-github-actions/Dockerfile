# Stage 1: install dependencies and run the tests
FROM node:22-alpine AS build

WORKDIR /app

COPY app/package.json ./
RUN npm install

COPY app/ ./
RUN npm test

# Stage 2: only what is needed to run
FROM node:22-alpine AS production

WORKDIR /app

# run as a non root user
RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/app.js /app/server.js ./

USER nodeapp

EXPOSE 3000

CMD ["node", "server.js"]
