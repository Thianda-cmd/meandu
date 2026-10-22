import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { detectLang, type Lang } from '../i18n/locale'

export type ThemeChoice = 'auto' | 'light' | 'dark'

interface SettingsState {
  lang: Lang
  theme: ThemeChoice
  installHidden: boolean
  setLang: (lang: Lang) => void
  setTheme: (theme: ThemeChoice) => void
  hideInstall: () => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: detectLang(),
      theme: 'auto',
      installHidden: false,
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      hideInstall: () => set({ installHidden: true }),
    }),
    { name: 'meandu-settings', version: 1 },
  ),
)
