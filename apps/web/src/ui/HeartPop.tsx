import { Heart } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useUi } from '../state/ui'

const COLORS = ['var(--coral)', 'var(--sage)', 'var(--lilac)', 'var(--honey)', 'var(--coral)']

/** A tiny burst of hearts when something is saved. */
export function HeartPop() {
  const hearts = useUi((s) => s.hearts)
  const [bursts, setBursts] = useState<number[]>([])

  useEffect(() => {
    if (!hearts) return
    setBursts((b) => [...b, hearts])
    const timer = window.setTimeout(() => setBursts((b) => b.filter((x) => x !== hearts)), 1400)
    return () => window.clearTimeout(timer)
  }, [hearts])

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden>
      {bursts.map((burst) => (
        <div key={burst} className="absolute left-1/2 top-[58%]">
          {COLORS.map((color, i) => {
            const angle = -90 + (i - 2) * 26
            const distance = 90 + (i % 2) * 40
            const rad = (angle * Math.PI) / 180
            return (
              <motion.span
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative set
                key={i}
                className="absolute -ml-4 -mt-4"
                initial={{ x: 0, y: 0, scale: 0.2, opacity: 0 }}
                animate={{
                  x: Math.cos(rad) * distance,
                  y: Math.sin(rad) * distance,
                  scale: [0.2, 1.25, 1],
                  opacity: [0, 1, 0],
                }}
                transition={{ duration: 1.1, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                style={{ color }}
              >
                <Heart size={32} weight="fill" />
              </motion.span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
