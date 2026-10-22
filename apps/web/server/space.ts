import type { InviteInfo, SpaceState } from '@meandu/core'
import { and, asc, eq, gt, isNull, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from './db.js'
import { AppError } from './errors.js'
import { invites, members, rateLimit, records, spaces } from './schema.js'
import { applyMutations, nextVersion, settingsId } from './sync.js'

const TONES = ['coral', 'sage', 'honey', 'bay', 'berry'] as const
const INVITE_DAYS = 7
/** No 0/O or 1/I/L, so codes survive being read out loud. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const profile = z.object({
  name: z.string().trim().min(1).max(40),
  tone: z.enum(TONES),
})

export const createSpaceInput = profile.extend({
  togetherSince: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
})

export const joinInput = profile.extend({ code: z.string().min(4).max(20) })

export function newInviteCode(): string {
  let code = ''
  while (code.length < 6) {
    const [byte = 255] = crypto.getRandomValues(new Uint8Array(1))
    // Skip bytes past the last full multiple of the alphabet so every letter is equally likely.
    if (byte < 248) code += ALPHABET[byte % ALPHABET.length]
  }
  return code
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

async function membershipOf(db: Db, userId: string) {
  const [row] = await db.select().from(members).where(eq(members.userId, userId))
  return row
}

export async function spaceState(db: Db, userId: string): Promise<SpaceState | null> {
  const membership = await membershipOf(db, userId)
  if (!membership) return null
  const [space] = await db.select().from(spaces).where(eq(spaces.id, membership.spaceId))
  if (!space) return null
  const people = await db
    .select({ userId: members.userId, role: members.role, wantsBack: members.wantsBack })
    .from(members)
    .where(eq(members.spaceId, space.id))
    .orderBy(asc(members.joinedAt))
  const paused = space.status === 'paused'
  return {
    spaceId: space.id,
    userId,
    status: paused ? 'paused' : 'active',
    members: people.map((p) => ({
      userId: p.userId,
      role: p.role === 'owner' ? 'owner' : 'member',
    })),
    pausedBy: paused ? space.pausedBy : null,
    wantsBack: paused ? people.filter((p) => p.wantsBack).map((p) => p.userId) : [],
  }
}

/** The space you're in, or a 409 when there's none. */
async function stateOf(db: Db, userId: string): Promise<SpaceState> {
  const state = await spaceState(db, userId)
  if (!state) throw new AppError(409, 'no-space')
  return state
}

/** Pauses the space for both of you. Nothing is deleted; relinking brings it all back. */
export async function unlink(db: Db, userId: string): Promise<SpaceState> {
  const state = await stateOf(db, userId)
  if (state.status === 'paused') return state
  if (state.members.length < 2) throw new AppError(409, 'not-paired')
  await db.transaction(async (tx) => {
    await tx
      .update(spaces)
      .set({ status: 'paused', pausedBy: userId, pausedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(spaces.id, state.spaceId))
    await tx.update(members).set({ wantsBack: false }).where(eq(members.spaceId, state.spaceId))
  })
  return stateOf(db, userId)
}

/** You'd like to relink. Once both of you do, the space is back. */
export async function relink(db: Db, userId: string): Promise<SpaceState> {
  const state = await stateOf(db, userId)
  if (state.status === 'active') return state
  await db.transaction(async (tx) => {
    // Locks the space, so two "yes"es at the same moment can't miss each other.
    await tx.select().from(spaces).where(eq(spaces.id, state.spaceId)).for('update')
    await tx.update(members).set({ wantsBack: true }).where(eq(members.userId, userId))
    const people = await tx.select().from(members).where(eq(members.spaceId, state.spaceId))
    if (people.every((p) => p.wantsBack)) await resume(tx, state.spaceId)
  })
  return stateOf(db, userId)
}

/** Back to normal after a pause. */
export async function resume(tx: Db, spaceId: string): Promise<void> {
  await tx
    .update(spaces)
    .set({ status: 'active', pausedBy: null, pausedAt: null, updatedAt: sql`now()` })
    .where(eq(spaces.id, spaceId))
  await tx.update(members).set({ wantsBack: false }).where(eq(members.spaceId, spaceId))
}

/**
 * Deletes the space and everything in it, for both of you. Either of you may, once it's
 * paused; a space you share and use together can't be deleted by one of you alone.
 */
export async function deleteSpace(db: Db, userId: string): Promise<void> {
  const state = await stateOf(db, userId)
  if (state.status === 'active' && state.members.length > 1) throw new AppError(409, 'paired')
  // Members, invites and records go with it.
  await db.delete(spaces).where(eq(spaces.id, state.spaceId))
}

export async function createSpace(
  db: Db,
  userId: string,
  input: z.infer<typeof createSpaceInput>,
): Promise<SpaceState> {
  const existing = await spaceState(db, userId)
  if (existing) return existing

  const spaceId = crypto.randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(spaces).values({ id: spaceId })
    await tx.insert(members).values({ userId, spaceId, role: 'owner' })
    await applyMutations(tx, userId, spaceId, [
      { kind: 'person', id: userId, op: 'put', data: { name: input.name, tone: input.tone } },
      {
        kind: 'settings',
        id: settingsId(spaceId),
        op: 'put',
        data: { togetherSince: input.togetherSince ?? null },
      },
    ])
  })
  const state = await spaceState(db, userId)
  if (!state) throw new AppError(404, 'no-space')
  return state
}

