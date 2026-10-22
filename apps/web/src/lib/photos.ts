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
    get<Blob>(`photo:${id}`)
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
