import { motion, useAnimate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { cx } from '../lib/cx'

/** Accepts an invite code typed with spaces or dashes, or pasted inside the whole message. */
export function extractCode(text: string): string {
  const fromLink = text.match(/\/join\/([A-Za-z0-9]{6})\b/)?.[1]
  const raw = fromLink ?? text.replace(/^.*:/s, '')
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
}

/** The six digits of an emailed code, wherever they are in what was pasted. */
const extractDigits = (text: string) => text.replace(/\D/g, '').slice(0, 6)

/**
 * Six tiles over one real (invisible) text field, so typing, pasting a whole message and
 * the keyboard's own suggestions (like a code from Mail) all just work.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  label,
  kind = 'invite',
  /** Bump to shake the tiles after a wrong code. */
  shake = 0,
  autoFocus,
  inSheet = false,
}: {
  value: string
  onChange: (value: string) => void
  onComplete?: (code: string) => void
  label: string
  /** An invite code (letters and digits) or a code sent by email (digits). */
  kind?: 'invite' | 'email'
  shake?: number
  autoFocus?: boolean
  /** On a white sheet the tiles are tinted instead of raised. */
  inSheet?: boolean
}) {
  const parse = kind === 'email' ? extractDigits : extractCode
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
          const code = parse(e.target.value)
          onChange(code)
          if (code.length === 6 && code !== value) onComplete?.(code)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={label}
        autoComplete={kind === 'email' ? 'one-time-code' : 'off'}
        inputMode={kind === 'email' ? 'numeric' : 'text'}
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
