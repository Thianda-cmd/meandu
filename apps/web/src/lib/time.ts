import { Temporal } from '@meandu/core'
import { useEffect, useState } from 'react'

export const zone = Temporal.Now.timeZoneId()

export function todayDate(): Temporal.PlainDate {
  return Temporal.Now.plainDateISO(zone)
}

/** Today's date, updated at midnight and whenever the app comes back to the foreground. */
export function useToday(): Temporal.PlainDate {
  const [today, setToday] = useState(todayDate)

  useEffect(() => {
    const refresh = () =>
      setToday((previous) => {
        const next = todayDate()
        return next.equals(previous) ? previous : next
      })

    let timer = 0
    const schedule = () => {
      const now = Temporal.Now.zonedDateTimeISO(zone)
      const midnight = now.toPlainDate().add({ days: 1 }).toZonedDateTime(zone)
      timer = window.setTimeout(
        () => {
          refresh()
          schedule()
        },
        midnight.epochMilliseconds - now.epochMilliseconds + 500,
      )
    }
    schedule()

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return today
}

export type DayPart = 'morning' | 'day' | 'evening' | 'night'

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 18) return 'day'
  if (hour >= 18 && hour < 23) return 'evening'
  return 'night'
}
