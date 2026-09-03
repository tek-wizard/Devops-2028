FROM node:22-alpine

WORKDIR /app

# package.json is copied first so the npm install layer stays cached
# when only my code changes
COPY package.json ./
RUN npm install

COPY server.js ./

EXPOSE 3000

CMD ["npm", "start"]
