import { describe, it, expect } from 'vitest'

function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const h = parseInt(match[1] ?? '0')
  const m = parseInt(match[2] ?? '0')
  const s = parseInt(match[3] ?? '0')
  return h * 3600 + m * 60 + s
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

describe('parseISO8601Duration', () => {
  it('parses minutes and seconds', () => {
    expect(parseISO8601Duration('PT8M24S')).toBe(504)
  })

  it('parses hours, minutes, seconds', () => {
    expect(parseISO8601Duration('PT1H30M15S')).toBe(5415)
  })

  it('parses minutes only', () => {
    expect(parseISO8601Duration('PT10M')).toBe(600)
  })

  it('parses seconds only', () => {
    expect(parseISO8601Duration('PT45S')).toBe(45)
  })

  it('returns 0 for invalid input', () => {
    expect(parseISO8601Duration('')).toBe(0)
    expect(parseISO8601Duration('invalid')).toBe(0)
  })
})

describe('formatDuration', () => {
  it('formats seconds to m:ss', () => {
    expect(formatDuration(504)).toBe('8:24')
  })

  it('handles zero seconds', () => {
    expect(formatDuration(600)).toBe('10:00')
  })

  it('handles single-digit seconds', () => {
    expect(formatDuration(65)).toBe('1:05')
  })

  it('handles large durations', () => {
    expect(formatDuration(3661)).toBe('61:01')
  })
})

describe('video scoring heuristics', () => {
  function scoreBasic(views: number, likes: number, durationSec: number, titleKeywords: number, isTrusted: boolean, isShort: boolean): number {
    let score = 0
    score += Math.log10(Math.max(views, 1)) * 10
    const likeRatio = views > 0 ? likes / views : 0
    score += likeRatio * 1000
    if (durationSec >= 300 && durationSec <= 900) score += 30
    else if (durationSec >= 180 && durationSec <= 1200) score += 15
    if (isTrusted) score += 40
    score += titleKeywords * 10
    if (isShort) score -= 50
    return Math.max(0, score)
  }

  it('scores high-view trusted channel video highly', () => {
    const score = scoreBasic(1_000_000, 50_000, 600, 2, true, false)
    expect(score).toBeGreaterThan(100)
  })

  it('penalizes shorts', () => {
    const normal = scoreBasic(100_000, 5_000, 600, 1, false, false)
    const short = scoreBasic(100_000, 5_000, 600, 1, false, true)
    expect(normal).toBeGreaterThan(short)
  })

  it('prefers ideal duration videos', () => {
    const ideal = scoreBasic(10_000, 500, 600, 0, false, false)
    const tooLong = scoreBasic(10_000, 500, 2000, 0, false, false)
    expect(ideal).toBeGreaterThan(tooLong)
  })

  it('gives trusted channel bonus', () => {
    const trusted = scoreBasic(10_000, 500, 600, 0, true, false)
    const untrusted = scoreBasic(10_000, 500, 600, 0, false, false)
    expect(trusted - untrusted).toBe(40)
  })
})
