# Supabase Storage (lesson audio)

1. In [Supabase Dashboard](https://supabase.com/dashboard) → **Storage** → **New bucket**.
2. Name it `hone-audio` (or set `SUPABASE_STORAGE_BUCKET` to match).
3. For **public** playback URLs in the mobile app:
   - Either mark the bucket **public**, or  
   - Use **policies** so `anon` / `authenticated` can `select` objects, and uploads go through your backend with the **service role** key only.
4. Copy **Project URL** → `SUPABASE_URL`.
5. **Settings → API → service_role** (secret) → `SUPABASE_SERVICE_ROLE_KEY` in `.env` (never commit; server-only).

After upload, `getPublicUrl` is used. Private buckets require switching to **signed URLs** in `supabaseStorage.ts` and refreshing URLs in the app.
