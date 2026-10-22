import { Pool } from '@neondatabase/serverless'
import { attachDatabasePool } from '@vercel/functions'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { createApp } from '../server/app'
import { createAuth } from '../server/auth'
import * as schema from '../server/schema'

// POSTGRES_URL is managed by the Vercel–Neon integration, so password rotations reach the app.
const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL

// One pool per function instance; Vercel closes idle connections before the instance sleeps.
const pool = new Pool({ connectionString })
attachDatabasePool(pool)

const db = drizzle({ client: pool, schema })
const app = createApp({ db, auth: createAuth(db) })

export default { fetch: app.fetch }
