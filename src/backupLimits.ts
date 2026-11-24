// Limits apply to UTF-8 JSON, independently of the server's JSONB request limit.
export const WORKSPACE_LIMIT = 50_000_000
export const BACKUP_FILE_LIMIT = 200_000_000
export const FULL_BACKUP_FILE_LIMIT = 600_000_000
export const utf8Bytes = (text: string) => new TextEncoder().encode(text).length
