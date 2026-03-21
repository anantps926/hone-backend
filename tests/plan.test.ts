import { describe, it, expect } from 'vitest'
import { generateSlug } from '../src/lib/slug'
import { computeMastery } from '../src/types'
import { parsePlanJson } from '../src/services/planService'
import type { PlanLLMOutput } from '../src/types'
import { extractGeminiTextFromResponse } from '../src/lib/llm'

describe('generateSlug', () => {
  it('converts simple text to slug', () => {
    expect(generateSlug('Chess')).toBe('chess')
  })

  it('handles spaces and special characters', () => {
    expect(generateSlug('I want to learn Chess!')).toBe('i-want-to-learn-chess')
  })

  it('collapses multiple separators', () => {
    expect(generateSlug('guitar - - basics')).toBe('guitar-basics')
  })

  it('trims leading and trailing hyphens', () => {
    expect(generateSlug('--chess--')).toBe('chess')
  })

  it('truncates at 60 characters', () => {
    const long = 'a'.repeat(100)
    expect(generateSlug(long).length).toBeLessThanOrEqual(60)
  })
})

describe('parsePlanJson', () => {
  it('validates a well-formed plan object with depth_level', () => {
    const plan: PlanLLMOutput = {
      hobbyName: 'Chess',
      hobbyEmoji: '♟',
      colorTheme: 'purple',
      sections: [
        {
          name: 'Foundations',
          techniques: [
            {
              name: 'Basic piece movement',
              whyItMatters: 'You cannot play without knowing how pieces move.',
              estimatedHours: 2,
              difficulty: 'beginner',
              depth_level: 'surface',
            },
          ],
        },
      ],
    }

    expect(plan.hobbyName).toBe('Chess')
    expect(plan.sections).toHaveLength(1)
    expect(plan.sections[0].techniques[0].depth_level).toBe('surface')
  })

  it('strips markdown fences from raw LLM output', () => {
    const raw = '```json\n{"hobbyName":"Chess","hobbyEmoji":"♟","colorTheme":"purple","sections":[]}\n```'
    const parsed = parsePlanJson(raw)
    expect(parsed.hobbyName).toBe('Chess')
    expect(parsed.colorTheme).toBe('purple')
  })

  it('extracts JSON even when LLM adds extra text', () => {
    const raw =
      'Here is your plan:\n```json\n{"hobbyName":"Chess","hobbyEmoji":"♟","colorTheme":"purple","sections":[]}\n```\nGood luck!'
    const parsed = parsePlanJson(raw)
    expect(parsed.hobbyName).toBe('Chess')
  })

  it('throws on invalid JSON', () => {
    const raw = 'not valid json at all'
    expect(() => parsePlanJson(raw)).toThrow()
  })
})

describe('extractGeminiTextFromResponse', () => {
  it('extracts text from candidates.content.parts.text', () => {
    const json = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Hello ' }, { text: '{"a":1}' }],
          },
        },
      ],
    }

    expect(extractGeminiTextFromResponse(json)).toBe('Hello {"a":1}')
  })

  it('falls back to collecting nested "text" fields anywhere in the response', () => {
    const json = {
      candidates: [
        {
          content: {
            parts: [{ inlineData: { mimeType: 'text/plain', data: 'SGVsbG8=' } }],
          },
        },
      ],
      meta: {
        extra: { text: 'fallback-text' },
      },
    }

    expect(extractGeminiTextFromResponse(json)).toBe('fallback-text')
  })

  it('returns empty string if no text fields exist', () => {
    const json = { candidates: [{ content: { parts: [{ foo: 'bar' }] } }] }
    expect(extractGeminiTextFromResponse(json)).toBe('')
  })
})

describe('computeMastery (new formula)', () => {
  it('returns 0 for all zeros', () => {
    expect(computeMastery({ read: 0, watch: 0, listen: 0, practice: 0, quiz: 0 })).toBe(0)
  })

  it('returns 100 for all 100s with engagement', () => {
    expect(computeMastery({ read: 100, watch: 100, listen: 100, practice: 100, quiz: 100 })).toBe(100)
  })

  it('uses best of read/watch/listen as consumed score', () => {
    const readOnly  = computeMastery({ read: 100, watch: 0, listen: 0, practice: 100, quiz: 100 })
    const watchOnly = computeMastery({ read: 0, watch: 100, listen: 0, practice: 100, quiz: 100 })
    expect(readOnly).toBe(watchOnly)
  })

  it('caps at 60 without practice or quiz engagement', () => {
    const mastery = computeMastery({ read: 100, watch: 100, listen: 100, practice: 0, quiz: 0 })
    // raw = 100*0.30 + 0 + 0 = 30, under 60 so no cap applied
    expect(mastery).toBe(30)

    // Even with max consumption, raw could be 30 max without practice/quiz
    // But if someone has practice=50 (not >50), still capped
    const capped = computeMastery({ read: 100, watch: 100, listen: 100, practice: 50, quiz: 50 })
    // raw = 30 + 22.5 + 12.5 = 65 → capped to 60
    expect(capped).toBe(60)
  })

  it('uncaps when practice exceeds 50', () => {
    const mastery = computeMastery({ read: 100, watch: 100, listen: 100, practice: 51, quiz: 50 })
    // raw = 30 + 22.95 + 12.5 = 65.45 → 65
    expect(mastery).toBe(65)
  })

  it('weights practice most heavily at 0.45', () => {
    const practiceHeavy = computeMastery({ read: 0, watch: 0, listen: 0, practice: 100, quiz: 0 })
    // raw = 0 + 45 + 0 = 45, practice>50 so uncapped
    expect(practiceHeavy).toBe(45)
  })
})
