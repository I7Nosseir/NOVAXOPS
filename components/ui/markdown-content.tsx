'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface MarkdownContentProps {
  content: string
  className?: string
  size?: 'xs' | 'sm' | 'base'
}

export function MarkdownContent({ content, className, size = 'sm' }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        'text-slate-700 leading-relaxed',
        size === 'xs' && 'text-[11px]',
        size === 'sm' && 'text-sm',
        size === 'base' && 'text-base',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-bold text-slate-900 mt-5 mb-2 first:mt-0 pb-1 border-b border-slate-200 text-base">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-bold text-slate-900 mt-4 mb-1.5 first:mt-0 text-sm">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-semibold text-slate-800 mt-3 mb-1 first:mt-0 text-sm">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-1.5 leading-relaxed">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-600">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="my-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="flex gap-2 text-slate-700">
              <span className="text-novax-border shrink-0 select-none mt-0.5" aria-hidden>–</span>
              <span className="flex-1">{children}</span>
            </li>
          ),
          hr: () => (
            <hr className="my-3 border-slate-200" />
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-novax-border pl-3 text-slate-600 italic my-2">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto my-2 text-xs">
              {children}
            </pre>
          ),
          code: ({ children }) => (
            <code className="bg-slate-100 px-1 py-0.5 rounded text-[0.9em]">{children}</code>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full text-left border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-50 border-b border-slate-200">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-semibold text-slate-700 text-xs uppercase tracking-wider">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-slate-100 text-slate-700">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
