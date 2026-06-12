'use client'

import { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import {
  Bold, Italic, Heading1, Heading2, Heading3,
  List, ListOrdered, Minus, AlignLeft, AlignCenter, AlignRight,
  Underline as UnderlineIcon, Strikethrough, Code, Quote,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocEditorProps {
  content:   object
  onChange:  (json: object) => void
  editable?: boolean
}

export interface DocEditorRef {
  applyContent: (text: string) => void
}

// ── Color palettes (same as SheetEditor) ──────────────────────
const TEXT_COLORS = [
  { v: '#000000', l: 'Black'       },
  { v: '#374151', l: 'Dark Gray'   },
  { v: '#6B7280', l: 'Gray'        },
  { v: '#DC2626', l: 'Red'         },
  { v: '#EA580C', l: 'Orange'      },
  { v: '#CA8A04', l: 'Yellow'      },
  { v: '#16A34A', l: 'Green'       },
  { v: '#2563EB', l: 'Blue'        },
  { v: '#9333EA', l: 'Purple'      },
  { v: '#DB2777', l: 'Pink'        },
  { v: '#0F766E', l: 'Teal'        },
  { v: '#1B3D38', l: 'NOVAX Green' },
  { v: '#FFFFFF', l: 'White'       },
]

const HIGHLIGHT_COLORS = [
  { v: '',        l: 'None'       },
  { v: '#FEF9C3', l: 'Yellow'     },
  { v: '#DCFCE7', l: 'Green'      },
  { v: '#DBEAFE', l: 'Blue'       },
  { v: '#F3E8FF', l: 'Purple'     },
  { v: '#FEE2E2', l: 'Red'        },
  { v: '#FFEDD5', l: 'Orange'     },
  { v: '#F1F5F9', l: 'Slate'      },
  { v: '#EBF4F3', l: 'Teal Light' },
  { v: '#BBF7D0', l: 'Mint'       },
  { v: '#BAE6FD', l: 'Sky'        },
  { v: '#DDD6FE', l: 'Lavender'   },
  { v: '#FECDD3', l: 'Rose'       },
]

// ── Markdown → HTML (preview only — DB stores accurate Tiptap JSON) ──
function markdownToHtml(text: string): string {
  return text
    .split('\n\n')
    .map(block => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('### ')) return `<h3>${trimmed.slice(4)}</h3>`
      if (trimmed.startsWith('## '))  return `<h2>${trimmed.slice(3)}</h2>`
      if (trimmed.startsWith('# '))   return `<h1>${trimmed.slice(2)}</h1>`
      if (trimmed.startsWith('> '))   return `<blockquote><p>${trimmed.slice(2)}</p></blockquote>`
      if (trimmed.startsWith('```')) {
        const code = trimmed.replace(/^```[\w]*\n?/, '').replace(/```$/, '')
        return `<pre><code>${code}</code></pre>`
      }
      if (trimmed.split('\n').every(l => l.trim().startsWith('- ') || l.trim().startsWith('* '))) {
        const items = trimmed.split('\n').map(l => `<li>${l.replace(/^[-*]\s+/, '')}</li>`).join('')
        return `<ul>${items}</ul>`
      }
      if (trimmed.split('\n').every(l => /^\d+\.\s/.test(l.trim()))) {
        const items = trimmed.split('\n').map(l => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`).join('')
        return `<ol>${items}</ol>`
      }
      const inlined = trimmed
        .replace(/\*\*(.+?)\*\*/g,  '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,       '<em>$1</em>')
        .replace(/`(.+?)`/g,         '<code>$1</code>')
        .replace(/\n/g,              '<br/>')
      return `<p>${inlined}</p>`
    })
    .filter(Boolean)
    .join('')
}

// ── Toolbar primitives ─────────────────────────────────────────
function TBtn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean
  title: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors shrink-0',
        active   ? 'bg-novax-light text-novax'
                 : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
      )}
    >
      {children}
    </button>
  )
}

function TDivider() {
  return <div className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" />
}

// ── Color picker dropdown (same UX as SheetEditor) ─────────────
function DocColorPicker({
  colors,
  label,
  onPick,
  onReset,
}: {
  colors:   { v: string; l: string }[]
  label:    string
  onPick:   (v: string) => void
  onReset:  () => void
}) {
  return (
    <div
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-2 min-w-[160px]"
      onMouseDown={e => e.preventDefault()} // keep editor focus
    >
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-0.5">
        {label}
      </p>
      <div className="grid grid-cols-5 gap-1">
        {colors.map(col => (
          <button
            key={col.v + col.l}
            type="button"
            title={col.l}
            onClick={() => onPick(col.v)}
            className={cn(
              'w-6 h-6 rounded border transition-transform hover:scale-110',
              col.v ? 'border-slate-200' : 'border-dashed border-slate-300',
            )}
            style={{ background: col.v || '#fff' }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onReset}
        className="mt-1.5 text-[10px] text-slate-500 hover:text-slate-800 transition-colors w-full text-left px-0.5"
      >
        Reset
      </button>
    </div>
  )
}

// ── DocEditor ──────────────────────────────────────────────────
export const DocEditor = forwardRef<DocEditorRef, DocEditorProps>(function DocEditor(
  { content, onChange, editable = true },
  ref,
) {
  const [picker, setPicker] = useState<'color' | 'highlight' | null>(null)

  const closePicker = useCallback(() => setPicker(null), [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: Object.keys(content).length > 0 ? content : '',
    editable,
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON())
    },
  })

  // Expose applyContent — does NOT call onChange (DB is already saved by AI API;
  // the novax:doc-ai-saved event triggers a remount that loads fresh DB content).
  useImperativeHandle(ref, () => ({
    applyContent(text: string) {
      if (!editor) return
      editor.commands.setContent(markdownToHtml(text))
      // Intentionally no onChange() call — avoids overwriting accurate DB JSON.
    },
  }), [editor])

  // Sync editable prop
  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable)
  }, [editor, editable])

  // Sync initial content (mount only)
  useEffect(() => {
    if (!editor) return
    const incoming = JSON.stringify(content)
    const current  = JSON.stringify(editor.getJSON())
    if (incoming !== current && Object.keys(content).length > 0) {
      editor.commands.setContent(content)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  if (!editor) return null

  const currentColor     = editor.getAttributes('textStyle').color     as string | undefined
  const currentHighlight = editor.getAttributes('highlight').color     as string | undefined

  return (
    <div
      className="border border-slate-200 rounded-xl overflow-hidden bg-white"
      onClick={closePicker}
    >
      {/* ── Toolbar ────────────────────────────────────────── */}
      <div className="flex items-center flex-wrap gap-0.5 px-3 py-2 border-b border-slate-200 bg-slate-50">

        {/* Inline: bold / italic / underline / strike / code */}
        <TBtn onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive('bold')} disabled={!editable} title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive('italic')} disabled={!editable} title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleUnderline().run()}
              active={editor.isActive('underline')} disabled={!editable} title="Underline">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleStrike().run()}
              active={editor.isActive('strike')} disabled={!editable} title="Strikethrough">
          <Strikethrough className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleCode().run()}
              active={editor.isActive('code')} disabled={!editable} title="Inline code">
          <Code className="w-3.5 h-3.5" />
        </TBtn>

        <TDivider />

        {/* Block type: H1 / H2 / H3 / Blockquote */}
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              active={editor.isActive('heading', { level: 1 })} disabled={!editable} title="Heading 1">
          <Heading1 className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive('heading', { level: 2 })} disabled={!editable} title="Heading 2">
          <Heading2 className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor.isActive('heading', { level: 3 })} disabled={!editable} title="Heading 3">
          <Heading3 className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive('blockquote')} disabled={!editable} title="Blockquote">
          <Quote className="w-3.5 h-3.5" />
        </TBtn>

        <TDivider />

        {/* Alignment */}
        <TBtn onClick={() => editor.chain().focus().setTextAlign('left').run()}
              active={editor.isActive({ textAlign: 'left' })} disabled={!editable} title="Align left">
          <AlignLeft className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().setTextAlign('center').run()}
              active={editor.isActive({ textAlign: 'center' })} disabled={!editable} title="Align center">
          <AlignCenter className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().setTextAlign('right').run()}
              active={editor.isActive({ textAlign: 'right' })} disabled={!editable} title="Align right">
          <AlignRight className="w-3.5 h-3.5" />
        </TBtn>

        <TDivider />

        {/* Lists / rule */}
        <TBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive('bulletList')} disabled={!editable} title="Bullet list">
          <List className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive('orderedList')} disabled={!editable} title="Ordered list">
          <ListOrdered className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().setHorizontalRule().run()}
              disabled={!editable} title="Horizontal rule">
          <Minus className="w-3.5 h-3.5" />
        </TBtn>

        {editable && (
          <>
            <TDivider />

            {/* Text color */}
            <div className="relative shrink-0">
              <button
                type="button"
                title="Text color"
                onClick={e => { e.stopPropagation(); setPicker(v => v === 'color' ? null : 'color') }}
                className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex flex-col items-center gap-0.5"
              >
                <span
                  className="text-[11px] font-bold leading-none"
                  style={{ color: currentColor || '#000' }}
                >A</span>
                <div className="w-4 h-0.5 rounded-sm" style={{ background: currentColor || '#000' }} />
              </button>
              {picker === 'color' && (
                <DocColorPicker
                  colors={TEXT_COLORS}
                  label="Text Color"
                  onPick={v => {
                    editor.chain().focus().setColor(v).run()
                    setPicker(null)
                  }}
                  onReset={() => {
                    editor.chain().focus().unsetColor().run()
                    setPicker(null)
                  }}
                />
              )}
            </div>

            {/* Highlight color */}
            <div className="relative shrink-0">
              <button
                type="button"
                title="Highlight color"
                onClick={e => { e.stopPropagation(); setPicker(v => v === 'highlight' ? null : 'highlight') }}
                className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex flex-col items-center gap-0.5"
              >
                <div
                  className="w-4 h-3 rounded-sm border border-slate-300"
                  style={{ background: currentHighlight || 'transparent' }}
                />
                <div className="w-4 h-0.5 rounded-sm bg-slate-400" />
              </button>
              {picker === 'highlight' && (
                <DocColorPicker
                  colors={HIGHLIGHT_COLORS}
                  label="Highlight"
                  onPick={v => {
                    if (v) editor.chain().focus().setHighlight({ color: v }).run()
                    else   editor.chain().focus().unsetHighlight().run()
                    setPicker(null)
                  }}
                  onReset={() => {
                    editor.chain().focus().unsetHighlight().run()
                    setPicker(null)
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Editor area ────────────────────────────────────── */}
      <div className="px-5 py-4">
        <EditorContent
          editor={editor}
          className={cn(
            'min-h-64 text-sm text-slate-700 leading-relaxed',
            '[&_.ProseMirror]:outline-none',
            '[&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:text-slate-900 [&_.ProseMirror_h1]:mb-2 [&_.ProseMirror_h1]:mt-4',
            '[&_.ProseMirror_h2]:text-base [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-slate-800 [&_.ProseMirror_h2]:mb-1.5 [&_.ProseMirror_h2]:mt-3',
            '[&_.ProseMirror_h3]:text-sm [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-slate-700 [&_.ProseMirror_h3]:mb-1 [&_.ProseMirror_h3]:mt-2',
            '[&_.ProseMirror_p]:mb-2',
            '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ul]:mb-2',
            '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_ol]:mb-2',
            '[&_.ProseMirror_li]:mb-0.5',
            '[&_.ProseMirror_hr]:border-slate-200 [&_.ProseMirror_hr]:my-3',
            '[&_.ProseMirror_strong]:font-semibold',
            '[&_.ProseMirror_em]:italic',
            '[&_.ProseMirror_u]:underline',
            '[&_.ProseMirror_s]:line-through',
            '[&_.ProseMirror_code]:bg-slate-100 [&_.ProseMirror_code]:text-rose-600 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:text-[0.85em] [&_.ProseMirror_code]:font-mono',
            '[&_.ProseMirror_pre]:bg-slate-900 [&_.ProseMirror_pre]:text-slate-100 [&_.ProseMirror_pre]:rounded-lg [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_pre]:my-3 [&_.ProseMirror_pre]:overflow-x-auto',
            '[&_.ProseMirror_pre_code]:bg-transparent [&_.ProseMirror_pre_code]:text-slate-100 [&_.ProseMirror_pre_code]:p-0',
            '[&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-novax-border [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:text-slate-500 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:my-3',
            '[&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_.is-editor-empty:first-child::before]:text-slate-400 [&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0',
          )}
        />
      </div>
    </div>
  )
})
