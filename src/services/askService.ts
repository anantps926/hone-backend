import { Response } from 'express'
import { generateAskText } from '../lib/llm'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function streamAsk(
  res: Response,
  hobbyName: string,
  techniqueName: string,
  word: string,
  messages: Message[]
) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const systemPrompt = `You are a helpful assistant explaining hobby concepts to a learner.
Hobby: ${hobbyName}
Technique being studied: ${techniqueName}
Term being discussed: ${word}

Rules:
- Keep answers concise: 2-3 sentences maximum
- Use examples from ${hobbyName} whenever possible
- Never be condescending
- If the question is unrelated to the hobby, gently redirect`

  try {
    const full = await generateAskText({
      systemPrompt,
      messages: messages.slice(-12),
      maxTokens: 300,
    })

    // Gemini doesn't currently stream in the same way; simulate streaming by chunking.
    const chunkSize = 80
    for (let i = 0; i < full.length; i += chunkSize) {
      const chunk = full.slice(i, i + chunkSize)
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`)
    res.end()
  }
}
