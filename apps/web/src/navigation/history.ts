import { canSwipeBack } from '../platform'
import { entry, type Route, type TabId, useNav } from '../state/nav'

/**
 * Keeps the URL in sync with the current screen and makes the system back gesture
 * (Android, browser back) behave like in a native app: pop the current screen, then
 * go to Today, then leave. We keep at most one extra history entry ("guard") for that.
 */

const TAB_PATH: Record<TabId, string> = {
  today: '',
  calendar: '/calendar',
  lists: '/lists',
  memories: '/memories',
}

export function urlFor(tab: TabId, route: Route): string {
  const base = TAB_PATH[tab]
  switch (route.name) {
    case 'root':
      return base || '/'
    case 'event':
      return `${base}/e/${route.id}${route.date ? `?d=${route.date}` : ''}`
    case 'list':
      return `${base}/l/${route.id}`
    case 'memory':
      return `${base}/m/${route.id}`
    case 'settings':
      return `${base}/settings`
  }
}

export function parseUrl(pathname: string, search: string): { tab: TabId; route: Route } {
  const parts = pathname.split('/').filter(Boolean)
  let tab: TabId = 'today'
  const first = parts[0]
  if (first === 'calendar' || first === 'lists' || first === 'memories') {
    tab = first
    parts.shift()
  }
  const [kind, id] = parts
  if (kind === 'e' && id) {
    const date = new URLSearchParams(search).get('d') ?? undefined
    return { tab, route: { name: 'event', id, date } }
  }
  if (kind === 'l' && id) return { tab, route: { name: 'list', id } }
  if (kind === 'm' && id) return { tab, route: { name: 'memory', id } }
  if (kind === 'settings') return { tab, route: { name: 'settings' } }
  return { tab, route: { name: 'root' } }
}

/** Opens the screen in the address bar. Call once, before the first render. */
export function restoreFromUrl(): void {
  const { tab, route } = parseUrl(location.pathname, location.search)
  useNav.setState((s) => ({
    tab,
    stacks:
      route.name === 'root' ? s.stacks : { ...s.stacks, [tab]: [...s.stacks[tab], entry(route)] },
  }))
}

export function startHistorySync(): () => void {
  let guard = false
  let ignoreNextPop = false

  const currentUrl = () => {
    const { tab, stacks } = useNav.getState()
    return urlFor(tab, stacks[tab].at(-1)?.route ?? { name: 'root' })
  }

  const needsGuard = () => {
    const { tab, stacks } = useNav.getState()
    return stacks[tab].length > 1 || tab !== 'today'
  }

  const reconcile = () => {
    history.replaceState(history.state, '', currentUrl())
    if (needsGuard()) {
      if (!guard) {
        history.pushState({ meandu: 'guard' }, '', currentUrl())
        guard = true
      }
    } else if (guard) {
      guard = false
      ignoreNextPop = true
      history.back()
    }
  }

  const onPopState = () => {
    if (ignoreNextPop) {
      ignoreNextPop = false
      history.replaceState(history.state, '', currentUrl())
      return
    }
    guard = false
    const nav = useNav.getState()
    // A Safari tab animates its own swipe-back, so we skip ours there.
    if (nav.stacks[nav.tab].length > 1) nav.pop({ animated: canSwipeBack() })
    else if (nav.tab !== 'today') nav.selectTab('today')
    reconcile()
  }

  window.addEventListener('popstate', onPopState)
  const unsubscribe = useNav.subscribe(reconcile)
  reconcile()

  return () => {
    window.removeEventListener('popstate', onPopState)
    unsubscribe()
  }
}
