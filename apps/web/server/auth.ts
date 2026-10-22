import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { anonymous } from 'better-auth/plugins'
import type { Db } from './db'
import { account, rateLimit, session, user, verification } from './schema'

const DAY = 60 * 60 * 24

export const ALLOWED_HOSTS = [
  'couple.bojes.org',
  '*.vercel.app',
  'localhost:5173',
  'localhost:4173',
]

/**
 * Accounts start anonymous: one tap creates a private account on this device, no email
 * needed. Passkeys or email can be added to the same account later.
 */
export function createAuth(db: Db, options: { secret?: string; rateLimit?: boolean } = {}) {
  return betterAuth({
    appName: 'meandu',
    basePath: '/api/auth',
    baseURL: { allowedHosts: ALLOWED_HOSTS, fallback: 'https://couple.bojes.org' },
    secret: options.secret,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification, rateLimit },
    }),
    // A device's session is its key to the account, so it lasts long and renews itself.
    session: { expiresIn: 400 * DAY, updateAge: DAY },
    rateLimit: {
      enabled: options.rateLimit ?? true,
      storage: 'database',
      window: 60,
      max: 120,
      customRules: { '/sign-in/anonymous': { window: 60, max: 5 } },
    },
    plugins: [
      anonymous({ emailDomainName: 'anonymous.meandu.app', disableDeleteAnonymousUser: true }),
    ],
    telemetry: { enabled: false },
  })
}

export type Auth = ReturnType<typeof createAuth>
