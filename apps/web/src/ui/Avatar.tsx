import type { CSSProperties } from 'react'
import { cx } from '../lib/cx'
import { toneStyle } from '../lib/tone'
import { useData } from '../state/data'
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

/** The two of you, slightly overlapping. */
export function CoupleAvatars({ size = 28 }: { size?: number }) {
  const me = useData((s) => s.me)
  const partner = useData((s) => s.partner)
  return (
    <span className="inline-flex shrink-0 items-center">
      <Avatar person={me} size={size} className="ring-2 ring-canvas" />
      <Avatar
        person={partner}
        size={size}
        className="ring-2 ring-canvas"
        style={{ marginLeft: -size / 3 }}
      />
    </span>
  )
}

/** Shows who something is for: one avatar, or both for "us". */
export function WhoBadge({ forUserId, size = 24 }: { forUserId: string | null; size?: number }) {
  const me = useData((s) => s.me)
  const partner = useData((s) => s.partner)
  if (forUserId === null) return <CoupleAvatars size={size} />
  return <Avatar person={forUserId === me.id ? me : partner} size={size} />
}
