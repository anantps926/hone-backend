import { describe, it, expect } from 'vitest'
import { computeMastery, masteryBreakdown } from '../src/types'
import type { FormatKey, ProgressRecord } from '../src/types'

describe('computeMastery', () => {
  it('consumed = max of read/watch/listen', () => {
    const a = computeMastery({ read: 80, watch: 20, listen: 50, practice: 100, quiz: 100 })
    const b = computeMastery({ read: 20, watch: 80, listen: 50, practice: 100, quiz: 100 })
    const c = computeMastery({ read: 20, watch: 50, listen: 80, practice: 100, quiz: 100 })
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('caps at 60 when neither practice nor quiz > 50', () => {
    const mastery = computeMastery({ read: 100, watch: 100, listen: 100, practice: 50, quiz: 50 })
    // raw = 100*0.30 + 50*0.45 + 50*0.25 = 30 + 22.5 + 12.5 = 65 → capped to 60
    expect(mastery).toBe(60)
  })

  it('uncaps when practice > 50', () => {
    const mastery = computeMastery({ read: 100, watch: 100, listen: 100, practice: 51, quiz: 50 })
    // raw = 30 + 22.95 + 12.5 = 65.45 → 65
    expect(mastery).toBe(65)
  })

  it('uncaps when quiz > 50', () => {
    const mastery = computeMastery({ read: 100, watch: 100, listen: 100, practice: 50, quiz: 51 })
    // raw = 30 + 22.5 + 12.75 = 65.25 → 65
    expect(mastery).toBe(65)
  })

  it('100% is achievable with full engagement', () => {
    expect(computeMastery({ read: 100, watch: 100, listen: 100, practice: 100, quiz: 100 })).toBe(100)
  })

  it('a reader who practices hard and aces quiz gets 100%', () => {
    const mastery = computeMastery({ read: 100, watch: 0, listen: 0, practice: 100, quiz: 100 })
    // consumed=100, raw = 30 + 45 + 25 = 100
    expect(mastery).toBe(100)
  })

  it('binge-watcher with no practice is capped', () => {
    const mastery = computeMastery({ read: 100, watch: 100, listen: 100, practice: 0, quiz: 0 })
    // raw = 30 + 0 + 0 = 30, but also < 60, so min(30, 60) = 30
    expect(mastery).toBe(30)
  })
})

describe('masteryBreakdown', () => {
  it('identifies the correct consumed source', () => {
    const b = masteryBreakdown({ read: 30, watch: 80, listen: 50, practice: 100, quiz: 100 })
    expect(b.consumedSource).toBe('watch')
    expect(b.consumed).toBe(80)
  })

  it('returns cappedReason when capped', () => {
    const b = masteryBreakdown({ read: 100, watch: 100, listen: 100, practice: 50, quiz: 50 })
    expect(b.cappedReason).toBe('Complete some practice or quiz to unlock full mastery')
    expect(b.mastery).toBe(60)
  })

  it('returns null cappedReason when not capped', () => {
    const b = masteryBreakdown({ read: 100, watch: 100, listen: 100, practice: 80, quiz: 80 })
    expect(b.cappedReason).toBeNull()
  })

  it('returns null cappedReason when raw <= 60 (no cap needed)', () => {
    const b = masteryBreakdown({ read: 50, watch: 0, listen: 0, practice: 30, quiz: 30 })
    // raw = 15 + 13.5 + 7.5 = 36, under 60 so not capped even without engagement
    expect(b.cappedReason).toBeNull()
    expect(b.mastery).toBe(36)
  })

  it('provides full breakdown fields', () => {
    const b = masteryBreakdown({ read: 100, watch: 0, listen: 0, practice: 100, quiz: 100 })
    expect(b.consumed).toBe(100)
    expect(b.consumedSource).toBe('read')
    expect(b.practiced).toBe(100)
    expect(b.tested).toBe(100)
    expect(b.mastery).toBe(100)
    expect(b.cappedReason).toBeNull()
  })
})
