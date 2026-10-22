// Applies database migrations during the Vercel build, before the new version goes live.
import { fileURLToPath } from 'node:url'
import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { migrate } from 'drizzle-orm/neon-serverless/migrator'

// Prefer the direct (non-pooled) connection the Vercel–Neon integration manages.
const url =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL
if (!url) {
  console.log('[migrate] No database configured, skipping.')
  process.exit(0)
}

const pool = new Pool({ connectionString: url })
try {
  await migrate(drizzle({ client: pool }), {
    migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
  })
  console.log('[migrate] Database is up to date.')
} finally {
  await pool.end()
}
