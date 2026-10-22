// The API for local development, backed by an embedded Postgres (PGlite) in apps/web/.pglite.
import { PGlite } from '@electric-sql/pglite'
import { serve } from '@hono/node-server'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createApp } from '../server/app'
import { createAuth } from '../server/auth'
import * as schema from '../server/schema'

const client = new PGlite(process.env.PGLITE_DIR ?? '.pglite')
const db = drizzle({ client, schema })
await migrate(db, { migrationsFolder: 'drizzle' })

const app = createApp({
  db,
  auth: createAuth(db, { secret: 'local-dev-secret-not-for-production', rateLimit: false }),
})
const port = Number(process.env.API_PORT ?? 8787)
serve({ fetch: app.fetch, port }, () => console.log(`API on http://localhost:${port}`))
