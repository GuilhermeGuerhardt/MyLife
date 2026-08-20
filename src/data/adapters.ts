/**
 * Camada de persistência.
 *
 * Uma única interface (`Collection`) com duas implementações: localStorage e
 * Supabase. A aplicação nunca sabe qual está ativa — isso permite rodar o app
 * inteiro offline antes de existir projeto no Supabase, e trocar depois sem
 * mexer em nenhuma tela.
 */

import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import type { BaseRow } from './types'

export interface Collection<T extends BaseRow> {
  list(): Promise<T[]>
  insert(item: Omit<T, keyof BaseRow> & Partial<BaseRow>): Promise<T>
  update(id: string, patch: Partial<T>): Promise<T>
  remove(id: string): Promise<void>
  replaceAll(items: T[]): Promise<void>
}

const PREFIX = 'life:table:'

function readLocal<T>(table: string): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + table)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function writeLocal<T>(table: string, rows: T[]): void {
  localStorage.setItem(PREFIX + table, JSON.stringify(rows))
}

function localCollection<T extends BaseRow>(table: string): Collection<T> {
  return {
    async list() {
      return readLocal<T>(table)
    },
    async insert(item) {
      const now = new Date().toISOString()
      const row = { id: uid(), created_at: now, updated_at: now, ...item } as unknown as T
      const rows = readLocal<T>(table)
      rows.push(row)
      writeLocal(table, rows)
      return row
    },
    async update(id, patch) {
      const rows = readLocal<T>(table)
      const index = rows.findIndex((r) => r.id === id)
      if (index === -1) throw new Error(`Registro ${id} não encontrado em ${table}`)
      const updated = { ...rows[index]!, ...patch, updated_at: new Date().toISOString() }
      rows[index] = updated
      writeLocal(table, rows)
      return updated
    },
    async remove(id) {
      writeLocal(
        table,
        readLocal<T>(table).filter((r) => r.id !== id),
      )
    },
    async replaceAll(items) {
      writeLocal(table, items)
    },
  }
}

function cloudCollection<T extends BaseRow>(table: string): Collection<T> {
  const client = supabase!
  return {
    async list() {
      const { data, error } = await client.from(table).select('*')
      if (error) throw error
      return (data ?? []) as T[]
    },
    async insert(item) {
      const { data: auth } = await client.auth.getUser()
      const payload = { ...item, user_id: auth.user?.id ?? null }
      const { data, error } = await client.from(table).insert(payload).select().single()
      if (error) throw error
      return data as T
    },
    async update(id, patch) {
      const { data, error } = await client
        .from(table)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as T
    },
    async remove(id) {
      const { error } = await client.from(table).delete().eq('id', id)
      if (error) throw error
    },
    async replaceAll(items) {
      const { error } = await client.from(table).upsert(items)
      if (error) throw error
    },
  }
}

export function collection<T extends BaseRow>(table: string): Collection<T> {
  return supabase ? cloudCollection<T>(table) : localCollection<T>(table)
}
