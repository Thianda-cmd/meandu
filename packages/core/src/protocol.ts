/** What the app and the server say to each other. Types only, shared by both sides. */

export type RecordKind = 'event' | 'list' | 'item' | 'memory' | 'person' | 'settings'

export interface Mutation {
  kind: RecordKind
  id: string
  /** `put` merges `data` into the record (creating it if needed); `delete` leaves a tombstone. */
  op: 'put' | 'delete'
  data?: Record<string, unknown>
}

export interface SyncRequest {
  /** The last version this device has seen; 0 for everything. */
  since: number
  /** The space `since` belongs to. After moving to another space the server starts from 0. */
  spaceId?: string | null
  mutations: Mutation[]
}

export interface RemoteRecord {
  kind: RecordKind
  id: string
  /** Missing when the record was deleted or isn't visible to this person. */
  data?: Record<string, unknown>
  deleted: boolean
}

export interface SyncResponse {
  spaceId: string
  /** Pass this as `since` next time. */
  version: number
  records: RemoteRecord[]
  /** More changes are waiting; sync again right away. */
  more: boolean
}

export interface SpaceMember {
  userId: string
  role: 'owner' | 'member'
}

export interface SpaceState {
  spaceId: string
  userId: string
  status: 'active' | 'paused'
  members: SpaceMember[]
}

export interface InviteInfo {
  code: string
  expiresAt: string
}
