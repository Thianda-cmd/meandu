import { ImageSquare } from '@phosphor-icons/react'
import { useState } from 'react'
import { cx } from '../../lib/cx'
import { usePhoto } from '../../lib/photos'
import type { Photo } from '../../state/types'

/** A memory photo: shimmers while loading, fades in, and stays calm when it isn't on this phone. */
export function PhotoView({
  photo,
  alt,
  className,
}: {
  photo: Photo | undefined
  alt: string
  className?: string
}) {
  const state = usePhoto(photo)
  const [shown, setShown] = useState(false)

  if (photo?.kind === 'gradient') {
    return (
      <div
        role="img"
        aria-label={alt}
        className={className}
        style={{ background: `radial-gradient(120% 90% at 20% 15%, ${photo.from}, ${photo.to})` }}
      />
    )
  }

  if (state.status === 'missing') {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cx('grid place-items-center bg-surface-2 text-ink-3', className)}
      >
        <ImageSquare size={36} weight="duotone" />
      </div>
    )
  }

  return (
    // No position of its own: callers place it (e.g. `absolute inset-0` in the grid), and a
    // `relative` here would win over theirs.
    <div className={cx('overflow-hidden', !shown && 'skeleton', className)}>
      {state.status === 'ready' && (
        <img
          src={state.url}
          alt={alt}
          draggable={false}
          onLoad={() => setShown(true)}
          className={cx(
            'size-full object-cover transition-opacity duration-300',
            shown ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  )
}
