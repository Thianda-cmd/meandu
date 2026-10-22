import type { AccountInfo } from '@meandu/core'
import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { isRealEmail } from './auth.js'
import type { Db } from './db.js'
import { members, passkey, records, spaces, user, verification } from './schema.js'
import { resume } from './space.js'
import { nextVersion } from './sync.js'

/** How someone can get back into their account: a confirmed email and their passkeys. */
export async function accountInfo(db: Db, userId: string): Promise<AccountInfo> {
  const [me] = await db.select().from(user).where(eq(user.id, userId))
  const keys = await db
    .select({ id: passkey.id, name: passkey.name, createdAt: passkey.createdAt })
    .from(passkey)
    .where(eq(passkey.userId, userId))
    .orderBy(asc(passkey.createdAt))
  const email = me && isRealEmail(me.email, me.emailVerified) ? me.email : null
  return {
    email,
    passkeys: keys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString() })),
    protected: Boolean(email || keys.length),
  }
}

/**
 * Deletes an account for good. Alone in a space, the space goes with it. With a partner,
 * they keep what you shared; your name and your private plans are erased, and a paused
 * space opens up again for them, since there's no one left to relink with.
 */
export async function deleteAccount(db: Db, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [me] = await tx.select().from(user).where(eq(user.id, userId))
    if (!me) return
    const [membership] = await tx.select().from(members).where(eq(members.userId, userId))

    if (membership) {
      const { spaceId } = membership
      const others = await tx
        .select()
        .from(members)
        .where(and(eq(members.spaceId, spaceId), ne(members.userId, userId)))

      if (others.length === 0) {
        await tx.delete(spaces).where(eq(spaces.id, spaceId))
      } else {
        const version = await nextVersion(tx, spaceId)
        // The profile is emptied, not just hidden, and your person's phone removes it.
        await tx
          .update(records)
          .set({ data: {}, deletedAt: sql`now()`, version, updatedAt: sql`now()` })
          .where(
            and(eq(records.spaceId, spaceId), eq(records.kind, 'person'), eq(records.id, userId)),
          )
        // Only you ever saw these.
        await tx
          .delete(records)
          .where(
            and(
              eq(records.spaceId, spaceId),
              eq(records.private, true),
              eq(records.createdBy, userId),
            ),
          )
        const [space] = await tx.select().from(spaces).where(eq(spaces.id, spaceId))
        if (space?.status === 'paused') await resume(tx, spaceId)
      }
    }

    // Codes still waiting to be typed in (Better Auth keys them by type and address).
    await tx
      .delete(verification)
      .where(
        sql`${verification.identifier} = ${`sign-in-otp-${me.email}`} or starts_with(${verification.identifier}, ${`change-email-otp-${me.email}-`})`,
      )
    // Sessions, sign-ins, passkeys and the membership go with the user.
    await tx.delete(user).where(eq(user.id, userId))
  })
}
