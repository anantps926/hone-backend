import { config } from '../config'
import { getAnthropicClient, OPUS_MODEL, SONNET_MODEL } from './anthropic'

type Role = 'user' | 'assistant'
export type ChatMessage = { role: Role; content: string }

function chunkText(text: string, chunkSize = 60) {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize))
  }
  return chunks
}

function collectAllTextFields(value: unknown, out: string[]) {
  if (value == null) return
  if (typeof value === 'string') return
  if (Array.isArray(value)) {
    for (const v of value) collectAllTextFields(v, out)
    return
  }
  if (typeof value !== 'object') return
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === 'text' && typeof v === 'string') out.push(v)
    else collectAllTextFields(v, out)
  }
}

export function extractGeminiTextFromResponse(json: any): string {
  const candidates = json?.candidates
  const first = Array.isArray(candidates) ? candidates[0] : undefined

  // Preferred shape: candidates[0].content.parts[].text
  const parts = first?.content?.parts
  if (Array.isArray(parts)) {
    const fromParts = parts
      .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('')
    if (fromParts.trim().length > 0) return fromParts
  }

  // Fallback: brute-force collect all "text" fields in the response.
  const out: string[] = []
  collectAllTextFields(json, out)
  const joined = out.filter(Boolean).join('')
  return joined
}