export async function inviteFor(db: Db, userId: string): Promise<InviteInfo> {
  const membership = await membershipOf(db, userId)
  if (!membership) throw new AppError(409, 'no-space')
  const [space] = await db.select().from(spaces).where(eq(spaces.id, membership.spaceId))
  if (space?.status === 'paused') throw new AppError(409, 'paused')
  const people = await db.select().from(members).where(eq(members.spaceId, membership.spaceId))
  if (people.length >= 2) throw new AppError(409, 'full')

  const [active] = await db
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.spaceId, membership.spaceId),
        isNull(invites.usedBy),
        gt(invites.expiresAt, sql`now()`),
      ),
    )
    .limit(1)
  if (active) return { code: active.code, expiresAt: active.expiresAt.toISOString() }

  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newInviteCode()
    const inserted = await db
      .insert(invites)
      .values({ code, spaceId: membership.spaceId, createdBy: userId, expiresAt })
      .onConflictDoNothing()
      .returning({ code: invites.code })
    if (inserted.length) return { code, expiresAt: expiresAt.toISOString() }
  }
  throw new Error('could not create an invite code')
}

/** At most `max` tries per `windowMs` per key, shared across server instances. */
async function limit(db: Db, key: string, max: number, windowMs: number): Promise<void> {
  const now = Date.now()
  const [row] = await db
    .insert(rateLimit)
    .values({ id: key, key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${rateLimit.lastRequest} < ${now - windowMs} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: now,
      },
    })
    .returning({ count: rateLimit.count })
  if (row && row.count > max) throw new AppError(429, 'slow-down')
}

export async function joinSpace(
  db: Db,
  userId: string,
  input: z.infer<typeof joinInput>,
): Promise<SpaceState> {
  const code = normalizeCode(input.code)
  await limit(db, `join:${userId}`, 10, 10 * 60 * 1000)

  await db.transaction(async (tx) => {
    const [invite] = await tx.select().from(invites).where(eq(invites.code, code)).for('update')
    if (!invite || invite.usedBy || invite.expiresAt.getTime() < Date.now()) {
      throw new AppError(404, 'bad-code')
    }
    const target = invite.spaceId
    const current = await membershipOf(tx, userId)
    if (current?.spaceId === target) return

    const people = await tx.select().from(members).where(eq(members.spaceId, target))
    if (people.length >= 2) throw new AppError(409, 'full')

    if (current) {
      const others = await tx
        .select()
        .from(members)
        .where(and(eq(members.spaceId, current.spaceId), ne(members.userId, userId)))
      if (others.length) throw new AppError(409, 'already-paired')
      // Bring along everything made before joining (but not the old space's settings).
      const version = await nextVersion(tx, target)
      await tx
        .update(records)
        .set({ spaceId: target, version })
        .where(and(eq(records.spaceId, current.spaceId), ne(records.kind, 'settings')))
      await tx.delete(members).where(eq(members.userId, userId))
      await tx.delete(spaces).where(eq(spaces.id, current.spaceId))
    }

    await tx.insert(members).values({ userId, spaceId: target, role: 'member' })
    await tx
      .update(invites)
      .set({ usedBy: userId, usedAt: sql`now()` })
      .where(eq(invites.code, code))
    await applyMutations(tx, userId, target, [
      { kind: 'person', id: userId, op: 'put', data: { name: input.name, tone: input.tone } },
    ])
  })

  const state = await spaceState(db, userId)
  if (!state) throw new AppError(404, 'no-space')
  return state
}
