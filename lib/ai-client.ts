import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const AI_MODELS = {
  primary: 'claude-sonnet-4-6',
  advanced: 'claude-opus-4-7',
  dev: 'gemini-3-flash-preview', // fallback when ANTHROPIC_API_KEY is not set
} as const
