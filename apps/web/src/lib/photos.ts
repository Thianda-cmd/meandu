import { uuidv7 } from '@meandu/core'
import { del, delMany, get, keys, set, setMany } from 'idb-keyval'
import { useEffect, useState } from 'react'
import { useData } from '../state/data'
import type { Photo } from '../state/types'
import { useSync } from '../sync/engine'

/** The photo itself stays on the phone it was added on, at this size. */
const FULL_EDGE = 1600
/** A smaller copy goes to the server, so your person (and your other phones) see it too. */
const PREVIEW_EDGE = 960

// What's stored per photo id: the full photo (`photo:`) where it was added, its preview
// until it's been sent (`upload:`), and previews fetched for photos added elsewhere (`cloud:`).
const PREFIXES = ['photo:', 'upload:', 'cloud:']
const full = (id: string) => `photo:${id}`
const pending = (id: string) => `upload:${id}`
const fetched = (id: string) => `cloud:${id}`

/** When a photo was added: its id is a UUIDv7, which starts with the time in milliseconds. */
const addedAt = (id: string) => Number.parseInt(id.replaceAll('-', '').slice(0, 12), 16)

/** The ids of everything stored under one of `prefixes`. */
async function storedIds(prefixes: string[]): Promise<{ key: string; id: string }[]> {
  return (await keys()).flatMap((key) => {
    if (typeof key !== 'string') return []
    const prefix = prefixes.find((p) => key.startsWith(p))
    return prefix ? [{ key, id: key.slice(prefix.length) }] : []
  })
}

/**
 * Draws a photo at most `maxEdge` wide or tall. Re-encoding also drops its metadata,
 * including where it was taken.
 */
async function encode(bitmap: ImageBitmap, maxEdge: number, type: string, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
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
  const toBlob = (as: string) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), as, quality),
    )
  let blob = await toBlob(type)
  // A browser that can't write WebP hands back a (big) PNG instead.
  if (blob.type !== type) blob = await toBlob('image/jpeg')
  return { blob, width, height }
}

const preview = (bitmap: ImageBitmap) => encode(bitmap, PREVIEW_EDGE, 'image/webp', 0.72)

/** Keeps a picked photo on this phone, with a preview waiting to be sent. */
export async function storePhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file)
  try {
    const kept = await encode(bitmap, FULL_EDGE, 'image/jpeg', 0.82)
    const small = await preview(bitmap)
    const id = uuidv7()
    await setMany([
      [full(id), kept.blob],
      [pending(id), small.blob],
    ])
    return { id, kind: 'blob', width: kept.width, height: kept.height }
  } finally {
    bitmap.close()
  }
}

/** Deletes photos from this phone, e.g. ones taken out of a memory. */
export async function forgetPhotos(photos: Photo[]): Promise<void> {
  const ids = photos.filter((p) => p.kind === 'blob').map((p) => p.id)
  await delMany(ids.flatMap((id) => [full(id), pending(id), fetched(id)]))
}

/**
 * Deletes the photos on this phone except the ones in `keep`. With `before`, only ones added
 * before then, since a photo being added right now isn't in a memory yet.
 */
export async function forgetPhotosExcept(
  keep: ReadonlySet<string>,
  before = Number.POSITIVE_INFINITY,
): Promise<void> {
  const stored = await storedIds(PREFIXES)
  await delMany(
    stored.filter(({ id }) => !keep.has(id) && addedAt(id) < before).map(({ key }) => key),
  )
}

let uploading: Promise<void> | null = null

/**
 * Sends the waiting previews of photos in `used` memories, oldest first, one at a time.
 * Stops at the first that can't go (offline, unlinked…); the next sync tries again.
 */
export function uploadPreviews(used: ReadonlySet<string>): Promise<void> {
  uploading ??= (async () => {
    for (const { id } of await storedIds(['upload:'])) {
      if (!used.has(id)) continue
      const blob = await get<Blob>(pending(id))
      if (!blob) continue
      let res: Response
      try {
        res = await fetch(`/api/photos/${id}`, {
          method: 'PUT',
          headers: { 'content-type': blob.type },
          body: blob,
          credentials: 'same-origin',
        })
      } catch {
        return
      }
      // Sent, or never going to be taken: done with it either way.
      if (res.ok || res.status === 400 || res.status === 413 || res.status === 415) {
        await del(pending(id))
      } else {
        return
      }
    }
  })().finally(() => {
    uploading = null
  })
  return uploading
}

/** Photos added before previews existed get one, once, so your person sees them too. */
export async function queueOlderPreviews(used: ReadonlySet<string>): Promise<void> {
  const done = 'meandu-previews'
  try {
    if (localStorage.getItem(done)) return
  } catch {
    return
  }
  const waiting = new Set((await storedIds(['upload:'])).map(({ id }) => id))
  for (const { id } of await storedIds(['photo:'])) {
    if (!used.has(id) || waiting.has(id)) continue
    const blob = await get<Blob>(full(id))
    if (!blob) continue
    try {
      const bitmap = await createImageBitmap(blob)
      try {
        await set(pending(id), (await preview(bitmap)).blob)
      } finally {
        bitmap.close()
      }
    } catch {}
  }
  try {
    localStorage.setItem(done, '1')
  } catch {}
}

const loading = new Map<string, Promise<Blob | null>>()
const missedAt = new Map<string, number>()

/** A photo: the full one if it was added here, else its preview, fetched once and kept. */
function loadPhoto(id: string, fromServer: boolean): Promise<Blob | null> {
  let job = loading.get(id)
  if (job) return job
  job = (async () => {
    const here = (await get<Blob>(full(id))) ?? (await get<Blob>(fetched(id)))
    if (here || !fromServer) return here ?? null
    // Not on the server yet (your person's phone may still be sending it): ask again later.
    if (Date.now() - (missedAt.get(id) ?? 0) < 15_000) return null
    try {
      const res = await fetch(`/api/photos/${id}`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error(`photo ${res.status}`)
      const blob = await res.blob()
      await set(fetched(id), blob)
      return blob
    } catch {
      missedAt.set(id, Date.now())
      return null
    }
  })().finally(() => loading.delete(id))
  loading.set(id, job)
  return job
}

export type PhotoState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  /** Not on this phone, and not on the server (yet). */
  | { status: 'missing' }

/** Loads a photo for showing. Gradient placeholders count as missing. */
export function usePhoto(photo: Photo | undefined): PhotoState {
  const id = photo?.kind === 'blob' ? photo.id : undefined
  const fromServer = useData((s) => s.mode === 'synced')
  const [state, setState] = useState<PhotoState>(id ? { status: 'loading' } : { status: 'missing' })

  useEffect(() => {
    if (!id) {
      setState({ status: 'missing' })
      return
    }
    let objectUrl: string | undefined
    let cancelled = false
    let stopWaiting = () => {}

    const show = async () => {
      const blob = await loadPhoto(id, fromServer)
      if (cancelled) return true
      if (!blob) {
        setState({ status: 'missing' })
        return false
      }
      objectUrl = URL.createObjectURL(blob)
      setState({ status: 'ready', url: objectUrl })
      return true
    }

    setState({ status: 'loading' })
    void show().then((shown) => {
      if (shown || cancelled || !fromServer) return
      // Not here yet: look again after each sync until it is.
      stopWaiting = useSync.subscribe((s, previous) => {
        if (s.lastSyncedAt === previous.lastSyncedAt) return
        void show().then((now) => {
          if (now) stopWaiting()
        })
      })
    })

    return () => {
      cancelled = true
      stopWaiting()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, fromServer])

  return state
}
