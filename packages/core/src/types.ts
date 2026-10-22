export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export type EventKind = 'event' | 'birthday' | 'anniversary'

export interface EventBase {
  id: string
  title: string
  emoji?: string
  notes?: string
  location?: string
  /** The partner this is for; `null` means both of us. */
  forUserId: string | null
  visibility: 'shared' | 'private'
  kind: EventKind
  repeat: Repeat
  /** Last day a repeating event may start on (ISO date, inclusive). */
  repeatUntil?: string
  isCountdown: boolean
  createdBy: string
  createdAt: string
}

export interface TimedEvent extends EventBase {
  allDay: false
  /** ISO instant */
  start: string
  /** ISO instant */
  end: string
  /** IANA time zone the event was planned in; repeats keep its wall-clock time. */
  timeZone: string
}

export interface AllDayEvent extends EventBase {
  allDay: true
  /** ISO date, inclusive */
  startDate: string
  /** ISO date, exclusive */
  endDate: string
}

export type CalendarEvent = TimedEvent | AllDayEvent
