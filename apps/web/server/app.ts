import type { AccountInfo } from '@meandu/core'
import { asc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { ZodError } from 'zod'
import { type Auth, isRealEmail } from './auth.js'
import type { Db } from './db.js'
import { AppError } from './errors.js'
import { passkey, user } from './schema.js'
import {
  createSpace,
  createSpaceInput,
  inviteFor,
  joinInput,
  joinSpace,
  spaceState,
} from './space.js'
import { applyMutations, pull, syncRequest } from './sync.js'

type Env = { Variables: { userId: string } }

/** The whole API. Runs as one Vercel function in production and as a local server in dev. */
export function createApp({
  db,
  auth,
  emailSignIn = false,
}: {
  db: Db
  auth: Auth
  /** Whether codes can be emailed (an email service is set up). */
  emailSignIn?: boolean
}) {
  const app = new Hono<Env>().basePath('/api')

  app.onError((error, c) => {
    if (error instanceof AppError) return c.json({ error: error.code }, error.status)
    if (error instanceof ZodError) return c.json({ error: 'invalid' }, 400)
    console.error(error)
    return c.json({ error: 'server' }, 500)
  })

  app.notFound((c) => c.json({ error: 'not-found', path: c.req.path }, 404))

  app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))

  app.get('/health', async (c) => {
    const started = Date.now()
    await db.execute(sql`select 1`)
    return c.json({ ok: true, db: 'up', ms: Date.now() - started })
  })

  // Our own endpoints only accept requests from the app itself (CSRF protection on top of
  // SameSite cookies and the JSON-only body).
  const sameOrigin = createMiddleware<Env>(async (c, next) => {
    const origin = c.req.header('origin')
    // Behind a proxy the address we're called on can differ from the public one. Pages on
    // other sites can't set X-Forwarded-Host without a preflight, which this API never allows.
    const hosts = [new URL(c.req.url).host, c.req.header('x-forwarded-host')]
    if (!origin || !hosts.includes(new URL(origin).host)) {
      throw new AppError(403, 'origin')
    }
    await next()
  })

  const signedIn = createMiddleware<Env>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) throw new AppError(401, 'signed-out')
    c.set('userId', session.user.id)
    await next()
  })

  /** What this server can do, for screens shown before signing in. */
  app.get('/config', (c) => c.json({ email: emailSignIn }))

  /** How you can get back into your account: a confirmed email and your passkeys. */
  app.get('/account', signedIn, async (c) => {
    const userId = c.get('userId')
    const [me] = await db.select().from(user).where(eq(user.id, userId))
    const keys = await db
      .select({ id: passkey.id, name: passkey.name, createdAt: passkey.createdAt })
      .from(passkey)
      .where(eq(passkey.userId, userId))
      .orderBy(asc(passkey.createdAt))
    const email = me && isRealEmail(me.email, me.emailVerified) ? me.email : null
    const info: AccountInfo = {
      email,
      passkeys: keys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString() })),
      protected: Boolean(email || keys.length),
    }
    return c.json(info)
  })

  app.get('/space', signedIn, async (c) => {
    const state = await spaceState(db, c.get('userId'))
    return state ? c.json(state) : c.json({ error: 'no-space' }, 404)
  })

  app.post('/space', sameOrigin, signedIn, async (c) => {
    const input = createSpaceInput.parse(await c.req.json())
    return c.json(await createSpace(db, c.get('userId'), input))
  })

  app.post('/space/invite', sameOrigin, signedIn, async (c) => {
    return c.json(await inviteFor(db, c.get('userId')))
  })

  app.post('/space/join', sameOrigin, signedIn, async (c) => {
    const input = joinInput.parse(await c.req.json())
    return c.json(await joinSpace(db, c.get('userId'), input))
  })

  app.post('/sync', sameOrigin, signedIn, async (c) => {
    const userId = c.get('userId')
    const body = syncRequest.parse(await c.req.json())
    const state = await spaceState(db, userId)
    if (!state) throw new AppError(409, 'no-space')
    if (body.mutations.length) {
      await db.transaction((tx) => applyMutations(tx, userId, state.spaceId, body.mutations))
    }
    // A device that comes from another space (it just joined its partner) starts from scratch.
    const since = body.spaceId && body.spaceId !== state.spaceId ? 0 : body.since
    return c.json(await pull(db, userId, state.spaceId, since))
  })

  return app
}
