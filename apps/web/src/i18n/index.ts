import type { WeekStart } from '@meandu/core'
import { useMemo } from 'react'
import { useSettings } from '../state/settings'
import { formatLocale, type Lang, weekStartFor } from './locale'
import { de, en, type Messages } from './messages'

export type { Lang } from './locale'
export type { Messages } from './messages'

export function messagesFor(lang: Lang): Messages {
  return lang === 'de' ? de : en
}

export function useT(): Messages {
  return messagesFor(useSettings((s) => s.lang))
}

export function useLocale(): { lang: Lang; locale: string; weekStart: WeekStart } {
  const lang = useSettings((s) => s.lang)
  return useMemo(() => {
    const locale = formatLocale(lang)
    return { lang, locale, weekStart: weekStartFor(locale) }
  }, [lang])
}
