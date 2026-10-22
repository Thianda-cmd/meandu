import { createContext, useContext } from 'react'
import type { TabId } from '../state/nav'

export interface ScreenInfo {
  tab: TabId
  /** The first screen of its tab. */
  isRoot: boolean
}

export const ScreenContext = createContext<ScreenInfo>({ tab: 'today', isRoot: true })

export function useScreen(): ScreenInfo {
  return useContext(ScreenContext)
}

/** Event name used to scroll a tab's first screen back to the top when its tab is tapped again. */
export const SCROLL_TOP_EVENT = 'meandu:scroll-top'
