// ─── Request / Response types ─────────────────────────────

export interface GeneratePlanRequest {
  input: string
  goalLevel: 'FUN' | 'GOOD_ENOUGH' | 'COMPETITIVE'
}

export interface GeneratePlanResponse {
  hobbyId: string
  hobbyName: string
  hobbyEmoji: string
  colorTheme: string
  techniques: TechniqueSkeleton[]
}

export type DepthLevel = 'surface' | 'solid' | 'deep'

export interface TechniqueSkeleton {
  id: string
  name: string
  slug: string
  section: string
  orderIndex: number
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  depthLevel: DepthLevel
  estimatedHours: number
  whyItMatters: string
  status: 'LOCKED' | 'ACTIVE'
}

// ─── Content types ────────────────────────────────────────

export interface TechniqueContent {
  read: ReadContent
  watch: WatchContent
  listen: ListenContent
  practice: PracticeContent
  quiz: QuizQuestion[]
}

export interface ReadContent {
  title: string
  body: string
  keyPoints: string[]
}

export interface WatchContent {
  searchQueries: string[]
}

export interface ListenContent {
  scriptOutline: string
  estimatedMinutes: number
}

export interface PracticeContent {
  doIt: DoItTask
  mcq: McqTask
  fillBlank: FillBlankTask
  reflect: string
  challenge: ChallengeTask
}

export interface DoItTask {
  title: string
  description: string
  steps: string[]
}

export interface McqTask {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface FillBlankTask {
  sentence: string
  answer: string
  distractors: string[]
}

export interface ChallengeTask {
  title: string
  description: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

// ─── YouTube types ────────────────────────────────────────

export interface VideoResult {
  videoId: string
  title: string
  channel: string
  thumbnailUrl: string
  duration: string
  durationSeconds: number
  viewCount: number
  likeCount: number
  score: number
  url: string
}

// ─── LLM raw output types (what Opus returns) ─────────────

export interface PlanLLMOutput {
  hobbyName: string
  hobbyEmoji: string
  colorTheme: 'purple' | 'teal' | 'amber' | 'coral'
  sections: Array<{
    name: string
    techniques: Array<{
      name: string
      whyItMatters: string
      estimatedHours: number
      difficulty: 'beginner' | 'intermediate' | 'advanced'
      depth_level: DepthLevel
    }>
  }>
}

export interface ContentLLMOutput {
  read: ReadContent
  watch: { searchQueries: string[] }
  listen: ListenContent
  practice: PracticeContent
  quiz: QuizQuestion[]
}

export interface ExplainLLMOutput {
  definition: string
  example: string
  related: string[]
}

// ─── Progress types ───────────────────────────────────────

export type FormatKey = 'read' | 'watch' | 'listen' | 'practice' | 'quiz'

export type ProgressRecord = Record<FormatKey, number>

export interface UpdateProgressRequest {
  format: FormatKey
  value: number
}

export function computeMastery(progress: ProgressRecord): number {
  const consumed = Math.max(progress.read, progress.watch, progress.listen)
  const practiced = progress.practice
  const tested    = progress.quiz

  const raw = Math.round(
    consumed  * 0.30 +
    practiced * 0.45 +
    tested    * 0.25
  )

  const hasEngaged = practiced > 50 || tested > 50
  return hasEngaged ? raw : Math.min(raw, 60)
}

export function masteryBreakdown(progress: ProgressRecord): {
  consumed: number
  consumedSource: FormatKey
  practiced: number
  tested: number
  mastery: number
  cappedReason: string | null
} {
  const sources: FormatKey[] = ['read', 'watch', 'listen']
  const consumedSource = sources.reduce((best, key) =>
    progress[key] > progress[best] ? key : best
  )
  const consumed  = progress[consumedSource]
  const practiced = progress.practice
  const tested    = progress.quiz
  const raw       = Math.round(consumed * 0.30 + practiced * 0.45 + tested * 0.25)
  const hasEngaged = practiced > 50 || tested > 50

  return {
    consumed,
    consumedSource,
    practiced,
    tested,
    mastery: hasEngaged ? raw : Math.min(raw, 60),
    cappedReason: !hasEngaged && raw > 60
      ? 'Complete some practice or quiz to unlock full mastery'
      : null,
  }
}
