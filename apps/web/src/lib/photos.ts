import { uuidv7 } from '@meandu/core'
import { get, set } from 'idb-keyval'
import { useEffect, useState } from 'react'
import type { Photo } from '../state/types'

const MAX_EDGE = 1600

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
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.82),
  )
  const id = uuidv7()
  await set(`photo:${id}`, blob)
  return { id, kind: 'blob', width, height }
}

/** A URL for showing a stored photo; `undefined` while loading and for gradient placeholders. */
export function usePhotoUrl(photo: Photo | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  const id = photo?.kind === 'blob' ? photo.id : undefined

  useEffect(() => {
    if (!id) return
    let objectUrl: string | undefined
    let cancelled = false
    get<Blob>(`photo:${id}`).then((blob) => {
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setUrl(undefined)
    }
  }, [id])

  return url
}
