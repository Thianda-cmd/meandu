import { motion, useAnimate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import { extractCode } from './invite'

/**
 * Six letter tiles over one real (invisible) text field, so typing, pasting the whole
 * invite message and the keyboard's own suggestions all just work.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  label,
  /** Bump to shake the tiles after a wrong code. */
  shake = 0,
  autoFocus,
  inSheet = false,
}: {
  value: string
  onChange: (value: string) => void
  onComplete?: (code: string) => void
  label: string
  shake?: number
  autoFocus?: boolean
  /** On a white sheet the tiles are tinted instead of raised. */
  inSheet?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const input = useRef<HTMLInputElement>(null)

  // Not the autoFocus attribute: inside a sheet that's still sliding in, that would scroll
  // the page to reach the field and push the sheet out of view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when it first appears
  useEffect(() => {
    if (autoFocus) input.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (shake) animate(scope.current, { x: [0, -12, 10, -6, 4, 0] }, { duration: 0.42 })
  }, [shake, animate, scope])

  return (
    <div ref={scope} className="relative flex items-center justify-center gap-1.5">
      {Array.from({ length: 6 }, (_, i) => {
        const char = value[i]
        const current = focused && (i === value.length || (i === 5 && value.length === 6))
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: one tile per position
            key={i}
            aria-hidden
            className={cx(
              'grid h-16 w-12 place-items-center rounded-2xl font-display text-[2rem] font-extrabold transition-shadow duration-200',
              inSheet ? 'bg-surface-2' : 'bg-surface shadow-soft',
              i === 3 && 'ml-3',
              current && 'ring-2 ring-coral',
            )}
          >
            {char ? (
              <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                {char}
              </motion.span>
            ) : (
              current && <span className="h-8 w-0.5 animate-pulse rounded-full bg-coral" />
            )}
          </span>
        )
      })}
      <input
        ref={input}
        value={value}
        onChange={(e) => {
          const code = extractCode(e.target.value)
          onChange(code)
          if (code.length === 6 && code !== value) onComplete?.(code)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={label}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        enterKeyHint="go"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.length === 6) onComplete?.(value)
        }}
        className="absolute inset-0 size-full cursor-default opacity-0"
      />
    </div>
  )
}
