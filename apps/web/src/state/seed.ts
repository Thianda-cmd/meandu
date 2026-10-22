import {
  type AllDayEvent,
  type CalendarEvent,
  Temporal,
  type TimedEvent,
  uuidv7,
} from '@meandu/core'
import type { Lang } from '../i18n/locale'
import type { List, Memory, Person, Photo } from './types'

/** Demo content so the prototype feels lived-in. Everything is relative to today. */

const words = {
  en: {
    dinner: "Dinner at Luigi's",
    run: 'Morning run',
    yoga: 'Yoga',
    mumBirthday: "Mum's birthday",
    movie: 'Movie night',
    paris: 'Weekend in Paris',
    parisNote: 'Train leaves 08:12 🚄',
    anniversary: 'Our anniversary',
    hamburg: 'Alex in Hamburg',
    brunch: 'Brunch with Ana & Tom',
    climbing: 'Climbing',
    rent: 'Rent',
    alexBirthday: "Alex's birthday",
    groceries: 'Groceries',
    home: 'Home',
    ideas: 'Date ideas',
    bucket: 'Someday',
    items: {
      groceries: ['Oat milk', 'Tomatoes', 'Basil', 'Pasta', 'Parmesan', 'Coffee beans'],
      home: ['Fix the shelf', 'Call the landlord', 'Water the plants'],
      ideas: ['Pottery class', 'Sunrise hike', 'Cook something new', 'Picnic at the lake'],
      bucket: ['See the northern lights', 'Learn salsa', 'Road trip through Portugal'],
    },
    brunchNote: 'Best pancakes in town.',
    autumn: 'Autumn walk',
    lake: 'Lake day',
    firstTrip: 'Our first trip',
    movingIn: 'Moving in',
    movingInNote: 'So many boxes. So happy.',
  },
  de: {
    dinner: 'Essen bei Luigi',
    run: 'Morgenlauf',
    yoga: 'Yoga',
    mumBirthday: 'Mamas Geburtstag',
    movie: 'Filmabend',
    paris: 'Wochenende in Paris',
    parisNote: 'Zug fährt 08:12 🚄',
    anniversary: 'Unser Jahrestag',
    hamburg: 'Alex in Hamburg',
    brunch: 'Brunch mit Ana & Tom',
    climbing: 'Bouldern',
    rent: 'Miete',
    alexBirthday: 'Alex’ Geburtstag',
    groceries: 'Einkaufen',
    home: 'Zuhause',
    ideas: 'Date-Ideen',
    bucket: 'Irgendwann',
    items: {
      groceries: ['Hafermilch', 'Tomaten', 'Basilikum', 'Nudeln', 'Parmesan', 'Kaffeebohnen'],
      home: ['Regal reparieren', 'Vermieter anrufen', 'Pflanzen gießen'],
      ideas: ['Töpferkurs', 'Sonnenaufgangswanderung', 'Was Neues kochen', 'Picknick am See'],
      bucket: ['Nordlichter sehen', 'Salsa lernen', 'Roadtrip durch Portugal'],
    },
    brunchNote: 'Die besten Pancakes der Stadt.',
    autumn: 'Herbstspaziergang',
    lake: 'Seetag',
    firstTrip: 'Unsere erste Reise',
    movingIn: 'Eingezogen',
    movingInNote: 'So viele Kisten. So glücklich.',
  },
} as const

const GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#ffc2ad', '#ff7a6b'],
  ['#b8e6d6', '#5fa898'],
  ['#d6c8ff', '#8f73f0'],
  ['#ffe2a3', '#f0a55a'],
  ['#b5dcf3', '#5f8fd3'],
  ['#f9bdd5', '#d46a9a'],
]

export interface Seed {
  me: Person
  partner: Person
  togetherSince: string
  events: CalendarEvent[]
  lists: List[]
  memories: Memory[]
}

