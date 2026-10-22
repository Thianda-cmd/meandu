import { useEffect } from 'react'
import { useSettings } from '../state/settings'
import { useUi } from '../state/ui'

const CANVAS = { light: '#FFF7F2', dark: '#1C1418' }

/** Applies light/dark (following the system when set to Auto) and the language. */
export function useThemeAndLanguage(): void {
  const theme = useSettings((s) => s.theme)
  const lang = useSettings((s) => s.lang)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
        meta.setAttribute('content', dark ? CANVAS.dark : CANVAS.light)
      }
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
}

const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])

/** Hides the tab bar while typing, like native apps do when the keyboard is up. */
export function useTypingFlag(): void {
  useEffect(() => {
    const isText = (el: EventTarget | null) =>
      el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement && TEXT_INPUTS.has(el.type))
    const onFocusIn = (e: FocusEvent) => {
      if (isText(e.target)) document.documentElement.dataset.typing = 'true'
    }
    const onFocusOut = () => {
      delete document.documentElement.dataset.typing
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])
}

/** Home-screen shortcut ("New plan") opens straight into the form. */
export function useLaunchShortcut(): void {
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('new') !== 'plan') return
    params.delete('new')
    const query = params.toString()
    history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}`)
    useUi.getState().openSheet({ type: 'event' })
  }, [])
}
