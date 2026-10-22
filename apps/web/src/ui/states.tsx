import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../lib/cx'
import { Pressable, type PressableProps } from './Pressable'

/** A calm, friendly placeholder for when there's nothing to show yet. */
export function EmptyState({
  emoji,
  title,
  action,
  compact,
  className,
}: {
  emoji: string
  title: string
  action?: ReactNode
  /** Smaller, for empty spots inside a screen rather than a whole screen. */
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center text-center',
        compact ? 'px-6 py-5' : 'px-8 py-12',
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          'grid place-items-center rounded-full bg-surface-2 motion-safe:animate-float',
          compact ? 'size-14 text-2xl' : 'size-20 text-4xl',
        )}
      >
        {emoji}
      </span>
      <p
        className={cx(
          'mt-3 font-display font-bold text-ink-2',
          compact ? 'text-headline' : 'text-title',
        )}
      >
        {title}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Room for one short error under a form, announced to screen readers. */
export function ErrorLine({ text }: { text: string | null | undefined }) {
  return (
    <p role="alert" className="min-h-6 pb-2 pt-3 text-center text-sub font-semibold text-coral-ink">
      {text}
    </p>
  )
}

/** A softly shimmering block standing in for content that's on its way. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={cx('skeleton block rounded-xl', className)} style={style} />
}

/** Placeholder rows shaped like the event rows they stand in for. */
export function RowSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-1 px-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="size-11 shrink-0 rounded-2xl" />
          <span className="flex-1 space-y-2">
            <Skeleton className="h-3.5" style={{ width: `${70 - i * 12}%` }} />
            <Skeleton className="h-3 w-1/3" />
          </span>
        </div>
      ))}
    </div>
  )
}

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cx(
        'inline-block shrink-0 animate-spin rounded-full border-[2.5px] border-current border-r-transparent',
        className,
      )}
    />
  )
}

const BIG_BUTTON = {
  primary: 'bg-coral text-white shadow-soft',
  soft: 'bg-surface text-ink shadow-soft',
  plain: 'text-ink-2',
  /** A firm yes to something that can be undone. */
  ink: 'bg-ink text-canvas shadow-soft',
  /** A yes to something that can't be undone. */
  danger: 'bg-danger text-white shadow-soft',
  /** The way to something that can't be undone, kept quiet. */
  plainDanger: 'text-coral-ink',
}

/**
 * A large, full-width button. While `busy` it shows a spinner and ignores presses.
 * Colours and size come from `variant`, `compact` and `fit`: utilities in `className`
 * don't reliably override the ones here, since the stylesheet's order decides.
 */
export function BigButton({
  busy = false,
  variant = 'primary',
  compact = false,
  fit = false,
  className,
  children,
  onPress,
  ...props
}: Omit<PressableProps, 'children'> & {
  busy?: boolean
  variant?: keyof typeof BIG_BUTTON
  /** Shorter, for a secondary choice under the main one. */
  compact?: boolean
  /** As wide as its label instead of the full width. */
  fit?: boolean
  children: ReactNode
}) {
  return (
    <Pressable
      {...props}
      aria-busy={busy || undefined}
      onPress={(event) => {
        if (!busy) onPress?.(event)
      }}
      className={cx(
        'relative flex items-center justify-center rounded-full text-headline font-bold',
        compact ? 'h-11' : 'h-14',
        fit ? 'px-6' : 'w-full',
        BIG_BUTTON[variant],
        className,
      )}
    >
      <span
        className={cx(
          'flex items-center gap-2 transition-opacity duration-200',
          busy && 'opacity-0',
        )}
      >
        {children}
      </span>
      {busy && <Spinner className="absolute" />}
    </Pressable>
  )
}
