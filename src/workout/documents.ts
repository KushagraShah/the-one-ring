/** Record shapes shared by current online storage and the preserved legacy sync. */
export type Kind = 'exercise' | 'routine' | 'workout' | 'session' | 'settings'
export type Document = { kind: Kind; id: string; body: Record<string, unknown> | null; deleted: boolean }
export type StoredDocument = Document & { revision: number; generation: number; dirty: boolean }
