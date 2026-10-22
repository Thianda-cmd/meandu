import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { ZodError } from 'zod'
import { accountInfo, deleteAccount } from './account.js'
import type { Auth } from './auth.js'
import type { Db } from './db.js'
import { AppError } from './errors.js'
import { loadPhoto, MAX_PHOTO_BYTES, savePhoto, tidyPhotos } from './photos.js'
import {
  createSpace,
  createSpaceInput,
  deleteSpace,
  inviteFor,
  joinInput,
  joinSpace,
  relink,
  spaceState,
  unlink,
} from './space.js'
import { applyMutations, pull, syncRequest } from './sync.js'

type Env = { Variables: { userId: string; signedInAt: Date } }

const DAY_MS = 24 * 60 * 60 * 1000

/** The whole API. Runs as one Vercel function in production and as a local server in dev. */
export function createApp({
  db,
  auth,
  emailSignIn = false,
  cronSecret,
}: {
  db: Db
  auth: Auth
  /** Whether codes can be emailed (an email service is set up). */
  emailSignIn?: boolean
  /** Vercel sends it with scheduled jobs; without it they don't run. */
  cronSecret?: string
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
    c.set('signedInAt', new Date(session.session.createdAt))
    await next()
  })

  /**
   * Deleting things for good: an account others could sign in to needs a sign-in from the
   * last day, like changing how it signs in. A device-only account has its phone and nothing else.
   */
  const recentSignIn = createMiddleware<Env>(async (c, next) => {
    const info = await accountInfo(db, c.get('userId'))
    if (info.protected && Date.now() - c.get('signedInAt').getTime() > DAY_MS) {
      throw new AppError(403, 'SESSION_NOT_FRESH')
    }
    await next()
  })

  /** What this server can do, for screens shown before signing in. */
  app.get('/config', (c) => c.json({ email: emailSignIn }))

  /** How you can get back into your account: a confirmed email and your passkeys. */
  app.get('/account', signedIn, async (c) => c.json(await accountInfo(db, c.get('userId'))))

  app.post('/account/delete', sameOrigin, signedIn, recentSignIn, async (c) => {
    await deleteAccount(db, c.get('userId'))
    const res = c.json({ ok: true })
    // The session is gone with the account; this also clears its cookie on the phone.
    try {
      const out = await auth.api.signOut({ headers: c.req.raw.headers, asResponse: true })
      for (const cookie of out.headers.getSetCookie()) res.headers.append('set-cookie', cookie)
    } catch {}
    return res
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

  app.post('/space/unlink', sameOrigin, signedIn, async (c) => {
    return c.json(await unlink(db, c.get('userId')))
  })

  app.post('/space/relink', sameOrigin, signedIn, async (c) => {
    return c.json(await relink(db, c.get('userId')))
  })

  app.post('/space/delete', sameOrigin, signedIn, recentSignIn, async (c) => {
    await deleteSpace(db, c.get('userId'))
    return c.json({ ok: true })
  })

  app.put('/photos/:id', sameOrigin, signedIn, async (c) => {
    if (Number(c.req.header('content-length') ?? 0) > MAX_PHOTO_BYTES) {
      throw new AppError(413, 'too-big')
    }
    const bytes = new Uint8Array(await c.req.arrayBuffer())
    await savePhoto(db, c.get('userId'), c.req.param('id'), bytes)
    return c.json({ ok: true })
  })

  app.get('/photos/:id', signedIn, async (c) => {
    const photo = await loadPhoto(db, c.get('userId'), c.req.param('id'))
    // A copy on a plain ArrayBuffer, whatever the database driver handed back.
    return c.body(new Uint8Array(photo.bytes), 200, {
      'content-type': photo.type,
      'x-content-type-options': 'nosniff',
    })
  })

  /** Once a day (see vercel.json): previews no memory uses anymore are deleted. */
  app.get('/cron/tidy', async (c) => {
    if (!cronSecret || c.req.header('authorization') !== `Bearer ${cronSecret}`) {
      throw new AppError(401, 'unauthorized')
    }
    return c.json(await tidyPhotos(db))
  })

  app.post('/sync', sameOrigin, signedIn, async (c) => {
    const userId = c.get('userId')
    const body = syncRequest.parse(await c.req.json())
    const state = await spaceState(db, userId)
    if (!state) throw new AppError(409, 'no-space')
    // While unlinked nothing comes or goes; the phone keeps what it has until you relink.
    if (state.status === 'paused') throw new AppError(409, 'paused')
    if (body.mutations.length) {
      await db.transaction((tx) => applyMutations(tx, userId, state.spaceId, body.mutations))
    }
    // A device that comes from another space (it just joined its partner) starts from scratch.
    const since = body.spaceId && body.spaceId !== state.spaceId ? 0 : body.since
    return c.json(await pull(db, userId, state.spaceId, since))
  })

  return app
}
