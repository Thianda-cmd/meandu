import { CalendarScreen } from '../features/calendar/CalendarScreen'
import { EventScreen } from '../features/calendar/EventScreen'
import { ListScreen } from '../features/lists/ListScreen'
import { ListsScreen } from '../features/lists/ListsScreen'
import { MemoriesScreen } from '../features/memories/MemoriesScreen'
import { MemoryScreen } from '../features/memories/MemoryScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { TodayScreen } from '../features/today/TodayScreen'
import type { Route, TabId } from '../state/nav'

const ROOTS: Record<TabId, () => React.JSX.Element> = {
  today: TodayScreen,
  calendar: CalendarScreen,
  lists: ListsScreen,
  memories: MemoriesScreen,
}

export function ScreenFor({ tab, route }: { tab: TabId; route: Route }) {
  switch (route.name) {
    case 'root': {
      const Root = ROOTS[tab]
      return <Root />
    }
    case 'event':
      return <EventScreen id={route.id} date={route.date} />
    case 'list':
      return <ListScreen id={route.id} />
    case 'memory':
      return <MemoryScreen id={route.id} />
    case 'settings':
      return <SettingsScreen />
  }
}
