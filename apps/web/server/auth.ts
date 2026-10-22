import { getAuthenticatorName, passkey as passkeys } from '@better-auth/passkey'
import { type BetterAuthPlugin, betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
  sessionMiddleware,
} from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { anonymous } from 'better-auth/plugins'
import { emailOTP } from 'better-auth/plugins/email-otp'
import type { Db } from './db.js'
import { codeEmail, type SendEmail } from './email.js'
import { account, passkey, rateLimit, session, user, verification } from './schema.js'

const DAY = 60 * 60 * 24

export const ALLOWED_HOSTS = [
  'couple.bojes.org',
  '*.vercel.app',
  'localhost:5173',
  'localhost:4173',
]

/** Device-only accounts get a placeholder address on this domain. */
export const ANONYMOUS_DOMAIN = 'anonymous.meandu.app'

/** An address the person proved is theirs, not a device-only placeholder. */
export function isRealEmail(
  email: string | null | undefined,
  verified: boolean | null | undefined,
) {
  return Boolean(email && verified && !email.endsWith(`@${ANONYMOUS_DOMAIN}`))
}

export interface AuthOptions {
  secret?: string
  rateLimit?: boolean
  /** Passkeys belong to one site: its domain and the exact addresses it's opened from. */
  passkeys?: { rpID: string; origins: string[] }
  /** Delivers sign-in codes. Without it, email sign-in is off. */
  sendEmail?: SendEmail | null
  /** Lets an email finish sending after the response went out (Vercel's waitUntil). */
  background?: (task: Promise<unknown>) => void
  /** Where the app lives, for the logo in emails. */
  site?: string
}

type Adapter = {
  count: (args: { model: string; where: { field: string; value: string }[] }) => Promise<number>
}

/** Protected = there's a way back in besides this device: a passkey or a confirmed email. */
async function isProtected(
  adapter: Adapter,
  u: { id: string; email: string; emailVerified: boolean },
) {
  if (isRealEmail(u.email, u.emailVerified)) return true
  return (await adapter.count({ model: 'passkey', where: [{ field: 'userId', value: u.id }] })) > 0
}

const notFresh = () =>
  new APIError('FORBIDDEN', { code: 'SESSION_NOT_FRESH', message: 'Sign in again first' })

/**
 * A device-only account has nothing to prove itself with but its session, so it may swap
 * that for a fresh one (needed to add a passkey). Protected accounts sign in again instead.
 */
const deviceAccounts = () =>
  ({
    id: 'meandu-device-accounts',
    endpoints: {
      renewDeviceSession: createAuthEndpoint(
        '/device/renew',
        { method: 'POST', use: [sessionMiddleware] },
        async (ctx) => {
          const { session: current, user: me } = ctx.context.session
          if (await isProtected(ctx.context.adapter, me)) throw notFresh()
          const fresh = await ctx.context.internalAdapter.createSession(me.id)
          await setSessionCookie(ctx, { session: fresh, user: me })
          await ctx.context.internalAdapter.deleteSession(current.token)
          return ctx.json({ ok: true })
        },
      ),
    },
  }) satisfies BetterAuthPlugin

/** Changing how a protected account signs in needs a sign-in from the last day. */
const NEEDS_RECENT_SIGN_IN = new Set(['/email-otp/request-email-change', '/passkey/delete-passkey'])

/**
 * Accounts start on the device: one tap, no email. A passkey or a confirmed email can be
 * added to the same account later, and then it signs in anywhere.
 */
export function createAuth(db: Db, options: AuthOptions = {}) {
  const site = options.site ?? 'https://couple.bojes.org'
  const rp = options.passkeys ?? { rpID: 'couple.bojes.org', origins: [site] }

  return betterAuth({
    appName: 'meandu',
    basePath: '/api/auth',
    baseURL: { allowedHosts: ALLOWED_HOSTS, fallback: site },
    secret: options.secret,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification, rateLimit, passkey },
    }),
    // A device's session is its key to the account, so it lasts long and renews itself.
    session: { expiresIn: 400 * DAY, updateAge: DAY },
    rateLimit: {
      enabled: options.rateLimit ?? true,
      storage: 'database',
      window: 60,
      max: 120,
      customRules: {
        '/sign-in/anonymous': { window: 60, max: 5 },
        '/sign-in/email-otp': { window: 60, max: 10 },
        '/email-otp/change-email': { window: 60, max: 10 },
        '/passkey/verify-authentication': { window: 60, max: 20 },
      },
    },
    // Codes only sign in or confirm an address; there are no passwords to reset.
    disabledPaths: [
      '/email-otp/verify-email',
      '/email-otp/check-verification-otp',
      '/email-otp/request-password-reset',
      '/forget-password/email-otp',
      '/email-otp/reset-password',
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/email-otp/send-verification-otp' && ctx.body?.type !== 'sign-in') {
          throw new APIError('BAD_REQUEST', { code: 'invalid', message: 'Only sign-in codes' })
        }
        if (!NEEDS_RECENT_SIGN_IN.has(ctx.path)) return
        const current = await getSessionFromCtx(ctx)
        if (!current || !(await isProtected(ctx.context.adapter, current.user))) return
        if (Date.now() - new Date(current.session.createdAt).getTime() > DAY * 1000) {
          throw notFresh()
        }
      }),
    },
    plugins: [
      anonymous({ emailDomainName: ANONYMOUS_DOMAIN, disableDeleteAnonymousUser: true }),
      passkeys({
        rpID: rp.rpID,
        rpName: 'meandu',
        origin: rp.origins,
        // Discoverable, so "sign in with passkey" works without typing anything first.
        authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
        registration: {
          // Label it by where it's kept, e.g. "iCloud Keychain".
          afterVerification: ({ verification: v }) => ({
            name: getAuthenticatorName(v.registrationInfo?.aaguid) ?? undefined,
          }),
        },
      }),
      emailOTP({
        // New people start in the app; email signs in to an account that already has it.
        disableSignUp: true,
        otpLength: 6,
        expiresIn: 10 * 60,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        changeEmail: { enabled: true },
        async sendVerificationOTP({ email, otp, type }, ctx) {
          if (!options.sendEmail) throw new Error('No email sender configured')
          const lang = ctx?.headers?.get('x-lang') === 'de' ? 'de' : 'en'
          const purpose = type === 'change-email' ? 'add-email' : 'sign-in'
          await options.sendEmail({ to: email, ...codeEmail({ code: otp, lang, purpose, site }) })
        },
      }),
      deviceAccounts(),
    ],
    advanced: options.background ? { backgroundTasks: { handler: options.background } } : {},
    telemetry: { enabled: false },
  })
}

export type Auth = ReturnType<typeof createAuth>
