import { motion } from 'motion/react'
import { BOUNCY } from './motion'

/** The two circles drifting together, then the little "us" in the middle. */
export function AnimatedLogo({ size = 112 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden>
      <motion.circle
        cx={206}
        cy={256}
        r={128}
        fill="var(--coral)"
        initial={{ x: -64, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={BOUNCY}
      />
      <motion.circle
        cx={306}
        cy={256}
        r={128}
        fill="var(--sage)"
        initial={{ x: 64, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...BOUNCY, delay: 0.08 }}
      />
      <motion.path
        d="M256 138.17A128 128 0 0 1 256 373.83A128 128 0 0 1 256 138.17Z"
        fill="var(--lilac)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...BOUNCY, delay: 0.42 }}
      />
    </svg>
  )
}
