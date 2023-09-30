# --------------> The build image
FROM node:18-alpine3.16 AS modules
WORKDIR /usr/src/app
ENV NODE_ENV production
RUN apk update && apk add dumb-init
COPY packages/backend/package*.json /usr/src/app/
RUN npm ci --only=production

# --------------> Compile the code
FROM node:18-alpine3.16 AS code
WORKDIR /usr/src/app
COPY . /usr/src/app/
RUN rm -rf packages/backend/dist
RUN npm install && npm run build

# --------------> The production image
FROM node:18-alpine3.16
WORKDIR /usr/src/app
ENV NODE_ENV production
COPY --from=modules /usr/bin/dumb-init /usr/bin/dumb-init
USER node
COPY --chown=node:node --from=modules /usr/src/app/node_modules node_modules
COPY --chown=node:node --from=code /usr/src/app/packages/backend/dist /usr/src/app
CMD ["dumb-init", "node", "bin/index.js"]
EXPOSE 8080/tcp
