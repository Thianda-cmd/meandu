import type { CSSProperties } from 'react'
import { useData } from '../state/data'
import type { Tone } from '../state/types'

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
export function useToneFor(forUserId: string | null): ToneName {
  const me = useData((s) => s.me)
  const partner = useData((s) => s.partner)
  if (forUserId === null) return 'lilac'
  return forUserId === me.id ? me.tone : partner.tone
}
