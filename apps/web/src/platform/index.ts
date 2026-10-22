/**
 * Everything that depends on the device goes through here. This is the web version;
 * the native apps will get a Tauri version with the same shape.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const ua = navigator.userAgent

export const isIOS =
  /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isAndroid = /Android/.test(ua)

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** In a Safari tab, the browser's own edge swipe already goes back. */
export function canSwipeBack(): boolean {
  return !isIOS || isStandalone()
}

function isTyping(): boolean {
  const el = document.activeElement
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
}

/** iOS has no vibration API, but toggling a native switch plays the system haptic (iOS 18+). */
function iosTick(): void {
  if (isTyping()) return
  const label = document.createElement('label')
  label.ariaHidden = 'true'
  label.style.display = 'none'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  label.appendChild(input)
  document.head.appendChild(label)
  label.click()
  label.remove()
}

function vibrate(pattern: number | number[]): void {
  if ('vibrate' in navigator) navigator.vibrate(pattern)
  else if (isIOS) iosTick()
}

export const haptics = {
  tap: () => vibrate(8),
  select: () => vibrate(5),
  success: () => vibrate([10, 60, 14]),
  warn: () => vibrate([18, 40, 18]),
}

export async function share(data: ShareData): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share(data)
    } catch {
      // The user closed the share sheet.
    }
    return
  }
  if (data.url) await navigator.clipboard?.writeText(data.url)
}

let deferredInstall: BeforeInstallPromptEvent | null = null
const installListeners = new Set<() => void>()

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferredInstall = event as BeforeInstallPromptEvent
  for (const listener of installListeners) listener()
})

export const install = {
  canPrompt: () => deferredInstall !== null,
  async prompt() {
    if (!deferredInstall) return
    await deferredInstall.prompt()
    deferredInstall = null
    for (const listener of installListeners) listener()
  },
  subscribe(listener: () => void) {
    installListeners.add(listener)
    return () => {
      installListeners.delete(listener)
    }
  },
  /** iOS never offers an install prompt, so we show our own guide there. */
  needsGuide: () => isIOS && !isStandalone(),
}
