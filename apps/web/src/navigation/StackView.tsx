import {
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react'
import {
  Activity,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { canSwipeBack, haptics } from '../platform'
import { type Entry, popHint, type TabId, useNav } from '../state/nav'
import { STACK_SPRING } from '../ui/motion'
import { ScreenContext } from './ScreenContext'
import { ScreenFor } from './screens'

function subscribeResize(callback: () => void) {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

function useViewportWidth(): number {
  return useSyncExternalStore(subscribeResize, () => window.innerWidth)
}

type Role = 'top' | 'under' | 'buried'

/**
 * One tab's stack of screens. New screens slide in from the right with the previous one
 * drifting left underneath; popping reverses it, and you can drag it back from the edge.
 */
export function StackView({ tab }: { tab: TabId }) {
  const entries = useNav((s) => s.stacks[tab])
  const width = useViewportWidth()
  const reduceMotion = useReducedMotion()
  const x = useMotionValue(0)
  const [leaving, setLeaving] = useState<Entry | null>(null)
  const previous = useRef(entries)
  const transition = useRef(0)
  /** Finishes the pop that's sliding away right now. */
  const landPop = useRef<(() => void) | null>(null)

  // Switching tabs mid-slide hides this stack, which stops the slide halfway. Land it now,
  // so the tab isn't stuck between two screens when you come back.
  useLayoutEffect(
    () => () => {
      x.jump(0)
      landPop.current?.()
    },
    [x],
  )

  useLayoutEffect(() => {
    const before = previous.current
    previous.current = entries
    const beforeTop = before.at(-1)
    const nowTop = entries.at(-1)
    if (!beforeTop || !nowTop || beforeTop.key === nowTop.key) return

    const id = ++transition.current
    const pushed = entries.some((e) => e.key === beforeTop.key)

    if (pushed) {
      setLeaving(null)
      if (reduceMotion) {
        x.jump(0)
        return
      }
      x.jump(width)
      animate(x, 0, STACK_SPRING)
      return
    }

    const { animated, velocity } = popHint
    popHint.animated = true
    popHint.velocity = 0
    if (!animated || reduceMotion) {
      setLeaving(null)
      x.jump(0)
      return
    }
    setLeaving(beforeTop)
    const land = () => {
      if (transition.current !== id) return
      landPop.current = null
      setLeaving(null)
      x.jump(0)
    }
    landPop.current = land
    animate(x, width, { ...STACK_SPRING, velocity }).then(land)
  }, [entries, width, x, reduceMotion])

  const rendered = leaving ? [...entries, leaving] : entries
  const top = rendered.length - 1

  return (
    <div className="absolute inset-0 overflow-hidden">
      {rendered.map((e, i) => {
        const role: Role = i === top ? 'top' : i === top - 1 ? 'under' : 'buried'
        return (
          <Activity key={e.key} mode={role === 'buried' ? 'hidden' : 'visible'}>
            <Layer
              role={role}
              x={x}
              width={width}
              isRoot={i === 0}
              interactive={role === 'top' && !leaving}
            >
              <ScreenContext.Provider value={{ tab, isRoot: i === 0 }}>
                <ScreenFor tab={tab} route={e.route} />
              </ScreenContext.Provider>
            </Layer>
          </Activity>
        )
      })}
      {entries.length > 1 && !leaving && canSwipeBack() && <EdgeSwipe x={x} width={width} />}
    </div>
  )
}

function Layer({
  role,
  x,
  width,
  isRoot,
  interactive,
  children,
}: {
  role: Role
  x: MotionValue<number>
  width: number
  isRoot: boolean
  interactive: boolean
  children: ReactNode
}) {
  const parallax = useTransform(x, [0, width], [-width * 0.28, 0])
  const shade = useTransform(x, [0, width], [0.14, 0])
  const moving = role === 'top' && !isRoot

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-canvas"
      style={{
        x: moving ? x : role === 'under' ? parallax : 0,
        zIndex: role === 'top' ? 2 : 1,
        boxShadow: moving ? '-16px 0 40px -16px rgb(0 0 0 / 0.25)' : undefined,
      }}
      inert={!interactive}
      aria-hidden={role !== 'top'}
    >
      {children}
      {role === 'under' && (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-black"
          style={{ opacity: shade }}
        />
      )}
    </motion.div>
  )
}

/** Drag from the left edge to go back, following the finger. */
function EdgeSwipe({ x, width }: { x: MotionValue<number>; width: number }) {
  const startX = useRef<number | null>(null)
  const samples = useRef<{ x: number; t: number }[]>([])

  const finish = (completed: boolean) => {
    if (startX.current === null) return
    startX.current = null
    const s = samples.current
    const first = s[0]
    const last = s.at(-1)
    const velocity =
      first && last && last.t > first.t ? ((last.x - first.x) / (last.t - first.t)) * 1000 : 0
    const distance = x.get()
    if (completed && (distance > width * 0.4 || (velocity > 450 && distance > 16))) {
      haptics.select()
      useNav.getState().pop({ velocity })
    } else {
      animate(x, 0, STACK_SPRING)
    }
  }

  return (
    <div
      aria-hidden
      className="absolute inset-y-0 left-0 z-20 w-5"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        startX.current = e.clientX
        samples.current = [{ x: e.clientX, t: e.timeStamp }]
      }}
      onPointerMove={(e) => {
        if (startX.current === null) return
        x.set(Math.max(0, e.clientX - startX.current))
        samples.current.push({ x: e.clientX, t: e.timeStamp })
        if (samples.current.length > 6) samples.current.shift()
      }}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
    />
  )
}
