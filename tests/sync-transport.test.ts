import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseTransport } from '../src/sync/supabase'

const batch = { operationId: 'operation', changes: [], generations: {} }

test('a sync request pins the verified account token to the RPC', async () => {
  let header = ''
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'account-a' }, access_token: 'test-token' } }, error: null }) },
    rpc: () => ({ setHeader: (name: string, value: string) => { header = `${name}: ${value}`; return Promise.resolve({ data: { status: 'ok', records: [] }, error: null }) } }),
  } as unknown as SupabaseClient
  await supabaseTransport(client, 'account-a').push(batch)
  assert.equal(header, 'Authorization: Bearer test-token')
})

test('sync refuses to send another account’s workspace after an account switch', async () => {
  let sent = false
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'account-b' }, access_token: 'test-token' } }, error: null }) },
    rpc: () => { sent = true; throw new Error('Should not send') },
  } as unknown as SupabaseClient
  await assert.rejects(supabaseTransport(client, 'account-a').push(batch), /account changed/)
  assert.equal(sent, false)
})
