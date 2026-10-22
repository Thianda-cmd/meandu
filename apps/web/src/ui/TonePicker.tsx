import { Radio, RadioGroup } from 'react-aria-components'
import { cx } from '../lib/cx'
import { toneStyle } from '../lib/tone'
import { haptics } from '../platform'
import { TONES, type Tone } from '../state/types'

/** A row of colour dots to pick your colour from. */
export function TonePicker({
  label,
  value,
  onChange,
  onCanvas = false,
  className,
}: {
  label: string
  value: Tone
  onChange: (tone: Tone) => void
  /** Placed straight on the page background rather than on a card. */
  onCanvas?: boolean
  className?: string
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      orientation="horizontal"
      onChange={(tone) => {
        haptics.select()
        onChange(tone as Tone)
      }}
      className={cx('flex gap-3', className)}
    >
      {TONES.map((tone) => (
        <Radio
          key={tone}
          value={tone}
          aria-label={tone}
          style={toneStyle(tone)}
          className={cx(
            'size-9 cursor-default rounded-full bg-tone outline-none transition-shadow data-[focus-visible]:ring-2 data-[focus-visible]:ring-ink data-[selected]:ring-[3px] data-[selected]:ring-tone/40 data-[selected]:ring-offset-2',
            onCanvas ? 'data-[selected]:ring-offset-canvas' : 'data-[selected]:ring-offset-surface',
          )}
        />
      ))}
    </RadioGroup>
  )
}
