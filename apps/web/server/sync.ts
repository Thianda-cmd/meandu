import type { Mutation, RemoteRecord, SyncResponse } from '@meandu/core'
import { and, asc, eq, gt, lte, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from './db.js'
import { AppError } from './errors.js'
import { records, spaces } from './schema.js'

const KINDS = ['event', 'list', 'item', 'memory', 'person', 'settings'] as const
/** Largest JSON document a single record may hold. */
const MAX_RECORD_BYTES = 16_000
/** Records per pull; a push carries at most 500, so a page always moves forward. */
const PAGE = 1000

export const syncRequest = z.object({
  since: z.number().int().min(0),
  mutations: z
    .array(
      z.object({
        kind: z.enum(KINDS),
        id: z.string().min(1).max(80),
        op: z.enum(['put', 'delete']),
        data: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(500),
})

export const settingsId = (spaceId: string) => `settings:${spaceId}`

/**
 * Takes the space's next version. The update locks the space row until the transaction
 * commits, so versions within a space are committed strictly in order and a device that
 * pulls "everything after N" can never skip a change.
 */
export async function nextVersion(tx: Db, spaceId: string): Promise<number> {
  const [row] = await tx
    .update(spaces)
    .set({ version: sql`${spaces.version} + 1`, updatedAt: sql`now()` })
    .where(eq(spaces.id, spaceId))
    .returning({ version: spaces.version })
  if (!row) throw new AppError(404, 'no-space')
  return row.version
}

function permitted(m: Mutation, userId: string, spaceId: string): boolean {
  if (m.kind === 'person') return m.id === userId
  if (m.kind === 'settings') return m.id === settingsId(spaceId)
  return true
}

/** Applies a device's changes. Call inside a transaction. */
export async function applyMutations(
  tx: Db,
  userId: string,
  spaceId: string,
  mutations: Mutation[],
): Promise<void> {
  if (mutations.length === 0) return
  const version = await nextVersion(tx, spaceId)
  // Only things you can see can be changed: shared ones, or your own private ones.
  const visible = or(eq(records.private, false), eq(records.createdBy, userId))

  for (const m of mutations) {
    if (!permitted(m, userId, spaceId)) continue
    const target = and(eq(records.spaceId, spaceId), eq(records.kind, m.kind), visible)

    if (m.op === 'delete') {
      await tx
        .update(records)
        .set({ deletedAt: sql`now()`, version, updatedAt: sql`now()` })
        .where(and(eq(records.id, m.id), target))
      continue
    }

    const data = m.data ?? {}
    if (JSON.stringify(data).length > MAX_RECORD_BYTES) continue
    const isPrivate =
      m.kind === 'event' && 'visibility' in data ? data.visibility === 'private' : undefined

    await tx
      .insert(records)
      .values({
        id: m.id,
        spaceId,
        kind: m.kind,
        data,
        version,
        createdBy: userId,
        private: isPrivate ?? false,
      })
      .onConflictDoUpdate({
        target: records.id,
        set: {
          // Shallow merge: fields sent win, untouched fields stay.
          data: sql`${records.data} || excluded.data`,
          version,
          deletedAt: null,
          updatedAt: sql`now()`,
          // Only whoever made an event can make it private or shared again.
          ...(isPrivate === undefined
            ? {}
            : {
                private: sql`case when ${records.createdBy} = ${userId} then excluded.private else ${records.private} end`,
              }),
        },
        setWhere: target,
      })
  }
}

const columns = {
  id: records.id,
  kind: records.kind,
  data: records.data,
  version: records.version,
  deletedAt: records.deletedAt,
  private: records.private,
  createdBy: records.createdBy,
}

/** Everything that changed after `since`, as this person is allowed to see it. */
export async function pull(
  db: Db,
  userId: string,
  spaceId: string,
  since: number,
): Promise<SyncResponse> {
  const [space] = await db
    .select({ version: spaces.version })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
  if (!space) throw new AppError(404, 'no-space')
  const head = space.version

  const inRange = (from: number) =>
    and(eq(records.spaceId, spaceId), gt(records.version, from), lte(records.version, head))

  let rows = await db
    .select(columns)
    .from(records)
    .where(inRange(since))
    .orderBy(asc(records.version))
    .limit(PAGE + 1)

  let more = false
  let cursor = head
  const last = rows[PAGE - 1]
  if (rows.length > PAGE && last) {
    more = true
    const complete = rows.filter((r) => r.version < last.version)
    if (complete.length > 0) {
      rows = complete
      cursor = last.version - 1
    } else {
      // One very large change (e.g. moving into a partner's space): send it whole.
      rows = await db
        .select(columns)
        .from(records)
        .where(and(eq(records.spaceId, spaceId), eq(records.version, last.version)))
      cursor = last.version
    }
  }

  const out: RemoteRecord[] = rows.map((r) =>
    r.deletedAt || (r.private && r.createdBy !== userId)
      ? { kind: r.kind as RemoteRecord['kind'], id: r.id, deleted: true }
      : { kind: r.kind as RemoteRecord['kind'], id: r.id, data: r.data, deleted: false },
  )

  return { spaceId, version: cursor, records: out, more }
}
