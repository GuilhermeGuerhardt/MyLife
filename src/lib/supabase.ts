import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * O cliente só existe quando as variáveis estão configuradas. Sem elas o app
 * roda inteiro no adaptador local (localStorage), o que deixa desenvolver e
 * testar sem depender de rede — e é o modo em que ele já sobe hoje.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null

export const isCloudEnabled = supabase !== null
