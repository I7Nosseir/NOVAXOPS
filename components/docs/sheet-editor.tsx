'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Download, Plus } from 'lucide-react'

const DEFAULT_COLS = 26
const DEFAULT_ROWS = 50
const COL_W = 110
const ROW_H = 28
const NUM_COL_W = 42

function colLabel(i: number): string {
  let label = ''
  let n = i + 1
  while (n > 0) {
    n--
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26)
  }
  return label
}

interface SheetData {
  rows: string[][]
  numCols: number
}

function parseContent(content: object): SheetData {
  const c = content as Partial<SheetData>
  const numCols = c.numCols ?? DEFAULT_COLS
  const rows = c.rows ?? Array.from({ length: DEFAULT_ROWS }, () => Array(numCols).fill('') as string[])
  // Ensure every row has numCols entries
  return {
    numCols,
    rows: rows.map(r => {
      if (r.length >= numCols) return r
      return [...r, ...Array(numCols - r.length).fill('')]
    }),
  }
}

interface Props {
  content: object
  onChange: (json: object) => void
  editable?: boolean
  title?: string
}

export function SheetEditor({ content, onChange, editable = true, title }: Props) {
  const { rows: init, numCols } = parseContent(content)
  const [cells, setCells] = useState<string[][]>(init)
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null)
  const [editVal, setEditVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const numRows = cells.length

  // Keep cells in sync when content prop changes externally (initial DB load)
  useEffect(() => {
    const { rows: newRows, numCols: newCols } = parseContent(content)
    setCells(newRows)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only on mount — local edits always win after mount

  const commit = useCallback((r: number, c: number, val: string) => {
    setCells(prev => {
      const next = prev.map(row => [...row])
      next[r][c] = val
      onChange({ rows: next, numCols })
      return next
    })
  }, [numCols, onChange])

  const select = (r: number, c: number) => {
    if (!editable) return
    if (sel) commit(sel.r, sel.c, editVal)
    setSel({ r, c })
    setEditVal(cells[r]?.[c] ?? '')
  }

  useEffect(() => {
    if (sel && inputRef.current) inputRef.current.focus()
  }, [sel?.r, sel?.c]) // eslint-disable-line react-hooks/exhaustive-deps

  const move = (r: number, c: number, dr: number, dc: number) => {
    commit(r, c, editVal)
    const nr = Math.max(0, Math.min(numRows - 1, r + dr))
    const nc = Math.max(0, Math.min(numCols - 1, c + dc))
    setSel({ r: nr, c: nc })
    setEditVal(cells[nr]?.[nc] ?? '')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) move(r, c, 0, -1); else move(r, c, 0, 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      move(r, c, 1, 0)
    } else if (e.key === 'Escape') {
      setEditVal(cells[r]?.[c] ?? '')
      setSel(null)
    } else if (e.key === 'ArrowDown' && e.ctrlKey) { move(r, c, 1, 0) }
    else if (e.key === 'ArrowUp' && e.ctrlKey) { move(r, c, -1, 0) }
    else if (e.key === 'ArrowRight' && e.ctrlKey) { move(r, c, 0, 1) }
    else if (e.key === 'ArrowLeft' && e.ctrlKey) { move(r, c, 0, -1) }
  }

  const addRows = () => {
    setCells(prev => {
      const next = [...prev, ...Array.from({ length: 10 }, () => Array(numCols).fill('') as string[])]
      onChange({ rows: next, numCols })
      return next
    })
  }

  const exportXlsx = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(cells)
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    XLSX.writeFile(wb, `${title ?? 'spreadsheet'}.xlsx`)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
        {sel && (
          <span className="text-[11px] font-mono font-semibold text-novax-muted bg-novax-light px-2 py-0.5 rounded">
            {colLabel(sel.c)}{sel.r + 1}
          </span>
        )}
        <div className="flex-1" />
        {editable && (
          <button
            onClick={exportXlsx}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white hover:border-slate-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download .xlsx
          </button>
        )}
        {!editable && (
          <button
            onClick={exportXlsx}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download .xlsx
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-auto flex-1">
        <table
          className="border-collapse"
          style={{ tableLayout: 'fixed', width: NUM_COL_W + numCols * COL_W }}
        >
          {/* Column headers */}
          <colgroup>
            <col style={{ width: NUM_COL_W }} />
            {Array.from({ length: numCols }, (_, i) => (
              <col key={i} style={{ width: COL_W }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                className="sticky top-0 left-0 z-20 bg-slate-100 border border-slate-200 select-none"
                style={{ height: ROW_H }}
              />
              {Array.from({ length: numCols }, (_, c) => (
                <th
                  key={c}
                  className="sticky top-0 z-10 bg-slate-100 border border-slate-200 text-center text-[10px] font-semibold text-slate-500 select-none"
                  style={{ height: ROW_H }}
                >
                  {colLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cells.map((row, r) => (
              <tr key={r}>
                {/* Row number */}
                <td
                  className="sticky left-0 z-10 bg-slate-100 border border-slate-200 text-center text-[10px] font-medium text-slate-400 select-none"
                  style={{ height: ROW_H, minWidth: NUM_COL_W }}
                >
                  {r + 1}
                </td>

                {row.map((cellVal, c) => {
                  const isSel = sel?.r === r && sel?.c === c
                  return (
                    <td
                      key={c}
                      onClick={() => select(r, c)}
                      className={`border border-slate-200 p-0 relative ${
                        isSel
                          ? 'outline outline-2 outline-novax z-10'
                          : editable ? 'hover:bg-blue-50/30 cursor-cell' : ''
                      }`}
                      style={{ height: ROW_H }}
                    >
                      {isSel ? (
                        <input
                          ref={inputRef}
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => { commit(r, c, editVal); setSel(null) }}
                          onKeyDown={e => handleKeyDown(e, r, c)}
                          className="absolute inset-0 w-full h-full px-1.5 outline-none bg-white text-xs font-mono text-slate-800"
                          style={{ border: 'none' }}
                        />
                      ) : (
                        <span className="block px-1.5 text-xs font-mono text-slate-700 overflow-hidden whitespace-nowrap text-ellipsis leading-none" style={{ lineHeight: `${ROW_H}px` }}>
                          {cellVal}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add rows */}
        {editable && (
          <button
            onClick={addRows}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-novax transition-colors w-full border-t border-slate-200 bg-white"
          >
            <Plus className="w-3 h-3" /> Add 10 rows
          </button>
        )}
      </div>
    </div>
  )
}