export function createSeed(lang: Lang, today: Temporal.PlainDate, zone: string): Seed {
  const w = words[lang]
  const me: Person = { id: 'u_me', name: 'Mikolaj', tone: 'coral' }
  const partner: Person = { id: 'u_partner', name: 'Alex', tone: 'sage' }
  const now = Temporal.Now.instant().toString()
  // The anniversary is a few days away, so there is something to count down to.
  const togetherSince = today.subtract({ years: 3 }).add({ days: 9 })

  const base = {
    visibility: 'shared',
    kind: 'event',
    repeat: 'none',
    isCountdown: false,
    createdBy: me.id,
    createdAt: now,
  } as const

  const timed = (
    offset: number,
    time: string,
    minutes: number,
    rest: Partial<TimedEvent> & Pick<TimedEvent, 'title' | 'forUserId'>,
  ): TimedEvent => {
    const start = today.add({ days: offset }).toZonedDateTime({
      timeZone: zone,
      plainTime: Temporal.PlainTime.from(time),
    })
    return {
      ...base,
      id: uuidv7(),
      allDay: false,
      start: start.toInstant().toString(),
      end: start.add({ minutes }).toInstant().toString(),
      timeZone: zone,
      ...rest,
    }
  }

  const allDay = (
    start: Temporal.PlainDate,
    days: number,
    rest: Partial<AllDayEvent> & Pick<AllDayEvent, 'title' | 'forUserId'>,
  ): AllDayEvent => ({
    ...base,
    id: uuidv7(),
    allDay: true,
    startDate: start.toString(),
    endDate: start.add({ days }).toString(),
    ...rest,
  })

  const brunch = timed(-2, '11:00', 120, { title: w.brunch, emoji: '🥞', forUserId: null })
  const events: CalendarEvent[] = [
    timed(0, '19:30', 150, { title: w.dinner, emoji: '🍝', forUserId: null, location: 'Luigi' }),
    timed(1, '07:00', 45, { title: w.run, emoji: '🏃', forUserId: me.id }),
    timed(1, '18:30', 75, {
      title: w.yoga,
      emoji: '🧘',
      forUserId: partner.id,
      repeat: 'weekly',
      createdBy: partner.id,
    }),
    allDay(today.add({ days: 2 }), 1, {
      title: w.mumBirthday,
      emoji: '🎂',
      forUserId: null,
      kind: 'birthday',
      repeat: 'yearly',
    }),
    timed(3, '20:00', 150, { title: w.movie, emoji: '🎬', forUserId: null }),
    allDay(today.add({ days: 4 }), 3, {
      title: w.hamburg,
      emoji: '💼',
      forUserId: partner.id,
      createdBy: partner.id,
    }),
    timed(5, '18:00', 120, { title: w.climbing, emoji: '🧗', forUserId: me.id, repeat: 'weekly' }),
    allDay(togetherSince, 1, {
      title: w.anniversary,
      emoji: '💛',
      forUserId: null,
      kind: 'anniversary',
      repeat: 'yearly',
      isCountdown: true,
    }),
    allDay(today.add({ days: 12 }), 3, {
      title: w.paris,
      emoji: '✈️',
      forUserId: null,
      isCountdown: true,
      notes: w.parisNote,
    }),
    allDay(today.with({ day: 1 }), 1, {
      title: w.rent,
      emoji: '🏠',
      forUserId: null,
      repeat: 'monthly',
    }),
    allDay(today.add({ days: 41 }), 1, {
      title: w.alexBirthday,
      emoji: '🎈',
      forUserId: partner.id,
      kind: 'birthday',
      repeat: 'yearly',
    }),
    brunch,
  ]

  const list = (
    title: string,
    emoji: string,
    texts: readonly string[],
    done: number[] = [],
    who: (string | null)[] = [],
  ): List => ({
    id: uuidv7(),
    title,
    emoji,
    createdAt: now,
    items: texts.map((text, i) => ({
      id: uuidv7(),
      text,
      done: done.includes(i),
      assigneeId: who[i] ?? null,
      createdAt: now,
      ...(done.includes(i) ? { doneAt: now } : {}),
    })),
  })

  const lists: List[] = [
    list(w.groceries, '🛒', w.items.groceries, [4, 5]),
    list(w.home, '🏠', w.items.home, [2], [me.id, partner.id]),
    list(w.ideas, '💡', w.items.ideas),
    list(w.bucket, '🌍', w.items.bucket),
  ]

  let gradient = 0
  const photos = (count: number): Photo[] =>
    Array.from({ length: count }, () => {
      const [from, to] = GRADIENTS[gradient++ % GRADIENTS.length] ?? ['#ffc2ad', '#ff7a6b']
      return { id: uuidv7(), kind: 'gradient', from, to }
    })

  const memory = (
    date: Temporal.PlainDate,
    title: string,
    emoji: string,
    count: number,
    rest: Partial<Memory> = {},
  ): Memory => ({
    id: uuidv7(),
    title,
    emoji,
    date: date.toString(),
    photos: photos(count),
    createdBy: me.id,
    createdAt: now,
    ...rest,
  })

  const memories: Memory[] = [
    memory(today.subtract({ days: 2 }), w.brunch, '🥞', 2, {
      note: w.brunchNote,
      eventId: brunch.id,
    }),
    memory(today.subtract({ days: 19 }), w.autumn, '🍂', 1),
    memory(today.subtract({ days: 104 }), w.lake, '🌊', 3, { place: 'Wannsee' }),
    memory(togetherSince.add({ days: 61 }), w.firstTrip, '🏔️', 2, { place: 'Tirol' }),
    memory(togetherSince.add({ days: 512 }), w.movingIn, '📦', 1, { note: w.movingInNote }),
  ]

  return { me, partner, togetherSince: togetherSince.toString(), events, lists, memories }
}
