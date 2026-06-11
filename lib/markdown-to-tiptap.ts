// Converts a markdown string to Tiptap (ProseMirror) JSON.
// Handles: headings H1-H6, bold, italic, strikethrough, code spans,
// bullet lists, ordered lists, blockquotes, horizontal rules, paragraphs.
// Multi-line paragraphs are collapsed to a single node.

type TiptapMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'strike' }
  | { type: 'code' }

interface TiptapTextNode {
  type: 'text'
  text: string
  marks?: TiptapMark[]
}

type TiptapInlineNode = TiptapTextNode

type TiptapNode =
  | { type: 'doc';            content: TiptapNode[] }
  | { type: 'paragraph';      content: TiptapInlineNode[] }
  | { type: 'heading';        attrs: { level: number }; content: TiptapInlineNode[] }
  | { type: 'bulletList';     content: TiptapNode[] }
  | { type: 'orderedList';    content: TiptapNode[] }
  | { type: 'listItem';       content: TiptapNode[] }
  | { type: 'blockquote';     content: TiptapNode[] }
  | { type: 'horizontalRule' }
  | { type: 'hardBreak' }

// ── Inline parser ──────────────────────────────────────────────────────────────

function parseInline(text: string): TiptapInlineNode[] {
  const nodes: TiptapInlineNode[] = []
  // Match **bold**, *italic*, ~~strike~~, `code` — bold must come before italic
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`([^`]+)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }
    if (match[1] !== undefined) {
      nodes.push({ type: 'text', text: match[1], marks: [{ type: 'bold' }] })
    } else if (match[2] !== undefined) {
      nodes.push({ type: 'text', text: match[2], marks: [{ type: 'italic' }] })
    } else if (match[3] !== undefined) {
      nodes.push({ type: 'text', text: match[3], marks: [{ type: 'strike' }] })
    } else if (match[4] !== undefined) {
      nodes.push({ type: 'text', text: match[4], marks: [{ type: 'code' }] })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push({ type: 'text', text: text.slice(lastIndex) })
  }

  return nodes.length > 0 ? nodes : [{ type: 'text', text: '' }]
}

// ── Block parser ──────────────────────────────────────────────────────────────

export function markdownToTiptap(markdown: string): object {
  const lines = markdown.split('\n')
  const content: TiptapNode[] = []
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trimEnd()

    // ── Heading ──
    const hMatch = line.match(/^(#{1,6})\s+(.*)/)
    if (hMatch) {
      const level = Math.min(hMatch[1].length, 6)
      content.push({ type: 'heading', attrs: { level }, content: parseInline(hMatch[2]) })
      i++
      continue
    }

    // ── Horizontal rule ──
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      content.push({ type: 'horizontalRule' })
      i++
      continue
    }

    // ── Bullet list ──
    if (/^[-*+]\s/.test(line)) {
      const items: TiptapNode[] = []
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^[-*+]\s+/, '')
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(itemText) }] })
        i++
      }
      content.push({ type: 'bulletList', content: items })
      continue
    }

    // ── Ordered list ──
    if (/^\d+\.\s/.test(line)) {
      const items: TiptapNode[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\.\s+/, '')
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(itemText) }] })
        i++
      }
      content.push({ type: 'orderedList', content: items })
      continue
    }

    // ── Blockquote ──
    if (/^>\s?/.test(line)) {
      const quoteText = line.replace(/^>\s?/, '')
      content.push({ type: 'blockquote', content: [{ type: 'paragraph', content: parseInline(quoteText) }] })
      i++
      continue
    }

    // ── Empty line — skip ──
    if (!line.trim()) {
      i++
      continue
    }

    // ── Paragraph — collect until empty line or next block element ──
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s?|-{3,}|\*{3,}|_{3,})/.test(lines[i])
    ) {
      paraLines.push(lines[i].trimEnd())
      i++
    }
    if (paraLines.length > 0) {
      content.push({ type: 'paragraph', content: parseInline(paraLines.join(' ')) })
    }
  }

  if (content.length === 0) {
    content.push({ type: 'paragraph', content: [{ type: 'text', text: '' }] })
  }

  return { type: 'doc', content }
}

// ── Markdown table → SheetEditor format ─────────────────────────────────────
// Parses a markdown table into { rows, numCols } expected by SheetEditor.
// Separator rows (| :--- | --- |) are skipped automatically.

export function markdownTableToSheet(markdown: string): { rows: string[][]; numCols: number } {
  const isSeparator = (line: string) => /^\|[\s|:-]+\|$/.test(line.trim())
  const tableLines = markdown
    .split('\n')
    .filter(l => {
      const t = l.trim()
      return t.startsWith('|') && t.endsWith('|') && !isSeparator(l)
    })
  const parseRow = (line: string): string[] =>
    line.split('|').slice(1, -1).map(cell => cell.trim())
  const rows = tableLines.map(parseRow)
  const numCols = Math.max(...rows.map(r => r.length), 1)
  return {
    numCols,
    rows: rows.map(r => {
      const padded = [...r]
      while (padded.length < numCols) padded.push('')
      return padded.slice(0, numCols)
    }),
  }
}

// Detect whether a markdown string is primarily a table
export function isMarkdownTable(text: string): boolean {
  const lines = text.trim().split('\n')
  return (
    lines.length >= 2 &&
    lines[0].trim().startsWith('|') &&
    lines[0].trim().endsWith('|') &&
    /^\|[\s|:-]+\|$/.test((lines[1] ?? '').trim())
  )
}

// ── Tiptap JSON → plain text (inverse, for previews) ────────────────────────
// Re-exported here so callers don't need to duplicate the logic.

export function tiptapNodeToText(node: unknown, depth = 0): string {
  if (depth > 20) return ''
  if (typeof node === 'string') return node
  if (!node || typeof node !== 'object') return ''
  const n = node as Record<string, unknown>
  if (n.type === 'text') return typeof n.text === 'string' ? n.text : ''
  const children = Array.isArray(n.content) ? n.content : []
  const childText = children.map((c: unknown) => tiptapNodeToText(c, depth + 1)).join('')
  const blockTypes = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'hardBreak'])
  return blockTypes.has(String(n.type)) ? `${childText}\n` : childText
}
