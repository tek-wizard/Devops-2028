# ------------------------------------------------------------------
# Stage 1: build the React app
# The whole toolchain (node, npm, vite, all the dev dependencies)
# is only needed here to turn the JSX into plain files.
# ------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# package.json is copied on its own first so that Docker can cache the
# npm install layer. If only my source code changes, the install is not
# repeated on the next build.
COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ------------------------------------------------------------------
# Stage 2: serve the built files
# Nothing from stage 1 comes across except the finished dist folder,
# so node and node_modules are not in the final image at all.
# ------------------------------------------------------------------
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
