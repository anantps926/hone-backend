import { GoalLevel, Prisma } from '@prisma/client'
import { db } from '../db'
import { redis } from '../redis'
import { generateUserPromptText } from '../lib/llm'
import { buildPlanPrompt } from '../prompts/planPrompt'
import { buildContentPrompt } from '../prompts/contentPrompt'
import { generateSlug } from '../lib/slug'
import { config } from '../config'
import PQueue from 'p-queue'
import type { PlanLLMOutput, GeneratePlanResponse, TechniqueSkeleton, DepthLevel } from '../types'

export async function generatePlan(
  userId: string,
  input: string,
  goalLevel: GoalLevel,
  onStream?: (chunk: string) => void
): Promise<GeneratePlanResponse> {
  const inputSlug = generateSlug(input)
  const cacheKey = `plan:${inputSlug}:${goalLevel}`

  const cached = await redis.get(cacheKey)
  if (cached) {
    const planData = JSON.parse(cached) as PlanLLMOutput
    return await upsertHobbyFromPlan(userId, planData, goalLevel)
  }

  let planJson: string = ''

  if (onStream) {
    planJson = await generateUserPromptText({
      purpose: 'plan',
      prompt: buildPlanPrompt(input, goalLevel),
      maxTokens: 4096,
      onStream,
    })
  } else {
    planJson = await generateUserPromptText({
      purpose: 'plan',
      prompt: buildPlanPrompt(input, goalLevel),
      maxTokens: 4096,
    })
  }

  const planData = parsePlanJson(planJson)

  await redis.setex(cacheKey, config.PLAN_CACHE_TTL, JSON.stringify(planData))

  const result = await upsertHobbyFromPlan(userId, planData, goalLevel)

  triggerBackgroundContentGeneration(result.hobbyId, planData.hobbyName)
    .catch(err => console.error('Background content gen failed:', err))

  return result
}

async function upsertHobbyFromPlan(
  userId: string,
  plan: PlanLLMOutput,
  goalLevel: GoalLevel
): Promise<GeneratePlanResponse> {
  const hobbySlug = generateSlug(plan.hobbyName)

  const hobby = await db.hobby.upsert({
    where: { userId_slug: { userId, slug: hobbySlug } },
    create: {
      userId,
      name: plan.hobbyName,
      emoji: plan.hobbyEmoji,
      slug: hobbySlug,
      goalLevel,
      colorTheme: plan.colorTheme,
    },
    update: { goalLevel, colorTheme: plan.colorTheme },
  })

  let orderIndex = 0
  const techniques: TechniqueSkeleton[] = []

  for (const section of plan.sections) {
    for (const t of section.techniques) {
      const slug = generateSlug(t.name)
      const isFirst = orderIndex === 0

      const depthLevel = t.depth_level ?? 'solid'

      const technique = await db.technique.upsert({
        where: { hobbyId_slug: { hobbyId: hobby.id, slug } },
        create: {
          hobbyId: hobby.id,
          name: t.name,
          slug,
          section: section.name,
          orderIndex,
          difficulty: t.difficulty.toUpperCase() as any,
          depthLevel,
          estimatedHours: t.estimatedHours,
          whyItMatters: t.whyItMatters,
        },
        update: {
          section: section.name,
          orderIndex,
          difficulty: t.difficulty.toUpperCase() as any,
          depthLevel,
          estimatedHours: t.estimatedHours,
          whyItMatters: t.whyItMatters,
        },
      })

      await db.techniqueProgress.upsert({
        where: { techniqueId_userId: { techniqueId: technique.id, userId } },
        create: {
          techniqueId: technique.id,
          userId,
          status: isFirst ? 'ACTIVE' : 'LOCKED',
        },
        update: {},
      })

      techniques.push({
        id: technique.id,
        name: technique.name,
        slug: technique.slug,
        section: section.name,
        orderIndex,
        difficulty: technique.difficulty,
        depthLevel: technique.depthLevel as DepthLevel,
        estimatedHours: technique.estimatedHours,
        whyItMatters: technique.whyItMatters,
        status: isFirst ? 'ACTIVE' : 'LOCKED',
      })

      orderIndex++
    }
  }

  return {
    hobbyId: hobby.id,
    hobbyName: hobby.name,
    hobbyEmoji: hobby.emoji,
    colorTheme: hobby.colorTheme,
    techniques,
  }
}

async function triggerBackgroundContentGeneration(
  hobbyId: string,
  hobbyName: string
) {
  const techniques = await db.technique.findMany({
    where: { hobbyId, contentJson: { equals: Prisma.DbNull } },
  })

  const queue = new PQueue({ concurrency: 3 })
  for (const t of techniques) {
    queue.add(() => generateAndCacheContent(
      t.id, hobbyName, t.name, t.whyItMatters, t.depthLevel as DepthLevel
    ))
  }
  await queue.onIdle()
}

function extractJsonCandidate(raw: string): string {
  // Gemini often returns extra text or markdown around JSON.
  // We extract the first JSON object/array candidate and strip common formatting issues.
  const withoutFences = raw.replace(/```json\n?|\n?```/g, '').trim()

  const firstBrace = withoutFences.indexOf('{')
  const lastBrace = withoutFences.lastIndexOf('}')
  const firstBracket = withoutFences.indexOf('[')
  const lastBracket = withoutFences.lastIndexOf(']')

  // Prefer object if present; otherwise fall back to array.
  const start =
    firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)
      ? firstBrace
      : firstBracket
  const end = start === firstBrace ? lastBrace : lastBracket

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object/array found in LLM output')
  }

  let candidate = withoutFences.slice(start, end + 1).trim()

  // Best-effort cleanup for trailing commas before closing brackets/braces.
  candidate = candidate.replace(/,\s*([}\]])/g, '$1')

  return candidate
}

export function parsePlanJson(raw: string): PlanLLMOutput {
  const candidate = extractJsonCandidate(raw)
  try {
    return JSON.parse(candidate) as PlanLLMOutput
  } catch {
    throw new Error(`Failed to parse plan JSON: ${candidate.slice(0, 200)}`)
  }
}

export async function generateAndCacheContent(
  techniqueId: string,
  hobbyName: string,
  techniqueName: string,
  whyItMatters: string,
  depthLevel: DepthLevel
) {
  const existing = await db.technique.findUnique({
    where: { id: techniqueId },
    select: { contentJson: true },
  })
  if (existing?.contentJson) return existing.contentJson

  const raw = await generateUserPromptText({
    purpose: 'content',
    prompt: buildContentPrompt(hobbyName, techniqueName, whyItMatters, depthLevel),
    maxTokens: 4096,
  })

  const candidate = extractJsonCandidate(raw)
  const content = JSON.parse(candidate)

  await db.technique.update({
    where: { id: techniqueId },
    data: { contentJson: content, contentGeneratedAt: new Date() },
  })

  return content
}
