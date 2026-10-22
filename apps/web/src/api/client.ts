import type { AccountInfo, InviteInfo, SpaceState, SyncRequest, SyncResponse } from '@meandu/core'
import { useSettings } from '../state/settings'

/** A failed API call. `code` is the server's stable error code (or `offline` / `server`). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code)
  }
}

export async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      // The language goes along so emails arrive in the language the app is in.
      headers: {
        'x-lang': useSettings.getState().lang,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError(0, 'offline')
  }
  const json = (await res.json().catch(() => null)) as { error?: string; code?: string } | null
  // Our endpoints answer { error }, the sign-in ones { code }.
  if (!res.ok) throw new ApiError(res.status, json?.error ?? json?.code ?? 'server')
  return json as T
}

export const api = {
  /** The current session, or null when this device has no account yet. */
  session: () => call<{ user: { id: string } } | null>('/auth/get-session'),
  signInAnonymously: () => call<{ user: { id: string } }>('/auth/sign-in/anonymous', {}),
  space: () => call<SpaceState>('/space'),
  createSpace: (input: { name: string; tone: string; togetherSince: string | null }) =>
    call<SpaceState>('/space', input),
  invite: () => call<InviteInfo>('/space/invite', {}),
  join: (input: { code: string; name: string; tone: string }) =>
    call<SpaceState>('/space/join', input),
  /** Pauses the space for both of you. */
  unlink: () => call<SpaceState>('/space/unlink', {}),
  /** Says yes to relinking; the space is back once both of you have. */
  relink: () => call<SpaceState>('/space/relink', {}),
  /** Deletes the space and everything in it, for both of you. */
  deleteSpace: () => call<{ ok: true }>('/space/delete', {}),
  sync: (request: SyncRequest) => call<SyncResponse>('/sync', request),
  config: () => call<{ email: boolean }>('/config'),
  account: () => call<AccountInfo>('/account'),
  deleteAccount: () => call<{ ok: true }>('/account/delete', {}),
}

/** Makes sure this device has an account, creating an anonymous one on first use. */
export async function ensureAccount(): Promise<string> {
  const current = await api.session()
  if (current?.user) return current.user.id
  const created = await api.signInAnonymously()
  return created.user.id
}
