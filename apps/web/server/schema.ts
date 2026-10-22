import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

/* ── Accounts (tables Better Auth expects) ─────────────────────────────── */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  isAnonymous: boolean('is_anonymous').default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('session_user_idx').on(t.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
)

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/** Passkeys (Face ID, Touch ID, a password manager…) that can sign in to an account. */
export const passkey = pgTable(
  'passkey',
  {
    id: text('id').primaryKey(),
    /** Where it's kept, e.g. "iCloud Keychain". */
    name: text('name'),
    publicKey: text('public_key').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    credentialID: text('credential_id').notNull(),
    counter: integer('counter').notNull(),
    deviceType: text('device_type').notNull(),
    backedUp: boolean('backed_up').notNull(),
    transports: text('transports'),
    aaguid: text('aaguid'),
    createdAt: createdAt(),
  },
  (t) => [
    index('passkey_user_idx').on(t.userId),
    index('passkey_credential_idx').on(t.credentialID),
  ],
)

/** Shared request counters, so limits hold across serverless instances. */
export const rateLimit = pgTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
})

/* ── The couple's space ────────────────────────────────────────────────── */

export const spaces = pgTable('spaces', {
  id: uuid('id').primaryKey(),
  /** Bumped (under a row lock) by every write, so changes are numbered in commit order. */
  version: bigint('version', { mode: 'number' }).notNull().default(0),
  /** `paused` after unlinking; active again once both relink. */
  status: text('status').notNull().default('active'),
  /** Who unlinked, and when. */
  pausedBy: text('paused_by'),
  pausedAt: timestamp('paused_at', { withTimezone: true }),
  plan: text('plan').notNull().default('free'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/** Who belongs to which space. One space per person, at most two people per space. */
export const members = pgTable(
  'members',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    /** While the space is paused: this person wants to relink. */
    wantsBack: boolean('wants_back').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('members_space_idx').on(t.spaceId)],
)

export const invites = pgTable(
  'invites',
  {
    code: text('code').primaryKey(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    createdBy: text('created_by').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedBy: text('used_by'),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('invites_space_idx').on(t.spaceId)],
)

/**
 * Everything the app syncs (events, lists, list items, memories, profiles, space settings)
 * is a JSON document here. Partial updates merge into `data`; deletes leave a tombstone.
 */
export const records = pgTable(
  'records',
  {
    id: text('id').primaryKey(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    version: bigint('version', { mode: 'number' }).notNull(),
    createdBy: text('created_by').notNull(),
    /** Private events are only ever sent to the person who made them. */
    private: boolean('private').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('records_space_version_idx').on(t.spaceId, t.version)],
)
