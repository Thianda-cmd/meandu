import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type * as schema from './schema.js'

/** Any Drizzle Postgres database: Neon in production, PGlite in tests and local dev. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
