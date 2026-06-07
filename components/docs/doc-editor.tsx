'use client'

import { useEffect, forwardRef, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocEditorProps {
  content: object
  onChange: (json: object) => void
  editable?: boolean
}

export interface DocEditorRef {
  applyContent: (text: string) => void
}

// Convert AI markdown text → basic HTML for Tiptap
function markdownToHtml(text: string): string {
  return text
    .split('\n\n')
    .map(block => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('### ')) return `<h3>${trimmed.slice(4)}</h3>`
      if (trimmed.startsWith('## '))  return `<h2>${trimmed.slice(3)}</h2>`
      if (trimmed.startsWith('# '))   return `<h1>${trimmed.slice(2)}</h1>`
      // bullet list block
      if (trimmed.split('\n').every(l => l.trim().startsWith('- ') || l.trim().startsWith('* '))) {
        const items = trimmed.split('\n').map(l => `<li>${l.replace(/^[-*]\s+/, '')}</li>`).join('')
        return `<ul>${items}</ul>`
      }
      // ordered list block
      if (trimmed.split('\n').every(l => /^\d+\.\s/.test(l.trim()))) {
        const items = trimmed.split('\n').map(l => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`).join('')
        return `<ol>${items}</ol>`
      }
      // paragraph — inline formatting
      const inlined = trimmed
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,     '<em>$1</em>')
        .replace(/\n/g,            '<br/>')
      return `<p>${inlined}</p>`
    })
    .filter(Boolean)
    .join('')
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-novax-light text-novax'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-slate-200 mx-0.5" />
}

export const DocEditor = forwardRef<DocEditorRef, DocEditorProps>(function DocEditor(
  { content, onChange, editable = true },
  ref,
) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: Object.keys(content).length > 0 ? content : '',
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
    },
  })

  useImperativeHandle(ref, () => ({
    applyContent(text: string) {
      if (!editor) return
      const html = markdownToHtml(text)
      editor.commands.setContent(html)
      onChange(editor.getJSON())
    },
  }), [editor, onChange])

  // Sync editable prop changes
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  // Sync external content changes (e.g. initial load)
  useEffect(() => {
    if (!editor) return
    const incoming = JSON.stringify(content)
    const current = JSON.stringify(editor.getJSON())
    if (incoming !== current && Object.keys(content).length > 0) {
      editor.commands.setContent(content)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  if (!editor) return null

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-slate-200 bg-slate-50">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          disabled={!editable}
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          disabled={!editable}
          title="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          disabled={!editable}
          title="Heading 1"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          disabled={!editable}
          title="Heading 2"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          disabled={!editable}
          title="Bullet List"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          disabled={!editable}
          title="Ordered List"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          disabled={!editable}
          title="Horizontal Rule"
        >
          <Minus className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <div className="px-5 py-4">
        <EditorContent
          editor={editor}
          className="min-h-64 text-sm text-slate-700 leading-relaxed focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:text-slate-900 [&_.ProseMirror_h1]:mb-2 [&_.ProseMirror_h1]:mt-4 [&_.ProseMirror_h2]:text-base [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-slate-800 [&_.ProseMirror_h2]:mb-1.5 [&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_p]:mb-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ul]:mb-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_ol]:mb-2 [&_.ProseMirror_li]:mb-0.5 [&_.ProseMirror_hr]:border-slate-200 [&_.ProseMirror_hr]:my-3 [&_.ProseMirror_strong]:font-semibold [&_.ProseMirror_em]:italic [&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_.is-editor-empty:first-child::before]:text-slate-400 [&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0"
        />
      </div>
    </div>
  )
})
