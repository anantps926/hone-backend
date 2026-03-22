import { z } from 'zod'
import dotenv from 'dotenv'
dotenv.config()

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  // LLM provider selection
  LLM_PROVIDER: z.enum(['anthropic', 'gemini', 'grok', 'groq']).default('anthropic'),
  // Anthropic
  ANTHROPIC_API_KEY: z.string().optional(),
  // Gemini
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_PLAN_MODEL: z.string().default('gemini-1.5-pro-latest'),
  GEMINI_CONTENT_MODEL: z.string().default('gemini-1.5-pro-latest'),
  GEMINI_ASK_MODEL: z.string().default('gemini-1.5-flash-latest'),
  // Grok / xAI (OpenAI-compatible Chat Completions at api.x.ai)
  /** Prefer official name; falls back to GROK_API_KEY in code if unset */
  XAI_API_KEY: z.string().optional(),
  GROK_API_KEY: z.string().optional(),
  GROK_API_BASE: z.string().default('https://api.x.ai/v1'),
  GROK_PLAN_MODEL: z.string().default('grok-3-latest'),
  GROK_CONTENT_MODEL: z.string().default('grok-3-latest'),
  GROK_ASK_MODEL: z.string().default('grok-3-latest'),
  // Groq (OpenAI-compatible Chat Completions at api.groq.com)
  GROQ_API_KEY: z.string().optional(),
  GROQ_API_BASE: z.string().default('https://api.groq.com/openai/v1'),
  GROQ_PLAN_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GROQ_CONTENT_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GROQ_ASK_MODEL: z.string().default('llama-3.1-8b-instant'),
  YOUTUBE_API_KEY: z.string().min(1),
  // When skipping Clerk (local dev), these may be blank.
  CLERK_SECRET_KEY: z.string().min(1).optional().default(''),
  /** Supabase project URL, e.g. https://xxxx.supabase.co */
  SUPABASE_URL: z.string().optional().default(''),
  /** Service role key (server only) — used for Storage uploads */
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  /** Storage bucket name (create in Supabase Dashboard → Storage) */
  SUPABASE_STORAGE_BUCKET: z.string().default('hone-audio'),
  SKIP_CLERK_AUTH: z.coerce.boolean().default(false),
  PLAN_CACHE_TTL: z.coerce.number().default(604800),
  WORD_CACHE_TTL: z.coerce.number().default(2592000),
  VIDEO_CACHE_TTL: z.coerce.number().default(2592000),
  RATE_LIMIT_MAX_PLAN: z.coerce.number().default(5),
  RATE_LIMIT_MAX_CONTENT: z.coerce.number().default(20),
}).superRefine((val, ctx) => {
  if (val.LLM_PROVIDER === 'anthropic' && (!val.ANTHROPIC_API_KEY || val.ANTHROPIC_API_KEY.trim().length === 0)) {
    ctx.addIssue({
      code: 'custom',
      path: ['ANTHROPIC_API_KEY'],
      message: 'ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic',
    })
  }
  if (val.LLM_PROVIDER === 'gemini' && (!val.GEMINI_API_KEY || val.GEMINI_API_KEY.trim().length === 0)) {
    ctx.addIssue({
      code: 'custom',
      path: ['GEMINI_API_KEY'],
      message: 'GEMINI_API_KEY is required when LLM_PROVIDER=gemini',
    })
  }
  const xaiKey =
    (val.XAI_API_KEY && val.XAI_API_KEY.trim()) || (val.GROK_API_KEY && val.GROK_API_KEY.trim()) || ''
  if (val.LLM_PROVIDER === 'grok' && xaiKey.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['XAI_API_KEY'],
      message: 'XAI_API_KEY or GROK_API_KEY is required when LLM_PROVIDER=grok',
    })
  }
  if (val.LLM_PROVIDER === 'groq' && (!val.GROQ_API_KEY || val.GROQ_API_KEY.trim().length === 0)) {
    ctx.addIssue({
      code: 'custom',
      path: ['GROQ_API_KEY'],
      message: 'GROQ_API_KEY is required when LLM_PROVIDER=groq',
    })
  }
})

export const config = envSchema.parse(process.env)
export type Config = typeof config
