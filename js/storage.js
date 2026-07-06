import { supabase } from './supabase-client.js'

const BUCKET = 'documents'

/**
 * Uploads a file to the private `documents` bucket under the required
 * `{user_id}/...` path convention (enforced by storage RLS policies).
 * Returns the storage path to save in a *_url column.
 */
export async function uploadDocument(userId, file, label) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const path = `${userId}/${label}-${Date.now()}-${safeName}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error

  return path
}

/**
 * Generates a short-lived signed URL to view/download a private document.
 * Returns null if the path is empty or the user isn't allowed to read it
 * (storage RLS still applies here — this doesn't bypass anything).
 */
export async function getSignedUrl(path, expiresInSeconds = 300) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds)
  if (error) return null
  return data.signedUrl
}
