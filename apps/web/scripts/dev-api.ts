// The API for local development, backed by an embedded Postgres (PGlite) in apps/web/.pglite.
import { PGlite } from '@electric-sql/pglite'
import { serve } from '@hono/node-server'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createApp } from '../server/app.js'
import { createAuth } from '../server/auth.js'
import type { Email } from '../server/email.js'
import * as schema from '../server/schema.js'

const client = new PGlite(process.env.PGLITE_DIR ?? '.pglite')
const db = drizzle({ client, schema })
await migrate(db, { migrationsFolder: 'drizzle' })

// Emails aren't sent locally: they're printed, and the last one per address can be read back.
const inbox = new Map<string, Email>()
const sendEmail = async (email: Email) => {
  inbox.set(email.to, email)
  console.log(`[email] to ${email.to}: ${email.subject}`)
}

const app = createApp({
  db,
  auth: createAuth(db, {
    secret: 'local-dev-secret-not-for-production',
    rateLimit: false,
    sendEmail,
    site: 'http://localhost:5173',
    passkeys: { rpID: 'localhost', origins: ['http://localhost:5173', 'http://localhost:4173'] },
  }),
  emailSignIn: true,
})
app.get('/dev/inbox/:to', (c) => {
  const email = inbox.get(c.req.param('to'))
  return email ? c.json({ subject: email.subject, text: email.text }) : c.json(null, 404)
})

const port = Number(process.env.API_PORT ?? 8787)
serve({ fetch: app.fetch, port }, () => console.log(`API on http://localhost:${port}`))
