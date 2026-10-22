import { Trash } from '@phosphor-icons/react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import type { ReactNode } from 'react'
import { haptics } from '../platform'
import { SNAPPY } from './motion'
import { Pressable } from './Pressable'

const ACTION_WIDTH = 84

/** A list row you can swipe left to reveal delete; a long swipe deletes right away. */
export function SwipeRow({
  children,
  onDelete,
  deleteLabel,
}: {
  children: ReactNode
  onDelete: () => void
  deleteLabel: string
}) {
  const x = useMotionValue(0)
  const actionOpacity = useTransform(x, [-ACTION_WIDTH, -20, 0], [1, 0.3, 0])
  const actionScale = useTransform(x, [-ACTION_WIDTH, -20], [1, 0.6])

  return (
    <div className="relative overflow-hidden">
      <motion.div
        style={{ opacity: actionOpacity }}
        className="absolute inset-y-0 right-0 flex w-[84px] items-center justify-center bg-coral"
      >
        <Pressable
          aria-label={deleteLabel}
          feedback="none"
          onPress={onDelete}
          className="grid size-full place-items-center text-white"
        >
          <motion.span style={{ scale: actionScale }}>
            <Trash size={22} weight="bold" />
          </motion.span>
        </Pressable>
      </motion.div>
      <motion.div
        style={{ x, touchAction: 'pan-y' }}
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        dragConstraints={{ left: -ACTION_WIDTH * 4, right: 0 }}
        dragElastic={{ left: 0.1, right: 0 }}
        onDragEnd={(_, info) => {
          const offset = x.get()
          if (offset < -ACTION_WIDTH * 2.4 || info.velocity.x < -1200) {
            haptics.warn()
            onDelete()
            return
          }
          const open = offset < -ACTION_WIDTH / 2 || info.velocity.x < -300
          animate(x, open ? -ACTION_WIDTH : 0, SNAPPY)
        }}
        className="relative bg-canvas"
      >
        {children}
      </motion.div>
    </div>
  )
}
