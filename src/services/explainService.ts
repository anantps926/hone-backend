import { generateUserPromptText } from '../lib/llm'
import { buildExplainPrompt } from '../prompts/explainPrompt'
import { redis } from '../redis'
import { config } from '../config'
import type { ExplainLLMOutput } from '../types'

export async function explainWord(
  hobbyName: string,
  techniqueName: string,
  word: string,
  sentence: string
): Promise<ExplainLLMOutput> {
  const cacheKey = `explain:${hobbyName.toLowerCase()}:${word.toLowerCase()}`

  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached) as ExplainLLMOutput

  const raw = await generateUserPromptText({
    purpose: 'explain',
    prompt: buildExplainPrompt(hobbyName, techniqueName, word, sentence),
    maxTokens: 512,
  })
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
  const result = JSON.parse(cleaned) as ExplainLLMOutput

  await redis.setex(cacheKey, config.WORD_CACHE_TTL, JSON.stringify(result))

  return result
}
