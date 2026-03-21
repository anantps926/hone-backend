// src/lib/normalizeHobby.ts
import { getAnthropicClient } from './anthropic'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

export async function normalizeHobbyInput(input: string): Promise<{
  hobbySlug: string   // e.g. "guitar"
  hobbyName: string   // e.g. "Guitar"
}> {
  const anthropic = getAnthropicClient()
  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 60,
    messages: [{
      role: 'user',
      content: `Extract the primary hobby from this input. Return JSON only:
{"hobbySlug": "guitar", "hobbyName": "Guitar"}

Input: "${input}"
Rules:
- hobbySlug must be lowercase, single word or hyphenated (e.g. "rock-climbing")
- hobbyName is the proper display name
- If multiple hobbies mentioned, pick the most specific one
- Return ONLY the JSON object, nothing else`
    }]
  })
  const raw = (response.content[0] as {text:string}).text.trim()
  return JSON.parse(raw)
}