import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '../config'

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }
  if (!_client) {
    _client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _client
}

/**
 * Upload a file to Supabase Storage and return a public URL.
 * Create a **public** bucket (or use signed URLs later) so the mobile app can play audio.
 */
export async function uploadToSupabaseStorage(
  objectPath: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const supabase = getClient()
  const bucket = config.SUPABASE_STORAGE_BUCKET

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, body, {
      contentType,
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Supabase upload failed: ${uploadError.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath)
  if (!data?.publicUrl) {
    throw new Error('Supabase getPublicUrl returned no URL')
  }
  return data.publicUrl
}

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY)
}
