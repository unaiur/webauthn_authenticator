# --------------> The build image
FROM node:20.8-alpine3.18 AS modules
WORKDIR /usr/src/app
ENV NODE_ENV production
RUN apk update && apk --no-cache add dumb-init
COPY package*.json /usr/src/app/
COPY packages/backend/package.json /usr/src/app/packages/backend/
RUN npm ci --omit=dev

# --------------> Compile the code
FROM --platform=$BUILDPLATFORM node:20.8-alpine3.18 AS code
WORKDIR /usr/src/app
COPY package-lock.json package.json /usr/src/app/
COPY packages /usr/src/app/packages
RUN rm -rf packages/backend/dist
RUN npm install && npm run build && npm run test

# --------------> The production image
FROM node:20.8-alpine3.18
WORKDIR /usr/src/app
ENV NODE_ENV production
COPY --from=modules /usr/bin/dumb-init /usr/bin/dumb-init
USER node
COPY --chown=node:node --from=modules /usr/src/app/node_modules node_modules
COPY --chown=node:node --from=code /usr/src/app/packages/backend/dist /usr/src/app
CMD ["dumb-init", "node", "bin/index.js"]
EXPOSE 8080/tcp
