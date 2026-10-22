/** Shared spring presets, so every movement in the app feels related. */

/** Screens sliding in and out: no overshoot, like iOS navigation. */
export const STACK_SPRING = { type: 'spring', bounce: 0, visualDuration: 0.4 } as const

/** Sheets: a touch of softness on arrival. */
export const SHEET_SPRING = { type: 'spring', bounce: 0.1, visualDuration: 0.42 } as const

/** Small UI pieces (pills, toggles, toasts): quick with a little bounce. */
export const SNAPPY = { type: 'spring', bounce: 0.25, visualDuration: 0.3 } as const

/** Playful moments (hearts, celebrations). */
export const BOUNCY = { type: 'spring', bounce: 0.5, visualDuration: 0.5 } as const
