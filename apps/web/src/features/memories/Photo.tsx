import { cx } from '../../lib/cx'
import { usePhotoUrl } from '../../lib/photos'
import type { Photo } from '../../state/types'

/** A memory photo, or a soft gradient for the demo ones. */
export function PhotoView({
  photo,
  alt,
  className,
}: {
  photo: Photo | undefined
  alt: string
  className?: string
}) {
  const url = usePhotoUrl(photo)

  if (photo?.kind === 'blob') {
    return (
      <div className={cx('bg-surface-2', className)}>
        {url && <img src={url} alt={alt} draggable={false} className="size-full object-cover" />}
      </div>
    )
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={className}
      style={{
        background: photo
          ? `radial-gradient(120% 90% at 20% 15%, ${photo.from}, ${photo.to})`
          : 'var(--surface-2)',
      }}
    />
  )
}
