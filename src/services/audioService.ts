import { uploadToSupabaseStorage } from '../lib/supabaseStorage'

export async function uploadAudio(
  techniqueId: string,
  audioBuffer: Buffer,
  format: 'lecture' | 'podcast'
): Promise<string> {
  const objectPath = `audio/${techniqueId}/${format}.mp3`
  return uploadToSupabaseStorage(objectPath, audioBuffer, 'audio/mpeg')
}
