import { and, eq, isNotNull, isNull, lt, not, sql } from 'drizzle-orm'
import type { Db } from './db.js'
import { AppError } from './errors.js'
import { members, photos, records, spaces } from './schema.js'

/** A preview is about 100 KB; this leaves plenty of room without inviting misuse. */
export const MAX_PHOTO_BYTES = 600_000
const PER_SPACE = 3000
/** Photo ids are UUIDv7s made on the phone. */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** What the bytes are, going by how they start. Only JPEG and WebP are kept. */
function imageType(bytes: Uint8Array): 'image/jpeg' | 'image/webp' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  const text = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'image/webp'
  return null
}

/** Your space, while it's in use (not while unlinked). */
async function activeSpace(db: Db, userId: string): Promise<string> {
  const [row] = await db
    .select({ id: spaces.id, status: spaces.status })
    .from(members)
    .innerJoin(spaces, eq(spaces.id, members.spaceId))
    .where(eq(members.userId, userId))
  if (!row) throw new AppError(409, 'no-space')
  if (row.status === 'paused') throw new AppError(409, 'paused')
  return row.id
}

/** Keeps a photo's preview. Sending the same one again changes nothing. */
export async function savePhoto(db: Db, userId: string, id: string, bytes: Uint8Array) {
  if (!ID.test(id)) throw new AppError(400, 'invalid')
  if (bytes.byteLength > MAX_PHOTO_BYTES) throw new AppError(413, 'too-big')
  const type = imageType(bytes)
  if (!type) throw new AppError(415, 'not-an-image')
  const spaceId = await activeSpace(db, userId)
  const [stored] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(photos)
    .where(eq(photos.spaceId, spaceId))
  if ((stored?.count ?? 0) >= PER_SPACE) throw new AppError(409, 'too-many')
  await db
    .insert(photos)
    .values({ id, spaceId, type, bytes, size: bytes.byteLength, createdBy: userId })
    .onConflictDoNothing()
}

/** A preview from your own space. */
export async function loadPhoto(db: Db, userId: string, id: string) {
  const spaceId = await activeSpace(db, userId)
  const [photo] = await db
    .select({ type: photos.type, bytes: photos.bytes })
    .from(photos)
    .where(and(eq(photos.id, id), eq(photos.spaceId, spaceId)))
  if (!photo) throw new AppError(404, 'not-found')
  return photo
}

/**
 * Deletes previews no memory has used for a day. The day gives an undo, or a memory that
 * syncs after its photos were sent, time to claim them. Runs once a day.
 */
export async function tidyPhotos(db: Db): Promise<{ deleted: number }> {
  const used = sql`exists (
    select 1 from ${records} r
    where r.space_id = ${photos.spaceId}
      and r.kind = 'memory'
      and r.deleted_at is null
      and jsonb_typeof(r.data->'photos') = 'array'
      and r.data->'photos' @> jsonb_build_array(jsonb_build_object('id', ${photos.id}))
  )`
  await db
    .update(photos)
    .set({ orphanedAt: null })
    .where(and(isNotNull(photos.orphanedAt), used))
  await db
    .update(photos)
    .set({ orphanedAt: sql`now()` })
    .where(and(isNull(photos.orphanedAt), not(used)))
  const deleted = await db
    .delete(photos)
    .where(lt(photos.orphanedAt, sql`now() - interval '1 day'`))
    .returning({ id: photos.id })
  return { deleted: deleted.length }
}
