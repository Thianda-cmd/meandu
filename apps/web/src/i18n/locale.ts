import type { WeekStart } from '@meandu/core'

export type Lang = 'en' | 'de'

function preferredTags(): readonly string[] {
  return navigator.languages?.length ? navigator.languages : [navigator.language]
}

export function detectLang(): Lang {
  for (const tag of preferredTags()) {
    const code = tag.toLowerCase()
    if (code.startsWith('de')) return 'de'
    if (code.startsWith('en')) return 'en'
  }
  return 'en'
}

/** The user's own regional variant when it matches the app language (en-US, de-AT, …). */
export function formatLocale(lang: Lang): string {
  return (
    preferredTags().find((tag) => tag.toLowerCase().startsWith(lang)) ??
    (lang === 'de' ? 'de-DE' : 'en-GB')
  )
}

const SUNDAY_FIRST = new Set(['US', 'CA', 'MX', 'BR', 'JP', 'KR', 'IL', 'PH', 'ZA', 'AU'])

export function weekStartFor(locale: string): WeekStart {
  try {
    const intl = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number }
      weekInfo?: { firstDay: number }
    }
    const first = intl.getWeekInfo?.().firstDay ?? intl.weekInfo?.firstDay
    if (first && first >= 1 && first <= 7) return first as WeekStart
    return intl.region && SUNDAY_FIRST.has(intl.region) ? 7 : 1
  } catch {
    return 1
  }
}
