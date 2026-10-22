import { Temporal } from '@meandu/core'
import { CaretUpDown } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { useLocale } from '../i18n'
import { todayDate } from '../lib/time'

/**
 * A soft pill showing a nicely formatted value. An invisible native input sits on top,
 * so tapping opens the phone's own date, time or option wheel.
 */
function PickerPill({ text, children }: { text: ReactNode; children: ReactNode }) {
  return (
    <span className="relative inline-flex shrink-0 items-center gap-1 rounded-xl bg-surface px-3 py-1.5 text-body font-semibold text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]">
      {text}
      {children}
    </span>
  )
}

const overlay = 'absolute inset-0 size-full cursor-default appearance-none opacity-0'

function openPicker(input: HTMLInputElement) {
  try {
    input.showPicker()
  } catch {
    // Older browsers open it on their own.
  }
}

export function DatePicker({
  label,
  value,
  onChange,
  min,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  min?: string
}) {
  const { locale } = useLocale()
  const date = Temporal.PlainDate.from(value)
  const text = date.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    ...(date.year === todayDate().year ? {} : { year: 'numeric' }),
  })
  return (
    <PickerPill text={text}>
      <input
        type="date"
        aria-label={label}
        value={value}
        min={min}
        onClick={(e) => openPicker(e.currentTarget)}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value)
        }}
        className={overlay}
      />
    </PickerPill>
  )
}

export function TimePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const { locale } = useLocale()
  const text = Temporal.PlainTime.from(value).toLocaleString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return (
    <PickerPill text={text}>
      <input
        type="time"
        aria-label={label}
        value={value}
        onClick={(e) => openPicker(e.currentTarget)}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value)
        }}
        className={overlay}
      />
    </PickerPill>
  )
}

export function OptionPicker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  const current = options.find((o) => o.value === value)?.label ?? value
  return (
    <PickerPill
      text={
        <>
          {current}
          <CaretUpDown size={14} weight="bold" className="text-ink-3" />
        </>
      }
    >
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={overlay}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </PickerPill>
  )
}
