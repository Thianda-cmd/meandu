import { motion, useAnimate } from 'motion/react'
import { useEffect, useState } from 'react'
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
}: {
  value: string
  onChange: (value: string) => void
  onComplete?: (code: string) => void
  label: string
  shake?: number
  autoFocus?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const [scope, animate] = useAnimate<HTMLDivElement>()

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
              'grid h-16 w-12 place-items-center rounded-2xl bg-surface font-display text-[2rem] font-extrabold shadow-soft transition-shadow duration-200',
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
        value={value}
        onChange={(e) => {
          const code = extractCode(e.target.value)
          onChange(code)
          if (code.length === 6 && code !== value) onComplete?.(code)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={label}
        // biome-ignore lint/a11y/noAutofocus: the code is the only thing on this step
        autoFocus={autoFocus}
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
