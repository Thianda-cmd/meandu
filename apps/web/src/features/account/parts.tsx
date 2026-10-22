import { Check, Fingerprint } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { cx } from '../../lib/cx'
import { BOUNCY } from '../../ui/motion'

/** A big, friendly email field. `forSignIn` lets passkeys show up in the keyboard's suggestions. */
export function EmailField({
  value,
  onChange,
  onSubmit,
  label,
  placeholder,
  forSignIn = false,
  autoFocus = false,
  inSheet = false,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  label: string
  placeholder: string
  forSignIn?: boolean
  autoFocus?: boolean
  inSheet?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)

  // Focus without scrolling: the field may still be sliding in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when it first appears
  useEffect(() => {
    if (autoFocus) input.current?.focus({ preventScroll: true })
  }, [])

  return (
    <input
      ref={input}
      type="email"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && value.trim()) onSubmit()
      }}
      aria-label={label}
      placeholder={placeholder}
      autoComplete={forSignIn ? 'username webauthn' : 'email'}
      inputMode="email"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="send"
      className={cx(
        'w-full rounded-card px-4 py-3.5 text-center text-title font-semibold transition-shadow focus:ring-2 focus:ring-coral/40',
        inSheet ? 'bg-surface-2' : 'bg-surface shadow-soft',
      )}
    />
  )
}

/** A soft fingerprint with a slow pulse: "your face or finger is the key". */
export function KeyGlyph({ size = 96 }: { size?: number }) {
  return (
    <span className="relative grid place-items-center" style={{ width: size, height: size }}>
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full bg-coral-soft"
        animate={{ scale: [1, 1.12, 1], opacity: [0.9, 0.5, 0.9] }}
        transition={{ duration: 2.6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
      />
      <span className="relative grid size-[78%] place-items-center rounded-full bg-surface text-coral shadow-soft">
        <Fingerprint size={size * 0.46} weight="duotone" />
      </span>
    </span>
  )
}

/** A check that pops in when something worked. */
export function DoneMark({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-6 text-center" role="status">
      <motion.span
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={BOUNCY}
        className="grid size-24 place-items-center rounded-full bg-sage text-white shadow-soft"
      >
        <Check size={44} weight="bold" />
      </motion.span>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-5 font-display text-title font-extrabold"
      >
        {label}
      </motion.p>
    </div>
  )
}

export function OrLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1 text-sub font-semibold text-ink-3">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}
