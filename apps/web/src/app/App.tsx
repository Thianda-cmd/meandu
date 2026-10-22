import { MotionConfig } from 'motion/react'
import { useEffect } from 'react'
import { SheetHost } from '../features/SheetHost'
import { startHistorySync } from '../navigation/history'
import { TabBar, TabNavigator } from '../navigation/TabBar'
import { HeartPop } from '../ui/HeartPop'
import { ToastHost } from '../ui/Toast'
import { useLaunchShortcut, useThemeAndLanguage, useTypingFlag } from './hooks'
import { UpdateWatcher } from './UpdateWatcher'

export function App() {
  useThemeAndLanguage()
  useTypingFlag()
  useLaunchShortcut()
  useEffect(() => startHistorySync(), [])

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell absolute inset-0 overflow-hidden bg-canvas">
        <TabNavigator />
        <TabBar />
      </div>
      <SheetHost />
      <ToastHost />
      <HeartPop />
      <UpdateWatcher />
    </MotionConfig>
  )
}
