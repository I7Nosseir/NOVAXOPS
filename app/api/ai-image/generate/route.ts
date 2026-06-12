import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import sharp from 'sharp'

const DAILY_IMAGE_CAP = 50

const STYLE_SUFFIXES: Record<string, string> = {
  photorealistic: 'photorealistic, professional photography, 8K ultra-high resolution, razor-sharp detail, professional studio lighting, high dynamic range, perfect exposure, masterful composition',
  cinematic:      'cinematic photography, film still, dramatic chiaroscuro lighting, anamorphic lens, professional color grading, shallow depth of field, 4K cinema quality, epic atmosphere, bokeh background',
  product:        'commercial product photography, seamless white background, multi-point professional studio lighting, ultra-sharp focus, advertising campaign quality, 8K detail, pristine product clarity',
  lifestyle:      'lifestyle photography, natural golden hour light, authentic candid editorial, warm film tones, magazine quality, professional editorial photography, environmental storytelling',
  illustration:   'professional digital illustration, intricate fine detail, vibrant harmonious color palette, clean precise vector-like lines, premium graphic design, print-ready quality',
  abstract:       'fine art abstract, bold dynamic color field, masterful compositional balance, gallery quality, cutting-edge digital art, ultra-high resolution, museum-worthy',
}

const QUALITY_SUFFIX = ', professional quality, no artifacts, no blur, no distortion, no watermarks'

// Pro model removed — too expensive for internal use
const GEMINI_IMAGE_MODELS = new Set([
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
])

// Ultra model removed — too expensive for internal use
const IMAGEN_MODELS = new Set([
  'imagen-4.0-generate-001',
  'imagen-4.0-fast-generate-001',
])

const AR_VALUES: Record<string, { w: number; h: number }> = {
  '1:1':  { w: 1,  h: 1  },
  '4:5':  { w: 4,  h: 5  },
  '9:16': { w: 9,  h: 16 },
  '16:9': { w: 16, h: 9  },
  '3:4':  { w: 3,  h: 4  },
}

interface RefImage {
  id: string
  data: string
  mime: string
}

interface ResizeToggles {
  hasText: boolean
  hasLogo: boolean
  hasSubject: boolean
  extendBackground: boolean
}

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

function extractMentions(prompt: string): string[] {
  const matches = prompt.match(/@ref\d+/g) ?? []
  return [...new Set(matches)].map(m => m.slice(1))
}

function selectResizeModel(toggles: ResizeToggles, userModel?: string): string {
  // No longer auto-upgrades to Pro — use the user's chosen Gemini model, defaulting to flash
  if (userModel && GEMINI_IMAGE_MODELS.has(userModel)) return userModel
  return 'gemini-3.1-flash-image-preview'
}

