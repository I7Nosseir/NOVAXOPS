import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const uint8arr = new Uint8Array(bytes)

    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    // Disable web worker for server-side Node.js usage
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''

    const pdf = await pdfjsLib.getDocument({
      data: uint8arr,
      useWorkerFetch: false,
      useSystemFonts: true,
    }).promise

    const pages: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item: unknown) => ((item as { str?: string }).str ?? ''))
        .join(' ')
        .trim()
      if (pageText) pages.push(pageText)
    }

    return NextResponse.json({ text: pages.join('\n\n'), pages: pdf.numPages })
  } catch (err) {
    console.error('[extract-text] PDF extraction error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Failed to extract text from PDF' }, { status: 500 })
  }
}
