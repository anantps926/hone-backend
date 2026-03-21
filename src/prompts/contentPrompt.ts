import type { DepthLevel } from '../types'

export function buildContentPrompt(
  hobbyName: string,
  techniqueName: string,
  whyItMatters: string,
  depthLevel: DepthLevel
): string {
  return `You are creating learning content for a hobby app. Write for a real person learning at home, not a student.
Tone: conversational, encouraging, specific. Never condescending.

Hobby: ${hobbyName}
Technique: ${techniqueName}
Why this matters: ${whyItMatters}
Depth level for this content: ${depthLevel}
- surface:  beginner-friendly, 2-3 key points, simple practice drill
- solid:    intermediate, 4 key points, multi-step practice
- deep:     advanced, nuanced explanation, challenging quiz questions

Generate complete learning content for this technique.
Return ONLY valid JSON. No markdown. No text outside JSON.

{
  "read": {
    "title": "Short title (5 words max)",
    "body": "Explanation in 180-220 words. Conversational. Use concrete examples. Wrap 4-10 important vocabulary terms in double asterisks like **this term** so the app can highlight them (use ** only for terms, not whole sentences).",
    "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4"]
  },
  "watch": {
    "searchQueries": [
      "broad query for beginners e.g. chess opening principles explained",
      "more specific query e.g. how to control center in chess tutorial",
      "channel-specific if known e.g. chess opening principles GothamChess beginner"
    ]
  },
  "listen": {
    "scriptOutline": "3-4 sentence outline of what the audio should cover",
    "estimatedMinutes": 5
  },
  "practice": {
    "doIt": {
      "title": "Real-world drill title (what they actually go DO)",
      "description": "1-2 sentence description of the drill",
      "steps": ["Step 1", "Step 2", "Step 3"]
    },
    "mcq": {
      "question": "Specific question testing understanding of this technique",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 1,
      "explanation": "Why this is correct and why the others are wrong"
    },
    "fillBlank": {
      "sentence": "Complete this rule: A ___ always stays on its colour for the whole game.",
      "answer": "bishop",
      "distractors": ["knight", "rook"]
    },
    "reflect": "Open-ended question: what confused you most about this technique and why?",
    "challenge": {
      "title": "Teach it to someone",
      "description": "Explain ${techniqueName} to someone who has never played ${hobbyName} — without using a board or any equipment. If you can explain it simply, you truly understand it."
    }
  },
  "quiz": [
    {
      "question": "Quiz question 1",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "Explanation"
    },
    {
      "question": "Quiz question 2",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 2,
      "explanation": "Explanation"
    },
    {
      "question": "Quiz question 3",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 1,
      "explanation": "Explanation"
    }
  ]
}`
}
