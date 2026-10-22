import { create } from 'zustand'

export type TabId = 'today' | 'calendar' | 'lists' | 'memories'

export const TABS: readonly TabId[] = ['today', 'calendar', 'lists', 'memories']

export type Route =
  | { name: 'root' }
  | { name: 'event'; id: string; date?: string }
  | { name: 'list'; id: string }
  | { name: 'memory'; id: string }
  | { name: 'settings' }

export interface Entry {
  key: string
  route: Route
}

let keys = 0
export const entry = (route: Route): Entry => ({ key: `screen-${++keys}`, route })

const rootStacks = (): Record<TabId, Entry[]> => ({
  today: [entry({ name: 'root' })],
  calendar: [entry({ name: 'root' })],
  lists: [entry({ name: 'root' })],
  memories: [entry({ name: 'root' })],
})

/** How the next pop should animate. Set by `pop`, read once by the stack view. */
export const popHint = { animated: true, velocity: 0 }

interface NavState {
  tab: TabId
  stacks: Record<TabId, Entry[]>
  push: (route: Route) => void
  pop: (hint?: { animated?: boolean; velocity?: number }) => void
  popToRoot: (tab?: TabId) => void
  selectTab: (tab: TabId) => void
  /** Switch to a tab and open a screen there. */
  open: (tab: TabId, route: Route) => void
  /** Back to Today with every tab on its first screen. */
  reset: () => void
}

export const useNav = create<NavState>()((set, get) => ({
  tab: 'today',
  stacks: rootStacks(),

  push: (route) =>
    set((s) => ({ stacks: { ...s.stacks, [s.tab]: [...s.stacks[s.tab], entry(route)] } })),

  pop: (hint) => {
    const { tab, stacks } = get()
    if (stacks[tab].length < 2) return
    popHint.animated = hint?.animated ?? true
    popHint.velocity = hint?.velocity ?? 0
    set({ stacks: { ...stacks, [tab]: stacks[tab].slice(0, -1) } })
  },

  popToRoot: (target) => {
    const { tab, stacks } = get()
    const t = target ?? tab
    if (stacks[t].length < 2) return
    popHint.animated = true
    popHint.velocity = 0
    set({ stacks: { ...stacks, [t]: stacks[t].slice(0, 1) } })
  },

  selectTab: (tab) => set({ tab }),

  open: (tab, route) =>
    set((s) => ({ tab, stacks: { ...s.stacks, [tab]: [...s.stacks[tab], entry(route)] } })),

  reset: () => set({ tab: 'today', stacks: rootStacks() }),
}))

export function currentRoute(): Route {
  const { tab, stacks } = useNav.getState()
  return stacks[tab].at(-1)?.route ?? { name: 'root' }
}
