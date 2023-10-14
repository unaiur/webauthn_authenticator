<h1 align="center">
<img width="40" valign="bottom" src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Typescript_logo_2020.svg/1024px-Typescript_logo_2020.svg.png">
Webauthn Relaying Party for HomeLab Authentication
</h1>
<h4 align="center">A Webauthn Relaying Party written in Node.js 20 and TypeScript for basic use cases, like Homelab authentication.</h4>
<br/>

<h2>Roadmap</h2>
<h3>1.0</h3>
 * ~~Extensive Unit Tests~~
 * ~~Auditing~~
 * Continous Integration
 * Documentation
<h3>1.1</h3>
 * Admin UI:
   - add, update and delete roles and users
<h3>1.2</h3>
 * User UI:
   - update user display name, delete user
   - register/unregister devices, update device display name
<h3>1.3</h3>
 * Admin UI:
   - Rule editor

<h2>Installation</h2>

```
npm install
```

<h2>Usage</h2>

Start express server in dev mode (hot reloading):

```
npm run serve
```

Start express server in production mode:

```
npm run start
```

The server is accessible at http://localhost:8081

Generate a docker container:

```
docker build .
```

Docker uses the official [Node 18](https://github.com/nodejs/docker-node) image based on Alpine Linux.
