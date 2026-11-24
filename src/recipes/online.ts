import type { SupabaseClient } from '@supabase/supabase-js'
import { emptyRecipes, parseRecipeData, type RecipeData } from './model'

export type SaveStatus = 'saved' | 'saving' | 'error' | 'conflict'
type Request = { operation: string; revision: number; serialized: string }
export class OnlineRecipeStore {
  private revision = 0
  private saved = ''
  private desired = ''
  private pending: Request | null = null
  private busy = false
  private status: SaveStatus = 'saved'
  onStatus: (status: SaveStatus) => void = () => {}
  getStatus() { return this.status }
  constructor(private client: SupabaseClient, private owner: string) {}
  async load() {
    const { data, error } = await this.client.rpc('tor_online_recipe_read', { p_owner: this.owner })
    if (error) throw error
    if (!data || !Number.isSafeInteger(data.revision) || data.revision < 0 || (data.revision === 0 && data.data !== null)) throw Error('Invalid recipe response')
    this.revision = data.revision
    const result = data.revision === 0 ? emptyRecipes() : parseRecipeData(JSON.stringify(data.data))
    this.saved = this.desired = JSON.stringify(result)
    return result
  }
  update(data: RecipeData) { this.desired = JSON.stringify(data); if (this.status !== 'error' && this.status !== 'conflict') void this.flush() }
  retry() { if (this.status !== 'conflict') void this.flush() }
  private setStatus(status: SaveStatus) { this.status = status; this.onStatus(status) }
  private async flush() {
    if (this.busy || (!this.pending && this.saved === this.desired)) return
    this.busy = true; this.setStatus('saving')
    try {
      while (this.pending || this.saved !== this.desired) {
        const request = this.pending || { operation: crypto.randomUUID(), revision: this.revision, serialized: this.desired }
        this.pending = request
        const { data, error } = await this.client.rpc('tor_online_recipe_write', { p_owner: this.owner, p_revision: request.revision, p_operation: request.operation, p_data: JSON.parse(request.serialized) })
        if (error) throw error
        if (data?.status === 'conflict') { this.setStatus('conflict'); return }
        if (data?.status !== 'ok' || data.revision !== request.revision + 1) throw Error('Invalid save response')
        this.revision = data.revision; this.saved = request.serialized; this.pending = null
      }
      this.setStatus('saved')
    } catch { this.setStatus('error') } finally { this.busy = false }
  }
}
