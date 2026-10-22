export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * A component's default class, unless the caller's `className` already sets the same thing.
 * Two utilities for one property don't override each other by order in `class`: the one
 * later in the stylesheet wins. So a default the caller may change has to step aside.
 */
export function unless(className: string | undefined, sets: RegExp, fallback: string) {
  return className && sets.test(className) ? undefined : fallback
}
