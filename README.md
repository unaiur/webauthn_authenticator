# <img width="40" valign="bottom" src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Typescript_logo_2020.svg/1024px-Typescript_logo_2020.svg.png"> Simple Webauthn Relaying Party

**A Webauthn Relaying Party written in Node.js 20 and TypeScript for basic use cases, like HomeLab authentication.**

## Features

Users are created by an administrator; any user with `admin` role. Once a user is created, it is invited to register a new credential. Invitation have an expiration after which they are
useless. Before version 1.1, the UI is not ready and users must be created from command line;
see [Manage Users Manually](#manage-users-manually) section for more details.

On first execution or if all users are removed, a `owner` user is created with `admin` role is created and an invitation URL generated and printed in console output or Docker logs.

The user can register a new credential using the invitation URL and authenticate using them from that point on.

Administrators can also update a user name or display name or add or remove roles. Administrator can also send additional invitations to a user, which allows to register multiple devices (like an iCloud Passkey and a Yubikey). Users can also be deleted. Before version 1.0, the UI is not ready and users must be updated or removed from command line; see [Manage Users Manually](#manage-users-manually) section for more details.

Also, you can setup authorization rules and integrate this software with Traefik reverse proxy as a Forward Authentication Service.

## Roadmap
### Version 1.1
* Admin UI:
  - add, update and delete roles and users

### Version 1.2
 * User UI:
   - update user display name, delete user
   - register/unregister credentials, update credential display name.

### Version 1.3
 * Admin UI:
   - manage authorization rules.

## Docker Installation
This project uses GitHub Actions to automatically build the official [Node 20](https://github.com/nodejs/docker-node) images based on Alpine Linux.

### Prerequisites
You need a Docker Traefik HTTPS instalation. Check [this guide](https://doc.traefik.io/traefik/https/acme/) that explains how to configure it using Let's encrypt certificates.

### Webauthn Proxy Service configuration
```yaml
version: '3'
services:
  traefik:
    # Some traefik configuration here
  webuathn:
    container_name: webauthn
    image: unaiur/webauthn_authenticator:main
    restart: unless-stopped
    volumes:
      - ./webauthn:/data
    environment:
      PUBLIC_AUTH_URL: https://auth.example.org
      RP_ID: example.org
      AUDIT_PATH: /data/audit.log
      DB_PATH: /data/auth.db
      DB_SYNC: true # You need this flag enabled on first run. Disable it afterwards
      JWT_SECRET: SOME_RANDOM_SECRET
    labels:
      - "autoheal=true"
      - "traefik.enable=true"
      - "traefik.http.routers.webauthn.rule=Host(`auth.example.org`)"
      - "traefik.http.routers.webauthn.entrypoints=websecure"
      - "traefik.http.middlewares.webauthn.forwardauth.address=http://webauthn:8080/authz"
      - "traefik.http.middlewares.webauthn.forwardauth.authResponseHeadersRegex=^X-Forwarded-For-"
      - "traefik.http.middlewares.webauthn.forwardauth.authRequestHeaders=Cookie"
```

Important notes:
* Remember to create a `webauthn` folder where your compose.yml file is located.
* Remember to disable DB_SYNC flag after the DB structure is created to avoid losing data on upgrades.
* It also registers a forward authentication middleware called `webauthn` that can be used in other services to enable Webauthn authentication. See next section for details.
* If you do not select a JWT_SECRET, a random one is selected every time the service is restarted, causing all your existing sessions to become invalid.

### Protecting other services with our authentication middleware

You can easily protect other Docker services adding this label to the container:
```
"traefik.http.routers.<SERVICE_NAME>.middlewares=webauthn"
```

For example, my grafana instance uses this setup:

```yaml
  grafana:
    image: "teslamate/grafana:latest"
    environment:
      - DATABASE_USER=admin
      - DATABASE_PASS=SOME_PASSWORD
      - DATABASE_NAME=grafana
      - DATABASE_HOST=db
      - GF_AUTH_ANONYMOUS_ENABLED=true # This allows RO access to all users
    volumes:
      - "./grafana/data:/var/lib/grafana"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.grafana.rule=Host(`grafana.example.org`)"
      - "traefik.http.routers.grafana.middlewares=webauthn"
      - "traefik.http.routers.grafana.entrypoints=websecure"
```

### Manage Users Manually

You need to issue SQL commands from command line using sqlite3 command line.

You need to install sqlite3 package in your host operating system; for example, in Ubuntu or Debian, you need to issue this command:

```sh
sudo apt install sqlite3
```

After the database is created after first execution, you can connect to it using this command

```sh
sqlite3 webauthn/auth.db
```

#### Create Update & Delete a User

You can create a new user called jdoe user for Jane Doe running this SQL statement:

```sql
INSERT INTO user(id, name, displayName) VALUES (hex(randomblob(16)), 'jdoe', 'Jane Doe');
```

Later, you can rename it to John Doe with this command:
```sql
UPDATE user SET displayName='John Doe' WHERE name='jdoe';
```

Finally, you can delete the user with this command:
```sql
DELETE FROM user WHERE name='jdoe';
```

#### Roles

A user without roles is still equivalent to an anonymous user. By default, an `admin` role is created that allows users to access all services.

You can create a new `user` role with this command:

```sql
INSERT INTO role(value, display) VALUES ('user', 'Regular User');
```

You can also update the role description or delete that role:
```sql
UPDATE role SET display='Common User' WHERE value='user';
DELETE FROM role WHERE value='user';
```

Finally, you can assign roles to a user with this command:
```sql
INSERT INTO user_roles_role(userId, roleValue) SELECT id, 'user' FROM user WHERE name='jdoe';
```

Or, revoke a role with:
```sql
DELETE FROM user_roles_role WHERE roleValue='user' AND userId IN (SELECT id FROM user WHERE name='jdoe');
```

#### Invitations

Invitation identifier must be random and keep confidential between the administrator and the invited user. Any person that have access to the invitation identifier can register in its place and prevent the legitimate user from registering.

You can create a new invitation with id `SomeRandomCode` for our user `jdoe` which expires after one day (86400 seconds) with this command:
```sql
INSERT INTO invitation(id, userId, durationSecs, challenge) VALUES('SomeRandomCode', 'jdoe', 86400, randomBlob(32));
```

The invitation URL is `$PUBLIC_AUTH_URL/register/SomeRandomCode`, being $PUBLICH_AUTH_URL the value configured in Docker compose.yaml (in our example, https://auth.example.org/register/SomeRandomCode)

Invitations are removed automatically when they are accepted or after they expire.

### Manage Authorization Rules Manually

By default, when initializing a new database, a single authorization rule is created that grants access to all services. Also, there is an implicit rule at the end that denies access for any request that does not match any of the defined rules.

Rules have following fields:
- id: unique identifier
- position: integer that defines the order of execution. rules with smaller position value will be executed before rules with larger values.
- name: short name for the rule that will be registered in audit logs.
- description: larger description for human consumption.
- action: either `allow` or `deny`.
- roles: list of roles separated with comma, for example, `viewer,reader.  If null, all users match this rule, including the anonymous user. If not null, a user must have at least one of the specified roles.
- hostRegex: a regular expression, for example: `^grafana\..*`. If null, all URL hosts trigger this rule. Otherwise, only URLs with a host matching this regular expression.
- pathRegex: a regular expression, for example: `^\/public\/.*`. If null, all URL paths trigger this rule. Otherwise, only URLs with a patch matching this regular expression.

For example, we can add a rule granting access to everybody (including anonymous users) to any URL with a path component starting with `/public/` with this command:

```sql
INSERT INTO rule(id, position, name, description, action, pathRegex)
VALUES (hex(randomBlob(8)), 20, 'allowPublihPath', 'Bla bla', 'allow', '^\/public\/.*');
```

This policy allows users with 'viewer' role to access Nodered Dashboard:

```sql
INSERT INTO rule(id, position, name, description, action, roles, hostRegex, pathRegex)
VALUES (hex(randomBlob(8)), 10, 'allowNoderedViewer', 'Bla bla', 'allow', 'viewer', '^nodered\.example\.org$', '^\/ui\/.*');
```

## Development

Install all NPM dependencies with command
```
npm install
```

Start express server in dev mode (with hot reloading):

```
npm run serve
```

Start express server in production mode:

```
npm run start
```

The server is accessible at http://localhost:8080

Generate a docker container:

```
docker build .
```

