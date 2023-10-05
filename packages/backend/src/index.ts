import express, { Express, Request, Response } from "express"
import helmet from "helmet"
import morgan from "morgan"
import hbs from "hbs"
import { loadSettings } from './data/settings.js'
import { initializeAuth } from "./controllers/auth.js"
import { initializeRegistry } from "./controllers/register.js"
import "reflect-metadata"
import { loadRepositories, Repositories } from "./data/repos.js"
import { initializeAuthProxy } from "./controllers/authz.js"

const settings = loadSettings()
const repositoriesPromise = loadRepositories(settings)

hbs.registerHelper('json', JSON.stringify)

const app: Express = express()
app.set('view engine', 'hbs')
app.use(helmet())
app.use(morgan('common'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public', {maxAge: 0}))
app.get("/", (req: Request, res: Response) => {
  res.redirect(301, 'auth/')
})

repositoriesPromise
  .then(async (repositories: Repositories) => {
    initializeAuth(app, settings, repositories.credentials, repositories.users)
    initializeRegistry(app, settings, repositories.credentials, repositories.invitations)
    await initializeAuthProxy(app, settings, repositories.rules);
    app.get("*", (_, res: Response) => {
      res.sendStatus(404)
    })
    app.listen({host: settings.urlHost, port: settings.urlPort},
      () => console.log(`Running on ${settings.urlHost}:${settings.urlPort} ⚡`))
  })
  .catch(error => {
    console.log(error)

    process.abort()
  })