async function geminiGenerateText(args: {
  model: string
  prompt: string
  maxTokens: number
}): Promise<string> {
  const apiKey = config.GEMINI_API_KEY
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('GEMINI_API_KEY is required when LLM_PROVIDER=gemini')
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    args.model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: args.prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: args.maxTokens,
        temperature: 0.2,
        // Best-effort hint for structured output. If ignored, we still parse defensively.
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Gemini request failed: ${resp.status} ${text}`)
  }

  const json = (await resp.json()) as any
  const text = extractGeminiTextFromResponse(json)

  if (!text || text.trim().length === 0) {
    throw new Error('Gemini returned empty text (no extractable "text" fields)')
  }
  return text
}

async function geminiGenerateChatText(args: {
  model: string
  systemPrompt: string
  messages: ChatMessage[]
  maxTokens: number
}): Promise<string> {
  const conversation = args.messages
    .slice(-12)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n')

  const prompt = `${args.systemPrompt}\n\n${conversation}\n\nASSISTANT:`
  return geminiGenerateText({ model: args.model, prompt, maxTokens: args.maxTokens })
}

function xaiApiKey(): string {
  return (config.XAI_API_KEY || config.GROK_API_KEY || '').trim()
}

type OpenAiStyleMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/**
 * OpenAI-compatible POST .../chat/completions (used by xAI Grok, Groq, etc.).
 */
async function openAiCompatibleChatCompletion(args: {
  baseUrl: string
  apiKey: string
  providerLabel: string
  model: string
  messages: OpenAiStyleMessage[]
  maxTokens: number
  /** Prefer JSON for plan / content / explain pipelines */
  responseJsonObject?: boolean
}): Promise<string> {
  const base = args.baseUrl.replace(/\/$/, '')
  const url = `${base}/chat/completions`

  const body: Record<string, unknown> = {
    model: args.model,
    messages: args.messages,
    max_tokens: args.maxTokens,
    temperature: 0.2,
    stream: false,
  }
  if (args.responseJsonObject) {
    body.response_format = { type: 'json_object' }
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`${args.providerLabel} request failed: ${resp.status} ${text}`)
  }

  const json = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
    error?: { message?: string }
  }

  if (json.error?.message) {
    throw new Error(`${args.providerLabel} API error: ${json.error.message}`)
  }

  const content = json.choices?.[0]?.message?.content
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error(`${args.providerLabel} returned empty content`)
  }
  return content
}

/**
 * xAI Grok via OpenAI-compatible POST /v1/chat/completions.
 * @see https://docs.x.ai/docs/guides/chat-completions
 */
async function grokChatCompletion(args: {
  model: string
  messages: OpenAiStyleMessage[]
  maxTokens: number
  responseJsonObject?: boolean
}): Promise<string> {
  const apiKey = xaiApiKey()
  if (!apiKey) {
    throw new Error('XAI_API_KEY or GROK_API_KEY is required when LLM_PROVIDER=grok')
  }

  return openAiCompatibleChatCompletion({
    baseUrl: config.GROK_API_BASE,
    apiKey,
    providerLabel: 'Grok (xAI)',
    model: args.model,
    messages: args.messages,
    maxTokens: args.maxTokens,
    responseJsonObject: args.responseJsonObject,
  })
}

/**
 * Groq via OpenAI-compatible API.
 * @see https://console.groq.com/docs/openai
 */
async function groqChatCompletion(args: {
  model: string
  messages: OpenAiStyleMessage[]
  maxTokens: number
  responseJsonObject?: boolean
}): Promise<string> {
  const apiKey = (config.GROQ_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is required when LLM_PROVIDER=groq')
  }

  return openAiCompatibleChatCompletion({
    baseUrl: config.GROQ_API_BASE,
    apiKey,
    providerLabel: 'Groq',
    model: args.model,
    messages: args.messages,
    maxTokens: args.maxTokens,
    responseJsonObject: args.responseJsonObject,
  })
}

export async function generateUserPromptText(args: {
  purpose: 'plan' | 'content' | 'explain'
  prompt: string
  maxTokens: number
  onStream?: (chunk: string) => void
}): Promise<string> {
  if (config.LLM_PROVIDER === 'gemini') {
    const model =
      args.purpose === 'plan'
        ? config.GEMINI_PLAN_MODEL
        : args.purpose === 'explain'
          ? config.GEMINI_CONTENT_MODEL
          : config.GEMINI_CONTENT_MODEL

    const full = await geminiGenerateText({ model, prompt: args.prompt, maxTokens: args.maxTokens })
    if (args.onStream) {
      for (const chunk of chunkText(full, 80)) args.onStream(chunk)
    }
    return full
  }

  if (config.LLM_PROVIDER === 'grok') {
    const model =
      args.purpose === 'plan' ? config.GROK_PLAN_MODEL : config.GROK_CONTENT_MODEL
    const full = await grokChatCompletion({
      model,
      messages: [{ role: 'user', content: args.prompt }],
      maxTokens: args.maxTokens,
      responseJsonObject: true,
    })
    if (args.onStream) {
      for (const chunk of chunkText(full, 80)) args.onStream(chunk)
    }
    return full
  }

  if (config.LLM_PROVIDER === 'groq') {
    const model =
      args.purpose === 'plan' ? config.GROQ_PLAN_MODEL : config.GROQ_CONTENT_MODEL
    const full = await groqChatCompletion({
      model,
      messages: [{ role: 'user', content: args.prompt }],
      maxTokens: args.maxTokens,
      responseJsonObject: true,
    })
    if (args.onStream) {
      for (const chunk of chunkText(full, 80)) args.onStream(chunk)
    }
    return full
  }

  // Anthropic
  const anthropic = getAnthropicClient()
  const model = args.purpose === 'plan' ? OPUS_MODEL : SONNET_MODEL

  if (args.onStream) {
    let text = ''
    const stream = await anthropic.messages.stream({
      model,
      max_tokens: args.maxTokens,
      messages: [{ role: 'user', content: args.prompt }],
    })
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        text += chunk.delta.text
        args.onStream(chunk.delta.text)
      }
    }
    return text
  }

  const response = await anthropic.messages.create({
    model,
    max_tokens: args.maxTokens,
    messages: [{ role: 'user', content: args.prompt }],
  })
  return (response.content[0] as { text: string }).text
}

export async function generateAskText(args: {
  systemPrompt: string
  messages: ChatMessage[]
  maxTokens: number
  onStream?: (chunk: string) => void
}): Promise<string> {
  if (config.LLM_PROVIDER === 'gemini') {
    const full = await geminiGenerateChatText({
      model: config.GEMINI_ASK_MODEL,
      systemPrompt: args.systemPrompt,
      messages: args.messages,
      maxTokens: args.maxTokens,
    })
    if (args.onStream) {
      for (const chunk of chunkText(full, 80)) args.onStream(chunk)
    }
    return full
  }

  if (config.LLM_PROVIDER === 'grok') {
    const messages: OpenAiStyleMessage[] = [
      { role: 'system', content: args.systemPrompt },
      ...args.messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ]
    const full = await grokChatCompletion({
      model: config.GROK_ASK_MODEL,
      messages,
      maxTokens: args.maxTokens,
      responseJsonObject: false,
    })
    if (args.onStream) {
      for (const chunk of chunkText(full, 80)) args.onStream(chunk)
    }
    return full
  }

  if (config.LLM_PROVIDER === 'groq') {
    const messages: OpenAiStyleMessage[] = [
      { role: 'system', content: args.systemPrompt },
      ...args.messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ]
    const full = await groqChatCompletion({
      model: config.GROQ_ASK_MODEL,
      messages,
      maxTokens: args.maxTokens,
      responseJsonObject: false,
    })
    if (args.onStream) {
      for (const chunk of chunkText(full, 80)) args.onStream(chunk)
    }
    return full
  }

  const anthropic = getAnthropicClient()
  if (args.onStream) {
    let text = ''
    const stream = await anthropic.messages.stream({
      model: SONNET_MODEL,
      max_tokens: args.maxTokens,
      system: args.systemPrompt,
      messages: args.messages.slice(-6),
    })
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        text += chunk.delta.text
        args.onStream(chunk.delta.text)
      }
    }
    return text
  }

  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: args.maxTokens,
    system: args.systemPrompt,
    messages: args.messages.slice(-6),
  })
  return (response.content[0] as { text: string }).text
}

