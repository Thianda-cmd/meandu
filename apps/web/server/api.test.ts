import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import type { Mutation, RemoteRecord } from '@meandu/core'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { createAuth } from './auth'
import type { Email } from './email'
import * as schema from './schema'

const ORIGIN = 'http://localhost:4173'
let app: ReturnType<typeof createApp>
let db: ReturnType<typeof drizzle<typeof schema>>
const inbox: Email[] = []

beforeAll(async () => {
  db = drizzle({ client: new PGlite(), schema })
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
  app = createApp({
    db,
    auth: createAuth(db, {
      secret: 'test-secret-that-is-long-enough-32',
      rateLimit: false,
      sendEmail: async (email) => void inbox.push(email),
      passkeys: { rpID: 'localhost', origins: [ORIGIN] },
    }),
    emailSignIn: true,
  })
}, 30_000)

/** The code in the last email sent to this address. */
function codeFor(to: string): string {
  const email = inbox.findLast((e) => e.to === to)
  const code = email?.text.match(/\b\d{6}\b/)?.[0]
  if (!code) throw new Error(`no code for ${to}`)
  return code
}

/** One phone: keeps its cookies between requests, like a browser would. */
class Device {
  private cookies = new Map<string, string>()

  async request(
    path: string,
    body?: unknown,
    origin = ORIGIN,
    headers: Record<string, string> = {},
  ) {
    const res = await app.request(`${ORIGIN}/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...headers,
        origin,
        'content-type': 'application/json',
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    for (const line of res.headers.getSetCookie()) {
      const [pair = ''] = line.split(';')
      const index = pair.indexOf('=')
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1))
    }
    // biome-ignore lint/suspicious/noExplicitAny: responses are checked field by field below
    return { status: res.status, json: (await res.json().catch(() => null)) as any }
  }

  async signIn(): Promise<string> {
    const res = await this.request('/auth/sign-in/anonymous', {})
    expect(res.status).toBe(200)
    return res.json.user.id
  }

  async sync(since: number, mutations: Mutation[] = []) {
    const res = await this.request('/sync', { since, mutations })
    expect(res.status).toBe(200)
    return res.json as { version: number; records: RemoteRecord[]; more: boolean; spaceId: string }
  }
}

const event = (id: string, data: Record<string, unknown>): Mutation => ({
  kind: 'event',
  id,
  op: 'put',
  data,
})

describe('api', () => {
  it('reports the database as healthy', async () => {
    const res = await new Device().request('/health')
    expect(res.status).toBe(200)
    expect(res.json.ok).toBe(true)
  })

  it('refuses to sync when signed out', async () => {
    const res = await new Device().request('/sync', { since: 0, mutations: [] })
    expect(res.status).toBe(401)
  })

  it('refuses requests from other sites', async () => {
    const phone = new Device()
    await phone.signIn()
    const res = await phone.request('/space', { name: 'X', tone: 'coral' }, 'https://evil.example')
    expect(res.status).toBe(403)
  })

  it('accepts the public address a proxy forwards', async () => {
    const phone = new Device()
    await phone.signIn()
    const res = await phone.request(
      '/space',
      { name: 'P', tone: 'coral' },
      'https://couple.example',
      { 'x-forwarded-host': 'couple.example' },
    )
    expect(res.status).toBe(200)
  })

  it('creates a space and syncs changes both ways', async () => {
    const phone = new Device()
    const me = await phone.signIn()
    const created = await phone.request('/space', {
      name: 'Mikolaj',
      tone: 'coral',
      togetherSince: '2023-05-12',
    })
    expect(created.status).toBe(200)
    expect(created.json.members).toEqual([{ userId: me, role: 'owner' }])

    const first = await phone.sync(0)
    expect(first.records.map((r) => r.kind).sort()).toEqual(['person', 'settings'])

    const second = await phone.sync(first.version, [
      event('e1', { title: 'Dinner', notes: 'Luigi' }),
    ])
    expect(second.records).toEqual([
      { kind: 'event', id: 'e1', data: { title: 'Dinner', notes: 'Luigi' }, deleted: false },
    ])
    expect(second.version).toBeGreaterThan(first.version)

    // Partial updates merge, untouched fields stay.
    const third = await phone.sync(second.version, [event('e1', { title: 'Dinner 🍝' })])
    expect(third.records[0]?.data).toEqual({ title: 'Dinner 🍝', notes: 'Luigi' })

    // Deleting leaves a tombstone; putting it back (undo) restores it.
    const deleted = await phone.sync(third.version, [{ kind: 'event', id: 'e1', op: 'delete' }])
    expect(deleted.records).toEqual([{ kind: 'event', id: 'e1', deleted: true }])
    const restored = await phone.sync(deleted.version, [event('e1', { title: 'Dinner 🍝' })])
    expect(restored.records[0]?.deleted).toBe(false)
  })

  it('pairs two phones with an invite code and keeps private things private', async () => {
    const mine = new Device()
    const yours = new Device()
    const me = await mine.signIn()
    const you = await yours.signIn()
    await mine.request('/space', { name: 'Mikolaj', tone: 'coral' })
    await mine.sync(0, [
      event('shared', { title: 'Movie night', visibility: 'shared' }),
      event('secret', { title: 'Surprise gift', visibility: 'private' }),
    ])

    const invite = await mine.request('/space/invite', {})
    expect(invite.status).toBe(200)
    expect(invite.json.code).toMatch(/^[A-Z2-9]{6}$/)

    const bad = await yours.request('/space/join', { code: 'XXXXXX', name: 'Alex', tone: 'sage' })
    expect(bad.status).toBe(404)
    expect(bad.json.error).toBe('bad-code')

    const formatted = `${invite.json.code.slice(0, 3)}-${invite.json.code.slice(3).toLowerCase()}`
    const joined = await yours.request('/space/join', {
      code: formatted,
      name: 'Alex',
      tone: 'sage',
    })
    expect(joined.status).toBe(200)
    expect(joined.json.members.map((m: { userId: string }) => m.userId)).toEqual([me, you])

    // The partner sees shared things and both profiles, but never the private event.
    const theirs = await yours.sync(0)
    const byId = new Map(theirs.records.map((r) => [r.id, r]))
    expect(byId.get('shared')?.data?.title).toBe('Movie night')
    expect(byId.get('secret')).toEqual({ kind: 'event', id: 'secret', deleted: true })
    expect(byId.get(me)?.data).toEqual({ name: 'Mikolaj', tone: 'coral' })
    expect(byId.get(you)?.data).toEqual({ name: 'Alex', tone: 'sage' })

    // They can't change someone else's private event or profile.
    const attempt = await yours.sync(theirs.version, [
      event('secret', { title: 'Peeked' }),
      { kind: 'person', id: me, op: 'put', data: { name: 'Hacked' } },
    ])
    expect(attempt.records).toEqual([])
    const check = await mine.sync(0)
    const mineById = new Map(check.records.map((r) => [r.id, r]))
    expect(mineById.get('secret')?.data?.title).toBe('Surprise gift')
    expect(mineById.get(me)?.data?.name).toBe('Mikolaj')

    // Making it shared later shows it to the partner.
    const reveal = await mine.sync(check.version, [event('secret', { visibility: 'shared' })])
    expect(reveal.records[0]?.deleted).toBe(false)
    const after = await yours.sync(attempt.version)
    expect(after.records.find((r) => r.id === 'secret')?.data?.title).toBe('Surprise gift')

    // A full space takes no more invites.
    const third = await mine.request('/space/invite', {})
    expect(third.status).toBe(409)
  })

  it('brings solo plans along when joining a partner', async () => {
    const mine = new Device()
    const yours = new Device()
    await mine.signIn()
    await yours.signIn()
    await mine.request('/space', { name: 'A', tone: 'coral' })
    await yours.request('/space', { name: 'B', tone: 'sage' })
    await yours.sync(0, [event('solo', { title: 'Dentist' })])

    const { json } = await mine.request('/space/invite', {})
    const joined = await yours.request('/space/join', { code: json.code, name: 'B', tone: 'sage' })
    expect(joined.status).toBe(200)

    const seen = await mine.sync(0)
    expect(seen.records.find((r) => r.id === 'solo')?.data?.title).toBe('Dentist')
  })

  it('sends everything again to a phone that just moved to another space', async () => {
    const mine = new Device()
    const yours = new Device()
    await mine.signIn()
    await yours.signIn()
    await mine.request('/space', { name: 'A', tone: 'coral' })
    await mine.sync(0, [event('ours', { title: 'Dinner' })])
    const solo = await yours.request('/space', { name: 'B', tone: 'sage' })
    const before = await yours.sync(0)

    const { json } = await mine.request('/space/invite', {})
    await yours.request('/space/join', { code: json.code, name: 'B', tone: 'sage' })

    // The phone still thinks it's in its old space, at a version past the new space's start.
    const res = await yours.request('/sync', {
      since: before.version + 100,
      spaceId: solo.json.spaceId,
      mutations: [],
    })
    expect(res.json.spaceId).not.toBe(solo.json.spaceId)
    expect(res.json.records.map((r: RemoteRecord) => r.id)).toContain('ours')
  })
})

describe('accounts', () => {
  it('says whether codes can be emailed', async () => {
    const res = await new Device().request('/config')
    expect(res.json).toEqual({ email: true })
  })

  it('protects a device account with an email and signs in with it elsewhere', async () => {
    const phone = new Device()
    const me = await phone.signIn()
    await phone.request('/space', { name: 'Kim', tone: 'berry' })
    await phone.sync(0, [event('mine', { title: 'Concert' })])
    expect((await phone.request('/account')).json).toMatchObject({ email: null, protected: false })

    await phone.request('/auth/email-otp/request-email-change', { newEmail: 'Kim@Example.com' })
    const added = await phone.request('/auth/email-otp/change-email', {
      newEmail: 'kim@example.com',
      otp: codeFor('kim@example.com'),
    })
    expect(added.status).toBe(200)
    expect((await phone.request('/account')).json).toMatchObject({
      email: 'kim@example.com',
      protected: true,
    })

    // A new phone signs in with a code and finds the same account, space and plans.
    const laptop = new Device()
    await laptop.request('/auth/email-otp/send-verification-otp', {
      email: 'kim@example.com',
      type: 'sign-in',
    })
    const signedIn = await laptop.request('/auth/sign-in/email-otp', {
      email: 'kim@example.com',
      otp: codeFor('kim@example.com'),
    })
    expect(signedIn.json.user.id).toBe(me)
    const synced = await laptop.sync(0)
    expect(synced.records.map((r) => r.id)).toContain('mine')
  })

  it('never makes a new account from an unknown email', async () => {
    const before = inbox.length
    const stranger = new Device()
    const sent = await stranger.request('/auth/email-otp/send-verification-otp', {
      email: 'nobody@example.com',
      type: 'sign-in',
    })
    expect(sent.status).toBe(200)
    expect(inbox.length).toBe(before)
    const res = await stranger.request('/auth/sign-in/email-otp', {
      email: 'nobody@example.com',
      otp: '123456',
    })
    expect(res.status).toBe(400)
  })

  it('only sends sign-in codes', async () => {
    const res = await new Device().request('/auth/email-otp/send-verification-otp', {
      email: 'kim@example.com',
      type: 'forget-password',
    })
    expect(res.status).toBe(400)
  })

  it('lets a device account renew its session, but not a protected one', async () => {
    const phone = new Device()
    await phone.signIn()
    expect((await phone.request('/auth/device/renew', {})).status).toBe(200)
    expect((await phone.request('/account')).status).toBe(200)

    await phone.request('/auth/email-otp/request-email-change', { newEmail: 'lee@example.com' })
    await phone.request('/auth/email-otp/change-email', {
      newEmail: 'lee@example.com',
      otp: codeFor('lee@example.com'),
    })
    const renewed = await phone.request('/auth/device/renew', {})
    expect(renewed.status).toBe(403)
    expect(renewed.json.code).toBe('SESSION_NOT_FRESH')
  })

  it('asks a protected account to sign in again before changing its email', async () => {
    const phone = new Device()
    const me = await phone.signIn()
    await phone.request('/auth/email-otp/request-email-change', { newEmail: 'ana@example.com' })
    await phone.request('/auth/email-otp/change-email', {
      newEmail: 'ana@example.com',
      otp: codeFor('ana@example.com'),
    })
    // The session is two days old now.
    await db
      .update(schema.session)
      .set({ createdAt: sql`now() - interval '2 days'` })
      .where(eq(schema.session.userId, me))
    const res = await phone.request('/auth/email-otp/request-email-change', {
      newEmail: 'ana2@example.com',
    })
    expect(res.status).toBe(403)
    expect(res.json.code).toBe('SESSION_NOT_FRESH')
  })

  it('prepares a passkey for a device account', async () => {
    const phone = new Device()
    await phone.signIn()
    const res = await phone.request('/auth/passkey/generate-register-options?name=Kim')
    expect(res.status).toBe(200)
    expect(res.json.rp).toEqual({ name: 'meandu', id: 'localhost' })
    expect(res.json.user.name).toBe('Kim')
    expect(res.json.authenticatorSelection.residentKey).toBe('required')
  })
})
