import { google, youtube_v3 } from 'googleapis'
import { db } from '../db'
import { config } from '../config'
import type { VideoResult } from '../types'

const youtube = google.youtube({ version: 'v3', auth: config.YOUTUBE_API_KEY })

const TRUSTED_CHANNELS: Record<string, Set<string>> = {
  chess:        new Set(['GothamChess', 'Daniel Naroditsky', 'Chess.com', 'agadmator\'s Chess Channel', 'John Bartholomew']),
  guitar:       new Set(['JustinGuitar', 'Marty Music', 'Paul Davids', 'Fender', 'GuitarLessons365Song']),
  poker:        new Set(['Upswing Poker', 'Jonathan Little Poker', 'Run It Once', 'PokerStars School']),
  photography:  new Set(['Peter McKinnon', 'Mango Street', 'Tony & Chelsea Northrup', 'B&H Photo Video']),
  piano:        new Set(['PianoLessonsOnTheWeb', 'Pianote', 'Scott Houston Piano', 'flowkey']),
  drawing:      new Set(['Proko', 'Mark Crilley', 'Alphonso Dunn', 'Sycra']),
  cooking:      new Set(['Binging with Babish', 'Joshua Weissman', 'Internet Shaquille', 'Jacques Pépin']),
}

function getTrustedChannels(hobbyName: string): Set<string> {
  const slug = hobbyName.toLowerCase().replace(/[^a-z]/g, '')
  return TRUSTED_CHANNELS[slug] ?? new Set()
}

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

function scoreVideo(
  video: youtube_v3.Schema$Video,
  techniqueName: string,
  hobbyName: string
): number {
  let score = 0

  const views = parseInt(video.statistics?.viewCount ?? '0')
  const likes = parseInt(video.statistics?.likeCount ?? '0')
  const duration = parseISO8601Duration(video.contentDetails?.duration ?? '')
  const title = (video.snippet?.title ?? '').toLowerCase()
  const channel = video.snippet?.channelTitle ?? ''

  score += Math.log10(Math.max(views, 1)) * 10

  const likeRatio = views > 0 ? likes / views : 0
  score += likeRatio * 1000

  if (duration >= 300 && duration <= 900) score += 30
  else if (duration >= 180 && duration <= 1200) score += 15

  const trusted = getTrustedChannels(hobbyName)
  if (trusted.has(channel)) score += 40

  const keywords = techniqueName.toLowerCase().split(/\s+/)
  const hobbyKeyword = hobbyName.toLowerCase()
  const matchCount = keywords.filter(w => title.includes(w)).length
  score += matchCount * 10
  if (title.includes(hobbyKeyword)) score += 5

  if (title.includes('#shorts')) score -= 50
  if (title.includes('buy') || title.includes('sponsor')) score -= 10

  return Math.max(0, score)
}

export async function fetchAndRankVideos(
  techniqueId: string,
  hobbyName: string,
  techniqueName: string,
  searchQueries: string[]
): Promise<VideoResult[]> {
  const existing = await db.technique.findUnique({
    where: { id: techniqueId },
    select: { videoJson: true, videoFetchedAt: true },
  })

  if (existing?.videoJson && existing.videoFetchedAt) {
    const ageMs = Date.now() - existing.videoFetchedAt.getTime()
    if (ageMs < config.VIDEO_CACHE_TTL * 1000) {
      return existing.videoJson as unknown as VideoResult[]
    }
  }

  const searchResults = await Promise.allSettled(
    searchQueries.slice(0, 3).map(q =>
      youtube.search.list({
        part: ['snippet'],
        q,
        type: ['video'],
        videoDuration: 'medium',
        videoEmbeddable: 'true',
        relevanceLanguage: 'en',
        safeSearch: 'moderate',
        maxResults: 5,
      })
    )
  )

  const videoIds: string[] = []
  const seen = new Set<string>()

  for (const result of searchResults) {
    if (result.status !== 'fulfilled') continue
    for (const item of result.value.data.items ?? []) {
      const id = item.id?.videoId
      if (id && !seen.has(id)) {
        seen.add(id)
        videoIds.push(id)
      }
    }
  }

  if (videoIds.length === 0) return []

  const statsResponse = await youtube.videos.list({
    part: ['statistics', 'contentDetails', 'snippet', 'status'],
    id: videoIds,
  })

  /** Drop only videos explicitly not embeddable (152-4 in WebView). Undefined embeddable still allowed. */
  const videos = (statsResponse.data.items ?? []).filter(
    (v) => v.status?.embeddable !== false
  )

  const scored = videos
    .map(v => ({
      video: v,
      score: scoreVideo(v, techniqueName, hobbyName),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const ranked: VideoResult[] = scored.map(({ video, score }) => {
    const durationSecs = parseISO8601Duration(video.contentDetails?.duration ?? '')
    const views = parseInt(video.statistics?.viewCount ?? '0')
    return {
      videoId: video.id!,
      title: video.snippet?.title ?? '',
      channel: video.snippet?.channelTitle ?? '',
      thumbnailUrl: video.snippet?.thumbnails?.medium?.url ?? '',
      duration: formatDuration(durationSecs),
      durationSeconds: durationSecs,
      viewCount: views,
      likeCount: parseInt(video.statistics?.likeCount ?? '0'),
      score,
      url: `https://www.youtube.com/watch?v=${video.id}`,
    }
  })

  await db.technique.update({
    where: { id: techniqueId },
    data: { videoJson: ranked as any, videoFetchedAt: new Date() },
  })

  return ranked
}
