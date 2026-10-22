import { motion } from 'motion/react'
import { type ReactNode, useId } from 'react'
import { Radio, RadioGroup, Switch } from 'react-aria-components'
import { cx } from '../lib/cx'
import { haptics } from '../platform'
import { SNAPPY } from './motion'

interface SegmentedProps<T extends string> {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode; ariaLabel?: string }[]
  className?: string
}

/** iOS-style segmented control with a sliding highlight. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: SegmentedProps<T>) {
  const id = useId()
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      orientation="horizontal"
      onChange={(next) => {
        haptics.select()
        onChange(next as T)
      }}
      className={cx('flex rounded-full bg-surface-3/70 p-1', className)}
    >
      {options.map((option) => (
        <Radio
          key={option.value}
          value={option.value}
          aria-label={option.ariaLabel}
          className="relative flex flex-1 cursor-default items-center justify-center rounded-full px-3 py-1.5 text-sub font-semibold text-ink-2 outline-none transition-colors data-[selected]:text-ink"
        >
          {({ isSelected }) => (
            <>
              {isSelected && (
                <motion.span
                  layoutId={`segment-${id}`}
                  transition={SNAPPY}
                  className="absolute inset-0 rounded-full bg-surface shadow-soft"
                />
              )}
              <span className="relative flex items-center gap-1.5">{option.label}</span>
            </>
          )}
        </Radio>
      ))}
    </RadioGroup>
  )
}

/** iOS-style switch. */
export function Toggle({
  isSelected,
  onChange,
  children,
}: {
  isSelected: boolean
  onChange: (value: boolean) => void
  children: ReactNode
}) {
  return (
    <Switch
      isSelected={isSelected}
      onChange={(value) => {
        haptics.select()
        onChange(value)
      }}
      className="group flex min-h-12 w-full cursor-default items-center justify-between gap-3 px-4 outline-none"
    >
      <span className="flex min-w-0 items-center gap-3 text-body">{children}</span>
      <span className="relative h-[31px] w-[51px] shrink-0 rounded-full bg-surface-3 transition-colors duration-300 group-data-[selected]:bg-coral group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-coral">
        <span className="absolute left-[2px] top-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)] transition-transform duration-300 ease-(--ease-ios) group-data-[selected]:translate-x-5" />
      </span>
    </Switch>
  )
}

/** Inset group of rows, like iOS settings. */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx('divide-y divide-line overflow-hidden rounded-card bg-surface-2/60', className)}
    >
      {children}
    </div>
  )
}

/** One row in a group: an icon and label on the left, a control on the right. */
export function Row({
  icon,
  label,
  children,
}: {
  icon?: ReactNode
  label: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4">
      {icon && <span className="text-ink-2">{icon}</span>}
      <span className="min-w-0 flex-1 truncate text-body">{label}</span>
      {children}
    </div>
  )
}
