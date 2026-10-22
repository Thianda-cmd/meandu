import type { CSSProperties } from 'react'
import { useMe, usePartner } from '../state/data'
import type { Person, Tone } from '../state/types'

export type ToneName = Tone | 'lilac'

/** Sets the `tone` colours for everything inside, so components can use bg-tone-soft etc. */
export function toneStyle(tone: ToneName): CSSProperties {
  return {
    '--tone': `var(--${tone})`,
    '--tone-ink': `var(--${tone}-ink)`,
    '--tone-soft': `var(--${tone}-soft)`,
  } as CSSProperties
}

/** Who something is for decides its colour: mine, my person's, or ours (lilac). */
export function toneFor(forUserId: string | null, me: Person, partner: Person | null): ToneName {
  if (forUserId === null) return 'lilac'
  if (forUserId === me.id) return me.tone
  return partner?.tone ?? 'lilac'
}

export function useToneFor(forUserId: string | null): ToneName {
  return toneFor(forUserId, useMe(), usePartner())
}
