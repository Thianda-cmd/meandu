import '@fontsource-variable/nunito/wght.css'
import './styles/app.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { restoreFromUrl } from './navigation/history'
import { useUi } from './state/ui'
import { extractCode } from './ui/CodeInput'

// An invite link (/join/K7P2QX) opens the app ready to join.
const invite = location.pathname.match(/^\/join\/([A-Za-z0-9-]+)\/?$/)?.[1]
if (invite) {
  useUi.getState().setJoinCode(extractCode(invite))
  history.replaceState(null, '', '/')
}
restoreFromUrl()

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
