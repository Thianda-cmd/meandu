import { CaretLeft } from '@phosphor-icons/react'
import { motion, useScroll, useTransform } from 'motion/react'
import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react'
import { useT } from '../i18n'
import { SCROLL_TOP_EVENT, useScreen } from '../navigation/ScreenContext'
import { useNav } from '../state/nav'
import { IconButton } from './Pressable'

interface ScreenProps {
  title: string
  /** Shorter title for the compact bar, if the large one is long. */
  barTitle?: string
  /** Big title at the top that shrinks into the bar as you scroll (first screens of a tab). */
  large?: boolean
  /** Small line above the large title. */
  eyebrow?: ReactNode
  /** Extra content next to the large title, e.g. a toggle. */
  titleAccessory?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

/** A screen with a native-style navigation bar and its own scroll area. */
export function Screen({
  title,
  barTitle,
  large,
  eyebrow,
  titleAccessory,
  actions,
  children,
}: ScreenProps) {
  const t = useT()
  const { tab, isRoot } = useScreen()
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollTop = useRef(0)
  const { scrollY } = useScroll({ container: scrollRef })
  const barOpacity = useTransform(scrollY, large ? [30, 58] : [0, 14], [0, 1])

  // Hidden tabs lose their scroll position, so put it back when the screen shows again.
  useLayoutEffect(() => {
    if (scrollRef.current && scrollTop.current) scrollRef.current.scrollTop = scrollTop.current
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      scrollTop.current = el.scrollTop
    }
    const onScrollTop = (event: Event) => {
      if (isRoot && (event as CustomEvent<string>).detail === tab) {
        el.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener(SCROLL_TOP_EVENT, onScrollTop)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener(SCROLL_TOP_EVENT, onScrollTop)
    }
  }, [tab, isRoot])

  return (
    <div className="absolute inset-0 bg-canvas">
      <header className="absolute inset-x-0 top-0 z-10" style={{ paddingTop: 'var(--safe-top)' }}>
        <motion.div
          aria-hidden
          className="glass absolute inset-0 border-b border-line"
          style={{ opacity: barOpacity }}
        />
        <div className="relative flex h-(--nav-h) items-center gap-2 px-3">
          {!isRoot && (
            <IconButton label={t.common.back} onPress={() => useNav.getState().pop()}>
              <CaretLeft size={20} weight="bold" />
            </IconButton>
          )}
          <motion.h2
            className="pointer-events-none absolute inset-x-24 truncate text-center text-headline font-semibold"
            style={{ opacity: large ? barOpacity : 1 }}
          >
            {barTitle ?? title}
          </motion.h2>
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="scroll-y h-full"
        style={{
          paddingTop: 'calc(var(--safe-top) + var(--nav-h))',
          paddingBottom: 'var(--tabbar-space)',
        }}
      >
        {large && (
          <div className="flex items-end justify-between gap-3 px-5 pb-4 pt-1">
            <div className="min-w-0">
              {eyebrow && <p className="text-sub font-semibold text-ink-2">{eyebrow}</p>}
              <h1 className="text-balance break-words font-display text-large font-extrabold tracking-tight">
                {title}
              </h1>
            </div>
            {titleAccessory}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** Small uppercase-free section label, kept quiet so content leads. */
export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pb-2 pt-6">
      <h3 className="font-display text-title font-bold">{children}</h3>
      {action}
    </div>
  )
}
