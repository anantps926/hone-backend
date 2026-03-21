import { GoalLevel } from '@prisma/client'

const goalDescriptions: Record<GoalLevel, string> = {
  FUN: 'casual enjoyment — just enough to have fun',
  GOOD_ENOUGH: 'confident enough to enjoy it socially, hold their own, not embarrass themselves',
  COMPETITIVE: 'win consistently, compete seriously, reach an advanced level',
}

export function buildPlanPrompt(input: string, goalLevel: GoalLevel): string {
  return `You are a hobby learning expert who creates focused, efficient learning plans.

The user wants to learn: "${input}"
Their goal: ${goalDescriptions[goalLevel]}

Your task: identify the MINIMUM set of techniques they need to reach this goal.
Not everything — just what's necessary and sufficient.
Group them into 2-3 logical sections (e.g. "Foundations", "Tactics", "Mastery").

Goal level affects TWO things:
1. How many techniques to include (FUN=4-5, GOOD_ENOUGH=6-7, COMPETITIVE=8-10)
2. The depth_level field on each technique which affects content generation

For each technique include a depth_level:
- "surface"  → FUN: just enough to do it casually
- "solid"    → GOOD_ENOUGH: understand it well, apply reliably
- "deep"     → COMPETITIVE: master it, know edge cases and theory

Example for guitar "Basic chord shapes":
- FUN depth:         3 open chords (G, C, D), strum simple songs
- GOOD_ENOUGH depth: 8 open chords + basic barre chords
- COMPETITIVE depth: All barre shapes, chord inversions, voice leading

Rules:
- Techniques must be specific and actionable, not vague ("learn chords" not "learn music theory")
- Each technique must build on the previous ones
- First technique must be beginner-friendly with no prerequisites
- The set must be achievable in the timeframe implied by the goal level
- colorTheme must be one of: purple, teal, amber, coral (pick what fits the hobby's vibe)

Return ONLY valid JSON. No markdown. No explanation outside JSON.

{
  "hobbyName": "Chess",
  "hobbyEmoji": "♟",
  "colorTheme": "purple",
  "sections": [
    {
      "name": "Foundations",
      "techniques": [
        {
          "name": "Basic piece movement",
          "whyItMatters": "You cannot play at all without knowing how each piece moves legally.",
          "estimatedHours": 2,
          "difficulty": "beginner",
          "depth_level": "surface"
        }
      ]
    }
  ]
}`
}
