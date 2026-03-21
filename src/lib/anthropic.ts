import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config'

let _anthropic: Anthropic | null = null

export function getAnthropicClient() {
  if (_anthropic) return _anthropic
  if (!config.ANTHROPIC_API_KEY || config.ANTHROPIC_API_KEY.trim().length === 0) {
    throw new Error('ANTHROPIC_API_KEY is required when using LLM_PROVIDER=anthropic')
  }
  _anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })
  return _anthropic
}

export const OPUS_MODEL   = 'claude-opus-4-6'
export const SONNET_MODEL = 'claude-sonnet-4-6'
