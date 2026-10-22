import { daysBetween } from './dates'
import type { Temporal } from './temporal'

/** Days together, counting the first day as day 1. */
export function dayCount(since: Temporal.PlainDate, today: Temporal.PlainDate): number {
  return daysBetween(since, today) + 1
}

/** Couples celebrate every 100 days for the first years, then every 1,000. */
function milestoneStep(count: number): number {
  return count <= 3000 ? 100 : 1000
}

/** The next round number of days worth celebrating (today's, if today is one). */
export function nextMilestone(count: number): number {
  const step = milestoneStep(count)
  return Math.max(100, Math.ceil(count / step) * step)
}

/** The milestone before `milestone`, for showing progress towards it. */
export function previousMilestone(milestone: number): number {
  return Math.max(0, milestone - milestoneStep(milestone))
}
