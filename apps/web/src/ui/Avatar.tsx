import type { CSSProperties } from 'react'
import { cx } from '../lib/cx'
import { toneStyle } from '../lib/tone'
import { useMe, usePartner } from '../state/data'
import type { Person } from '../state/types'

export function Avatar({
  person,
  size = 28,
  className,
  style,
}: {
  person: Person
  size?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      role="img"
      aria-label={person.name}
      style={{
        ...toneStyle(person.tone),
        width: size,
        height: size,
        fontSize: size * 0.44,
        ...style,
      }}
      className={cx(
        'inline-grid shrink-0 place-items-center rounded-full bg-tone font-display font-extrabold leading-none text-white',
        className,
      )}
    >
      {person.name.trim().slice(0, 1).toUpperCase() || '?'}
    </span>
  )
}

/** The empty seat for your person, until they join. */
export function PendingAvatar({
  size = 28,
  className,
  style,
}: {
  size?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, ...style }}
      className={cx(
        'inline-block shrink-0 rounded-full border-2 border-dashed border-ink-3/60 bg-canvas',
        className,
      )}
    />
  )
}

/** The two of you, slightly overlapping. */
export function CoupleAvatars({ size = 28 }: { size?: number }) {
  const me = useMe()
  const partner = usePartner()
  const overlap = { marginLeft: -size / 3 }
  return (
    <span className="inline-flex shrink-0 items-center">
      <Avatar person={me} size={size} className="ring-2 ring-canvas" />
      {partner ? (
        <Avatar person={partner} size={size} className="ring-2 ring-canvas" style={overlap} />
      ) : (
        <PendingAvatar size={size} className="ring-2 ring-canvas" style={overlap} />
      )}
    </span>
  )
}

/** Shows who something is for: one avatar, or both for "us". */
export function WhoBadge({ forUserId, size = 24 }: { forUserId: string | null; size?: number }) {
  const me = useMe()
  const partner = usePartner()
  if (forUserId === null) return <CoupleAvatars size={size} />
  if (forUserId === me.id) return <Avatar person={me} size={size} />
  return partner ? <Avatar person={partner} size={size} /> : <PendingAvatar size={size} />
}
