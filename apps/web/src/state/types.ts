export type Tone = 'coral' | 'sage' | 'honey' | 'bay' | 'berry'

export const TONES: readonly Tone[] = ['coral', 'sage', 'honey', 'bay', 'berry']

export interface Person {
  id: string
  name: string
  tone: Tone
}

export interface ListItem {
  id: string
  text: string
  done: boolean
  /** `null` means whoever gets to it first. */
  assigneeId: string | null
  createdAt: string
  doneAt?: string
}

export interface List {
  id: string
  title: string
  emoji: string
  items: ListItem[]
  createdAt: string
}

export type Photo =
  | { id: string; kind: 'gradient'; from: string; to: string }
  | { id: string; kind: 'blob'; width: number; height: number }

export interface Memory {
  id: string
  title: string
  /** ISO date */
  date: string
  emoji?: string
  note?: string
  place?: string
  eventId?: string
  photos: Photo[]
  createdBy: string
  createdAt: string
}
