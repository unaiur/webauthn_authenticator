# --------------> The build image
FROM node:20.8-alpine3.18 AS modules
WORKDIR /usr/src/app
ENV NODE_ENV=production
RUN apk update && apk --no-cache add dumb-init
COPY package-lock.json /usr/src/app/
COPY packages/backend/package.json /usr/src/app
RUN npm ci --omit=dev --omit=optional
# Remove sqlite3 C source code that is no longer needed
RUN rm -rf node_modules/better-sqlite3/src node_modules/better-sqlite3/deps

# --------------> Compile the code
FROM --platform=$BUILDPLATFORM node:20.8-alpine3.18 AS code
WORKDIR /usr/src/app
ENV TSUP_ENV=production
COPY package-lock.json package.json /usr/src/app/
COPY packages /usr/src/app/packages
RUN rm -rf packages/backend/dist
RUN npm install && npm run build && npm run test

# --------------> The production image
FROM node:20.8-alpine3.18
WORKDIR /usr/src/app
COPY --from=modules /usr/bin/dumb-init /usr/bin/dumb-init
COPY --chown=node:node --from=modules /usr/src/app/node_modules node_modules
COPY --chown=node:node --from=code /usr/src/app/packages/backend/dist /usr/src/app
RUN mkdir -p /var/log /var/db && chown node:node /var/log /var/db
USER node
ENV NODE_ENV=production DB_PATH=/var/db/auth.db AUDIT_PATH=/var/log/audit.log
VOLUME ["/var/log", "/var/db"]
CMD ["dumb-init", "bin/app.cjs"]
EXPOSE 8080/tcp
