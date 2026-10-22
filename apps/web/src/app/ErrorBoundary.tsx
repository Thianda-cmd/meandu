import { Component, type ReactNode } from 'react'
import { messagesFor } from '../i18n'
import { useSettings } from '../state/settings'

/** If something breaks while drawing the app, show a calm way back instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: unknown) {
    console.error(error)
  }

  override render() {
    return this.state.failed ? <Oops /> : this.props.children
  }
}

function Oops() {
  const t = messagesFor(useSettings.getState().lang)
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-canvas px-8 text-center">
      <span
        aria-hidden
        className="mb-3 grid size-20 place-items-center rounded-full bg-surface-2 text-4xl"
      >
        🙈
      </span>
      <h1 className="font-display text-large font-extrabold">{t.oops.title}</h1>
      <p className="text-body text-ink-2">{t.oops.hint}</p>
      <button
        type="button"
        onClick={() => location.reload()}
        className="mt-6 rounded-full bg-coral px-6 py-3 text-headline font-bold text-white shadow-soft transition-transform active:scale-95"
      >
        {t.oops.retry}
      </button>
    </div>
  )
}
