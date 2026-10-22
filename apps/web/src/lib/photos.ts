import { uuidv7 } from '@meandu/core'
import { delMany, get, keys, set } from 'idb-keyval'
import { useEffect, useState } from 'react'
import type { Photo } from '../state/types'

const MAX_EDGE = 1600

const PREFIX = 'photo:'
const keyOf = (id: string) => `${PREFIX}${id}`

/** When a photo was added: its id is a UUIDv7, which starts with the time in milliseconds. */
const addedAt = (id: string) => Number.parseInt(id.replaceAll('-', '').slice(0, 12), 16)

/**
 * Shrinks a picked photo on the device before keeping it. Re-encoding also drops the
 * photo's metadata, including its GPS location.
 */
export async function storePhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context) {
    // JPEG has no see-through parts; without this, transparent ones turn black.
    context.fillStyle = '#fff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
  }
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.82),
  )
  const id = uuidv7()
  await set(keyOf(id), blob)
  return { id, kind: 'blob', width, height }
}

/** Deletes photos from this phone, e.g. ones taken out of a memory. */
export async function forgetPhotos(photos: Photo[]): Promise<void> {
  await delMany(photos.filter((p) => p.kind === 'blob').map((p) => keyOf(p.id)))
}

/**
 * Deletes the photos on this phone except the ones in `keep`. With `before`, only ones added
 * before then, since a photo being added right now isn't in a memory yet.
 */
export async function forgetPhotosExcept(
  keep: ReadonlySet<string>,
  before = Number.POSITIVE_INFINITY,
): Promise<void> {
  const ids = (await keys())
    .filter((key): key is string => typeof key === 'string' && key.startsWith(PREFIX))
    .map((key) => key.slice(PREFIX.length))
  await delMany(ids.filter((id) => !keep.has(id) && addedAt(id) < before).map(keyOf))
}

export type PhotoState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  /** Photos only live on the phone that took them until photo sync exists. */
  | { status: 'missing' }

/** Loads a stored photo for showing. Gradient placeholders count as missing. */
export function usePhoto(photo: Photo | undefined): PhotoState {
  const id = photo?.kind === 'blob' ? photo.id : undefined
  const [state, setState] = useState<PhotoState>(id ? { status: 'loading' } : { status: 'missing' })

  useEffect(() => {
    if (!id) {
      setState({ status: 'missing' })
      return
    }
    let objectUrl: string | undefined
    let cancelled = false
    setState({ status: 'loading' })
    get<Blob>(keyOf(id))
      .then((blob) => {
        if (cancelled) return
        if (!blob) return setState({ status: 'missing' })
        objectUrl = URL.createObjectURL(blob)
        setState({ status: 'ready', url: objectUrl })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'missing' })
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])

  return state
}
