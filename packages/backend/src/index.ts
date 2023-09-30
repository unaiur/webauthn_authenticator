import express, { Express, Request, Response } from "express"
import helmet from "helmet"
import morgan from "morgan"
import hbs from "hbs"
import { URL_HOST, URL_PATH, URL_PORT } from './settings'
import { initializeAuth } from "./controllers/auth"
import { initializeRegistry } from "./controllers/register"
import "reflect-metadata"
import { initializeDataSource } from "./datasource"

const isDbReady = initializeDataSource()

hbs.registerHelper('json', JSON.stringify)

const app: Express = express()
app.set('view engine', 'hbs')
app.use(helmet())
app.use(morgan('common'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
  if (req.url.startsWith(URL_PATH)) {
    req.url = req.url.substring(URL_PATH.length - 1)
    next()
  } else {
    res.status(404).send({message: "Requested resource was not found"})
  }
})

app.use(express.static('public', {maxAge: 0}))

initializeAuth(app)
initializeRegistry(app)
app.get("/", (req: Request, res: Response) => {
  res.redirect(301, 'auth/')
})
app.get("*", (_, res: Response) => {
  res.sendStatus(404)
})


isDbReady
  .then(() => {
    return app.listen({host: URL_HOST, port: URL_PORT}, () => console.log(`Running on ${URL_HOST}:${URL_PORT} ⚡`))
  })
  .catch(error => {
    console.log(error)
    process.abort()
  })
