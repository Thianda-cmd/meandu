import { Button, type ButtonProps } from 'react-aria-components'
import { cx } from '../lib/cx'
import { haptics } from '../platform'

export interface PressableProps extends Omit<ButtonProps, 'className'> {
  className?: string
  haptic?: keyof typeof haptics | false
  /** `scale` shrinks a little when pressed, `row` highlights, `none` does nothing. */
  feedback?: 'scale' | 'row' | 'none'
}

/** The one button primitive: accessible, cancels when you start scrolling, feels physical. */
export function Pressable({
  className,
  haptic = false,
  feedback = 'scale',
  onPress,
  ...props
}: PressableProps) {
  return (
    <Button
      {...props}
      onPress={(event) => {
        if (haptic) haptics[haptic]()
        onPress?.(event)
      }}
      className={cx(
        'cursor-default text-left',
        feedback === 'scale' && 'press',
        feedback === 'row' && 'press-row',
        className,
      )}
    />
  )
}

/** Round, translucent icon button for headers. */
export function IconButton({
  label,
  className,
  ...props
}: Omit<PressableProps, 'aria-label'> & { label: string }) {
  return (
    <Pressable
      aria-label={label}
      className={cx(
        'grid size-9 shrink-0 place-items-center rounded-full bg-surface-2/80 text-ink',
        className,
      )}
      {...props}
    />
  )
}