function buildResizerPrompt(aspectRatio: string, toggles: ResizeToggles): string {
  const arLabel: Record<string, string> = {
    '1:1': '1:1 square', '9:16': '9:16 vertical portrait',
    '16:9': '16:9 horizontal landscape', '4:5': '4:5 portrait', '3:4': '3:4 portrait',
  }
  const arName = arLabel[aspectRatio] ?? aspectRatio

  const parts: string[] = [
    `You are a professional image compositor. Your task: recompose the attached reference image into a ${arName} aspect ratio.`,
    '',
    'ABSOLUTE RULES (every rule is mandatory with zero exceptions):',
    '1. Reproduce every visual element with exact fidelity — colors, tones, contrast, shadows, highlights, and lighting must be identical to the reference',
    '2. This is RECOMPOSITION only, not reimagination — do not add, remove, or alter any element',
    '3. Output sharpness and detail must match or exceed the reference — no softening, blurring, or quality loss anywhere',
    '4. Maintain the same photographic/visual style, depth of field, and atmosphere as the reference',
  ]

  if (toggles.extendBackground) {
    parts.push('5. CANVAS EXTENSION: Expand the canvas to reach the target aspect ratio. Fill new areas by seamlessly continuing the background using the identical colors, textures, gradients, lighting direction, and atmosphere already present in the reference. The extension must be invisible — a viewer should not be able to tell where the original ended.')
  } else {
    parts.push('5. SMART CROP: Crop to the target aspect ratio. Prioritize keeping all key elements (especially any labeled subjects, text, logos) fully within the frame. Optimize framing for visual balance.')
  }

  if (toggles.hasText) {
    parts.push(
      '',
      'TEXT — VERBATIM REPRODUCTION (MANDATORY):',
      '- Read every character of text visible in the reference image and reproduce it identically, character by character',
      '- Match the exact typeface, font weight, letter-spacing, line-height, size, and color',
      '- Reproduce text at the same position relative to other composition elements',
      '- Text edges must be razor-sharp and perfectly legible at full resolution — zero blur or distortion',
      '- Reproduce all text effects: shadows, outlines, glows, gradients if present',
      '- If the text is large/headline text, give it maximum priority in the crop/extend decision',
    )
  }

  if (toggles.hasLogo) {
    parts.push(
      '',
      'LOGO / BRAND MARK — PRECISION REPRODUCTION (CRITICAL — THIS IS THE HIGHEST PRIORITY):',
      '- The logo in the reference must be reproduced as a pixel-faithful copy — NOT generated from memory',
      '- Visually scan the reference logo carefully: note its exact shape, proportions, internal linework, crest details, letterforms, shields, emblems, symbols',
      '- Reproduce every fine line, every curve, every internal element exactly as it appears in the reference',
      '- Logo edges must be razor-crisp with zero softening, rounding, or approximation',
      '- Maintain exact logo scale and position relative to the composition',
      '- DO NOT substitute with a similar-looking logo from training data — only reproduce what you see in the reference',
      '- If the logo contains an emblem or crest, every internal detail must be accurate and sharp',
    )
  }

  if (toggles.hasSubject) {
    parts.push(
      '',
      'SUBJECT PRESERVATION:',
      '- The primary subject (person/product/vehicle/object) must be fully visible and never cropped',
      '- Preserve exact appearance, pose, expression, clothing details, and all fine visual elements',
      '- Maintain the subject\'s spatial relationship to background elements and frame edges',
      '- Subject proportions and scale relative to the frame must match the reference',
    )
  }

  parts.push(
    '',
    'STRICT FIDELITY — THESE RULES OVERRIDE EVERYTHING ELSE:',
    '- Preserve every element already present in the reference exactly as-is: text, logos, people, products, brand marks',
    '- DO NOT add new text, headlines, captions, or typographic elements that do NOT already exist in the reference',
    '- DO NOT add new logos, brand marks, or symbols that do NOT already exist in the reference',
    '- DO NOT add new objects, vehicles, or props not visible in the reference',
    '- DO NOT infer or complete partially cut-off elements — if something is cropped at the frame edge, do not extend or generate the unseen portion in the extension area',
    '- Extension areas (new canvas) should only contain background environment: sky, floor, walls, ambient light, bokeh, architecture — not new subjects',
  )

  parts.push('', 'Output only the recomposed image. No commentary or explanation.')
  return parts.join('\n')
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 })
  }

  // ── Auth + daily cap enforcement ──────────────────────────────────────────────
  let userId: string | null = null
  let usedToday = 0
  let adminDb: ReturnType<typeof createAdminClient> | null = null

  try {
    const cookieStore = await cookies()
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )
    const { data: { user } } = await authClient.auth.getUser()
    if (user) {
      userId = user.id
      adminDb = createAdminClient()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { count } = await adminDb
        .from('api_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('service', 'gemini')
        .eq('endpoint', 'image_generation')
        .gte('created_at', todayStart.toISOString())
      usedToday = count ?? 0
      if (usedToday >= DAILY_IMAGE_CAP) {
        return NextResponse.json({
          error: `Daily limit of ${DAILY_IMAGE_CAP} images reached. Resets at midnight.`,
          remaining: 0,
        }, { status: 429 })
      }
    }
  } catch { /* proceed without cap enforcement if auth check fails */ }

  const logUsage = async () => {
    if (userId && adminDb) {
      await adminDb.from('api_usage').insert({
        service: 'gemini',
        endpoint: 'image_generation',
        user_id: userId,
        tokens_in: 0,
        tokens_out: 0,
        credits_used: 0,
        cost_usd: 0,
      })
    }
  }

  const withRemaining = (data: Record<string, unknown>) => ({
    ...data,
    ...(userId != null ? { remaining: Math.max(0, DAILY_IMAGE_CAP - usedToday - 1) } : {}),
  })

  // ── Body parsing ──────────────────────────────────────────────────────────────
  let body: {
    prompt?: string
    style?: string
    aspectRatio?: string
    negativePrompt?: string
    model?: string
    referenceImages?: RefImage[]
    mode?: 'generate' | 'resize'
    resizeToggles?: ResizeToggles
  }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    prompt = '',
    style = 'photorealistic',
    aspectRatio = '1:1',
    negativePrompt = '',
    model = 'gemini-3.1-flash-image-preview',
    referenceImages = [],
    mode = 'generate',
    resizeToggles,
  } = body

  const isResize = mode === 'resize'

  if (!isResize && !prompt.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  if (isResize && referenceImages.length === 0) {
    return NextResponse.json({ error: 'A source image is required for resize mode.' }, { status: 400 })
  }

  const refs = referenceImages.slice(0, 5)
  const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

  try {
    // ── Resize mode ─────────────────────────────────────────────────────────────
    if (isResize) {
      const sourceRef = refs[0]
      const toggles: ResizeToggles = resizeToggles ?? {
        hasText: false, hasLogo: false, hasSubject: false, extendBackground: true,
      }

      const sourceBuffer = Buffer.from(sourceRef.data, 'base64')
      const sourceMeta = await sharp(sourceBuffer).metadata()
      const srcW = sourceMeta.width ?? 1000
      const srcH = sourceMeta.height ?? 1000
      const srcAR = srcW / srcH

      const targetRatio = AR_VALUES[aspectRatio] ?? { w: 1, h: 1 }
      const targetAR = targetRatio.w / targetRatio.h

      // ── Path A: Pure crop — Sharp only, zero AI ──────────────────────────────
      if (!toggles.extendBackground) {
        let cropW: number, cropH: number

        if (Math.abs(targetAR - srcAR) < 0.01) {
          cropW = srcW; cropH = srcH
        } else if (targetAR < srcAR) {
          cropH = srcH
          cropW = Math.round(srcH * targetAR)
        } else {
          cropW = srcW
          cropH = Math.round(srcW / targetAR)
        }

        cropW = Math.min(cropW, srcW)
        cropH = Math.min(cropH, srcH)

        const position: string = toggles.hasSubject ? 'attention' : 'centre'

        const cropped = await sharp(sourceBuffer)
          .resize(cropW, cropH, { fit: 'cover', position })
          .png()
          .toBuffer()

        await logUsage()
        return NextResponse.json(withRemaining({
          imageData: cropped.toString('base64'),
          mimeType: 'image/png',
        }))
      }

      // ── Path B: Extension — AI generates background, Sharp composites original ──
      const resizeModel = selectResizeModel(toggles, GEMINI_IMAGE_MODELS.has(model) ? model : undefined)
      const resizerInstruction = buildResizerPrompt(aspectRatio, toggles)

      const reqParts: GeminiPart[] = [
        { text: 'Source image to recompose:' },
        { inlineData: { mimeType: sourceRef.mime, data: sourceRef.data } },
        { text: resizerInstruction },
      ]

      const url = `${BASE}/${resizeModel}:generateContent?key=${apiKey}`
      const payload = {
        contents: [{ role: 'user', parts: reqParts }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json() as {
        candidates?: {
          content?: { parts?: { inlineData?: { data?: string; mimeType?: string }; text?: string }[] }
          finishReason?: string
        }[]
        error?: { message?: string }
      }

      if (!res.ok || json.error) {
        console.error('[ai-image/resize] API error:', json.error?.message)
        return NextResponse.json({ error: json.error?.message ?? `API error ${res.status}` }, { status: res.status })
      }

      const resParts = json.candidates?.[0]?.content?.parts ?? []
      const imagePart = resParts.find(p => p.inlineData?.data)

      if (!imagePart?.inlineData?.data) {
        const finishReason = json.candidates?.[0]?.finishReason
        const modelText = resParts.find(p => p.text)?.text?.slice(0, 300)
        const reason = finishReason === 'SAFETY'
          ? 'Blocked by safety filters — try a different image.'
          : modelText
            ? `Model response: ${modelText}`
            : 'No image returned. Try a different source image.'
        return NextResponse.json({ error: reason }, { status: 502 })
      }

      const aiBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
      const aiMeta = await sharp(aiBuffer).metadata()
      const aiW = aiMeta.width ?? srcW
      const aiH = aiMeta.height ?? srcH

      const scale = Math.min(aiW / srcW, aiH / srcH)
      const scaledW = Math.round(srcW * scale)
      const scaledH = Math.round(srcH * scale)

      const coverage = (scaledW * scaledH) / (aiW * aiH)

      if (coverage < 0.5) {
        await logUsage()
        return NextResponse.json(withRemaining({
          imageData: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType ?? 'image/png',
        }))
      }

      const left = Math.round((aiW - scaledW) / 2)
      const top = Math.round((aiH - scaledH) / 2)

      const scaledSource = await sharp(sourceBuffer)
        .resize(scaledW, scaledH, { fit: 'fill' })
        .png()
        .toBuffer()

      const composited = await sharp(aiBuffer)
        .composite([{ input: scaledSource, left, top }])
        .png()
        .toBuffer()

      await logUsage()
      return NextResponse.json(withRemaining({
        imageData: composited.toString('base64'),
        mimeType: 'image/png',
      }))
    }

    // ── Generate mode ───────────────────────────────────────────────────────────

    if (GEMINI_IMAGE_MODELS.has(model)) {
      const reqParts: GeminiPart[] = []

      const styleSuffix = STYLE_SUFFIXES[style] ?? STYLE_SUFFIXES.photorealistic
      const cappedPrompt = prompt.trim().slice(0, 2000)
      const fullPrompt = `${cappedPrompt}. ${styleSuffix}${QUALITY_SUFFIX}`

      const arLabel: Record<string, string> = {
        '1:1': 'square 1:1 aspect ratio',
        '9:16': 'vertical 9:16 portrait aspect ratio, taller than wide',
        '16:9': 'horizontal 16:9 landscape aspect ratio, wider than tall',
        '4:5': 'portrait 4:5 aspect ratio',
        '3:4': 'portrait 3:4 aspect ratio',
      }
      const arHint = arLabel[aspectRatio] ?? 'square 1:1 aspect ratio'
      const finalPrompt = `${fullPrompt}. Compose the image in a ${arHint}.`
        + (negativePrompt?.trim() ? ` Avoid: ${negativePrompt.trim()}.` : '')

      if (refs.length > 0) {
        const mentionedIds = extractMentions(finalPrompt)
        const mentionedRefs = mentionedIds
          .map(id => refs.find(r => r.id === id))
          .filter((r): r is RefImage => r !== undefined)
        const unmentionedRefs = refs.filter(r => !mentionedIds.includes(r.id))

        for (const ref of mentionedRefs) {
          reqParts.push({ text: `Reference image (@${ref.id}):` })
          reqParts.push({ inlineData: { mimeType: ref.mime, data: ref.data } })
        }

        if (unmentionedRefs.length > 0) {
          reqParts.push({ text: 'Additional reference images for visual context:' })
          for (const ref of unmentionedRefs) {
            reqParts.push({ text: `(@${ref.id}):` })
            reqParts.push({ inlineData: { mimeType: ref.mime, data: ref.data } })
          }
        }

        const mentionNote = mentionedRefs.length > 0
          ? 'Use each @-referenced image exactly as indicated in the prompt below.'
          : 'Use the reference images above as visual inspiration, maintaining their subjects, products, logos, or characters faithfully.'
        reqParts.push({ text: `${mentionNote} Now create: ${finalPrompt}` })
      } else {
        reqParts.push({ text: finalPrompt })
      }

      const url = `${BASE}/${model}:generateContent?key=${apiKey}`
      const geminiPayload = {
        contents: [{ role: 'user', parts: reqParts }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      })

      const json = await res.json() as {
        candidates?: {
          content?: { parts?: { inlineData?: { data?: string; mimeType?: string }; text?: string }[] }
          finishReason?: string
        }[]
        error?: { message?: string }
      }

      if (!res.ok || json.error) {
        return NextResponse.json({ error: json.error?.message ?? `API error ${res.status}` }, { status: res.status })
      }

      const resParts = json.candidates?.[0]?.content?.parts ?? []
      const imagePart = resParts.find(p => p.inlineData?.data)
      if (!imagePart?.inlineData?.data) {
        const finishReason = json.candidates?.[0]?.finishReason
        const modelText = resParts.find(p => p.text)?.text?.slice(0, 300)
        const reason = finishReason === 'SAFETY'
          ? 'Blocked by safety filters — try a different prompt.'
          : modelText
            ? `Model response: ${modelText}`
            : 'No image returned. Try a different prompt or model.'
        return NextResponse.json({ error: reason }, { status: 502 })
      }

      await logUsage()
      return NextResponse.json(withRemaining({
        imageData: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType ?? 'image/png',
      }))
    }

    // ── Imagen 4 (predict) ──────────────────────────────────────────────────────
    if (IMAGEN_MODELS.has(model)) {
      const IMAGEN_AR_MAP: Record<string, string> = {
        '1:1': '1:1', '9:16': '9:16', '16:9': '16:9', '4:3': '4:3', '3:4': '3:4', '4:5': '3:4',
      }
      const imagenAR = IMAGEN_AR_MAP[aspectRatio] ?? '1:1'

      const styleSuffix = STYLE_SUFFIXES[style] ?? STYLE_SUFFIXES.photorealistic
      const cappedPrompt = prompt.trim().slice(0, 2000)
      const fullPrompt = `${cappedPrompt}. ${styleSuffix}${QUALITY_SUFFIX}`

      const url = `${BASE}/${model}:predict?key=${apiKey}`
      const imagenPayload = {
        instances: [{ prompt: fullPrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: imagenAR,
          personGeneration: 'ALLOW_ALL',
          enhancePrompt: true,
          ...(negativePrompt?.trim() ? { negativePrompt: negativePrompt.trim() } : {}),
        },
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imagenPayload),
      })

      const json = await res.json() as {
        predictions?: { bytesBase64Encoded?: string; mimeType?: string }[]
        error?: { message?: string }
      }

      if (!res.ok || json.error) {
        return NextResponse.json({ error: json.error?.message ?? `Imagen API error ${res.status}` }, { status: res.status })
      }

      const prediction = json.predictions?.[0]
      if (!prediction?.bytesBase64Encoded) {
        return NextResponse.json({ error: 'No image returned from Imagen API' }, { status: 502 })
      }

      await logUsage()
      return NextResponse.json(withRemaining({
        imageData: prediction.bytesBase64Encoded,
        mimeType: prediction.mimeType ?? 'image/png',
      }))
    }

    return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 })

  } catch (err) {
    console.error('[ai-image/generate]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Network error' },
      { status: 502 },
    )
  }
}
