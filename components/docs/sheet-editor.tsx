'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Download, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Constants ──────────────────────────────────────────────────
const DEFAULT_COLS  = 26
const DEFAULT_ROWS  = 50
const MIN_COL_W     = 48
const DEFAULT_COL_W = 120
const MIN_ROW_H     = 22
const DEFAULT_ROW_H = 28
const NUM_COL_W     = 44

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

// ── Types ──────────────────────────────────────────────────────
interface CellFormat {
  textColor?: string
  bgColor?:   string
  bold?:      boolean
}

interface SheetContent {
  rows:        string[][]
  numCols:     number
  colWidths?:  number[]
  rowHeights?: number[]
  formatting?: Record<string, CellFormat>
}

// ── Color palettes ─────────────────────────────────────────────
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

const BG_COLORS = [
  { v: '',        l: 'None'        },
  { v: '#FEF9C3', l: 'Yellow'      },
  { v: '#DCFCE7', l: 'Green'       },
  { v: '#DBEAFE', l: 'Blue'        },
  { v: '#F3E8FF', l: 'Purple'      },
  { v: '#FEE2E2', l: 'Red'         },
  { v: '#FFEDD5', l: 'Orange'      },
  { v: '#F1F5F9', l: 'Slate'       },
  { v: '#EBF4F3', l: 'Teal Light'  },
  { v: '#BBF7D0', l: 'Mint'        },
  { v: '#BAE6FD', l: 'Sky'         },
  { v: '#DDD6FE', l: 'Lavender'    },
  { v: '#FECDD3', l: 'Rose'        },
]

// ── Parse content (always ≥ 26 cols, backward-compatible) ──────
function parseSheet(raw: object): Required<SheetContent> {
  const c       = raw as Partial<SheetContent>
  const numCols = Math.max(c.numCols ?? DEFAULT_COLS, DEFAULT_COLS)
  const stored  = c.rows ?? []
  const numRows = Math.max(stored.length, DEFAULT_ROWS)

  const rows = Array.from({ length: numRows }, (_, r) => {
    const src = stored[r] ?? []
    return Array.from({ length: numCols }, (_, col) => src[col] ?? '')
  })

  const colWidths  = Array.from({ length: numCols }, (_, i) => c.colWidths?.[i]  ?? DEFAULT_COL_W)
  const rowHeights = Array.from({ length: numRows }, (_, i) => c.rowHeights?.[i] ?? DEFAULT_ROW_H)

  return { rows, numCols, colWidths, rowHeights, formatting: c.formatting ?? {} }
}

// ── Color picker (outside component to prevent remount on re-render) ──
function ColorPicker({
  type,
  onApply,
}: {
  type:    'text' | 'bg'
  onApply: (patch: Partial<CellFormat>) => void
}) {
  const colors = type === 'text' ? TEXT_COLORS : BG_COLORS
  return (
    <div
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-2 min-w-[160px]"
      onClick={e => e.stopPropagation()}
    >
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-0.5">
        {type === 'text' ? 'Text Color' : 'Cell Background'}
      </p>
      <div className="grid grid-cols-5 gap-1">
        {colors.map(col => (
          <button
            key={col.v + col.l}
            title={col.l}
            onClick={() =>
              onApply(
                type === 'text'
                  ? { textColor: col.v || undefined }
                  : { bgColor:   col.v || undefined },
              )
            }
            className={cn(
              'w-6 h-6 rounded border transition-transform hover:scale-110',
              col.v ? 'border-slate-200' : 'border-dashed border-slate-300',
            )}
            style={{ background: col.v || '#fff' }}
          />
        ))}
      </div>
      <button
        onClick={() =>
          onApply(type === 'text' ? { textColor: undefined } : { bgColor: undefined })
        }
        className="mt-1.5 text-[10px] text-slate-500 hover:text-slate-800 transition-colors w-full text-left px-0.5"
      >
        Reset
      </button>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────
interface Props {
  content:   object
  onChange:  (json: object) => void
  editable?: boolean
  title?:    string
}

export function SheetEditor({ content, onChange, editable = true, title }: Props) {
  const init = parseSheet(content)

  const [cells,      setCells]      = useState<string[][]>(init.rows)
  const [colWidths,  setColWidths]  = useState<number[]>(init.colWidths)
  const [rowHeights, setRowHeights] = useState<number[]>(init.rowHeights)
  const [formatting, setFormatting] = useState<Record<string, CellFormat>>(init.formatting)
  const [sel,        setSel]        = useState<{ r: number; c: number } | null>(null)
  const [editVal,    setEditVal]    = useState('')
  const [picker,     setPicker]     = useState<'text' | 'bg' | null>(null)

  // Refs for stale-closure-safe access during drag/save
  const cellsRef  = useRef(cells)
  const colWRef   = useRef(colWidths)
  const rowHRef   = useRef(rowHeights)
  const fmtRef    = useRef(formatting)
  const isDragging = useRef(false)

  useEffect(() => { cellsRef.current  = cells      }, [cells])
  useEffect(() => { colWRef.current   = colWidths  }, [colWidths])
  useEffect(() => { rowHRef.current   = rowHeights }, [rowHeights])
  useEffect(() => { fmtRef.current    = formatting }, [formatting])

  const inputRef   = useRef<HTMLInputElement>(null)
  const numCols    = cells[0]?.length ?? DEFAULT_COLS
  const numRows    = cells.length

  // Mount-only sync
  useEffect(() => {
    const p = parseSheet(content)
    setCells(p.rows)
    setColWidths(p.colWidths)
    setRowHeights(p.rowHeights)
    setFormatting(p.formatting)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Persist ────────────────────────────────────────────────────
  const persist = useCallback((
    c?:  string[][],
    cw?: number[],
    rh?: number[],
    fm?: Record<string, CellFormat>,
  ) => {
    onChange({
      rows:       c  ?? cellsRef.current,
      numCols:    (c ?? cellsRef.current)[0]?.length ?? numCols,
      colWidths:  cw ?? colWRef.current,
      rowHeights: rh ?? rowHRef.current,
      formatting: fm ?? fmtRef.current,
    })
  }, [onChange, numCols])

  // ── Cell commit ────────────────────────────────────────────────
  const commit = useCallback((r: number, c: number, val: string) => {
    setCells(prev => {
      const next = prev.map(row => [...row])
      next[r][c] = val
      onChange({
        rows: next, numCols: next[0]?.length ?? 0,
        colWidths: colWRef.current, rowHeights: rowHRef.current, formatting: fmtRef.current,
      })
      return next
    })
  }, [onChange])

  // ── Selection ──────────────────────────────────────────────────
  const select = (r: number, c: number) => {
    if (!editable || isDragging.current) return
    if (sel) commit(sel.r, sel.c, editVal)
    setSel({ r, c })
    setEditVal(cells[r]?.[c] ?? '')
    setPicker(null)
  }

  useEffect(() => {
    if (sel && inputRef.current) inputRef.current.focus()
  }, [sel?.r, sel?.c]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ─────────────────────────────────────────────────
  const move = (r: number, c: number, dr: number, dc: number) => {
    commit(r, c, editVal)
    const nr = Math.max(0, Math.min(numRows - 1, r + dr))
    const nc = Math.max(0, Math.min(numCols - 1, c + dc))
    setSel({ r: nr, c: nc })
    setEditVal(cells[nr]?.[nc] ?? '')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key === 'Tab')    { e.preventDefault(); e.shiftKey ? move(r, c, 0, -1) : move(r, c, 0, 1) }
    else if (e.key === 'Enter')  { e.preventDefault(); move(r, c, 1, 0) }
    else if (e.key === 'Escape') { setEditVal(cells[r]?.[c] ?? ''); setSel(null) }
    else if (e.key === 'ArrowDown'  && !e.shiftKey) { e.preventDefault(); move(r, c, 1, 0)  }
    else if (e.key === 'ArrowUp'    && !e.shiftKey) { e.preventDefault(); move(r, c, -1, 0) }
    else if (e.key === 'ArrowRight' && !e.shiftKey) { e.preventDefault(); move(r, c, 0, 1)  }
    else if (e.key === 'ArrowLeft'  && !e.shiftKey) { e.preventDefault(); move(r, c, 0, -1) }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (editVal === '') { commit(r, c, ''); setEditVal('') }
    }
  }

  // ── Column resize ──────────────────────────────────────────────
  const startColResize = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true
    const startX  = e.clientX
    const startW  = colWRef.current[colIdx] ?? DEFAULT_COL_W
    let latestCW  = [...colWRef.current]

    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(MIN_COL_W, startW + ev.clientX - startX)
      latestCW = [...colWRef.current]
      latestCW[colIdx] = newW
      setColWidths([...latestCW])
    }
    const onUp = () => {
      isDragging.current = false
      persist(undefined, latestCW)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [persist])

  // ── Row resize ─────────────────────────────────────────────────
  const startRowResize = useCallback((e: React.MouseEvent, rowIdx: number) => {
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true
    const startY  = e.clientY
    const startH  = rowHRef.current[rowIdx] ?? DEFAULT_ROW_H
    let latestRH  = [...rowHRef.current]

    const onMove = (ev: MouseEvent) => {
      const newH = Math.max(MIN_ROW_H, startH + ev.clientY - startY)
      latestRH = [...rowHRef.current]
      latestRH[rowIdx] = newH
      setRowHeights([...latestRH])
    }
    const onUp = () => {
      isDragging.current = false
      persist(undefined, undefined, latestRH)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [persist])

  // ── Formatting ─────────────────────────────────────────────────
  const fmtKey = (r: number, c: number) => `${r},${c}`
  const getCellFmt = (r: number, c: number): CellFormat => formatting[fmtKey(r, c)] ?? {}

  const applyFmt = (patch: Partial<CellFormat>) => {
    if (!sel) return
    const key  = fmtKey(sel.r, sel.c)
    const next = { ...fmtRef.current, [key]: { ...getCellFmt(sel.r, sel.c), ...patch } }
    setFormatting(next)
    persist(undefined, undefined, undefined, next)
    setPicker(null)
  }

  const toggleBold = () => {
    if (!sel) return
    applyFmt({ bold: !getCellFmt(sel.r, sel.c).bold })
  }

  // ── Add rows / columns ─────────────────────────────────────────
  const addRows = () => {
    const nc      = cellsRef.current[0]?.length ?? numCols
    const newRows = Array.from({ length: 10 }, () => Array(nc).fill(''))
    const newCells = [...cellsRef.current, ...newRows]
    const newRH    = [...rowHRef.current, ...Array(10).fill(DEFAULT_ROW_H)]
    setCells(newCells)
    setRowHeights(newRH)
    persist(newCells, undefined, newRH)
  }

  const addCols = () => {
    const ADD  = 5
    const newCells = cellsRef.current.map(row => [...row, ...Array(ADD).fill('')])
    const newCW    = [...colWRef.current, ...Array(ADD).fill(DEFAULT_COL_W)]
    setCells(newCells)
    setColWidths(newCW)
    persist(newCells, newCW)
  }

  const exportXlsx = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(cells)
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    XLSX.writeFile(wb, `${title ?? 'spreadsheet'}.xlsx`)
  }

  const selFmt = sel ? getCellFmt(sel.r, sel.c) : {}
  const totalW  = NUM_COL_W + colWidths.reduce((a, b) => a + b, 0)

  return (
    <div className="flex flex-col h-full min-h-0" onClick={() => setPicker(null)}>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200 bg-white shrink-0 flex-wrap gap-y-1">

        {/* Cell reference */}
        <span className="text-[11px] font-mono font-semibold text-novax-muted bg-novax-light px-2 py-1 rounded min-w-[44px] text-center shrink-0">
          {sel ? `${colLabel(sel.c)}${sel.r + 1}` : '—'}
        </span>

        {/* Formula bar — shows full content of selected cell */}
        <div className="flex items-center flex-1 min-w-[120px] bg-slate-50 border border-slate-200 rounded px-2 py-1 gap-1.5">
          <span className="text-[10px] text-slate-400 shrink-0 font-mono">fx</span>
          <span className="flex-1 text-xs font-mono text-slate-700 truncate select-text">
            {sel ? (editVal || cells[sel.r]?.[sel.c] || '') : ''}
          </span>
        </div>

        {editable && (
          <>
            <div className="w-px h-5 bg-slate-200 shrink-0" />

            {/* Bold */}
            <button
              onClick={e => { e.stopPropagation(); toggleBold() }}
              title="Bold (Ctrl+B)"
              className={cn(
                'w-7 h-7 rounded text-sm font-bold transition-colors shrink-0',
                selFmt.bold ? 'bg-novax text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              B
            </button>

            {/* Text color */}
            <div className="relative shrink-0">
              <button
                onClick={e => { e.stopPropagation(); setPicker(v => v === 'text' ? null : 'text') }}
                title="Text color"
                className="w-7 h-7 rounded flex flex-col items-center justify-center gap-0.5 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <span className="text-[11px] font-bold leading-none" style={{ color: selFmt.textColor || '#000' }}>A</span>
                <div className="w-4 h-0.5 rounded-sm" style={{ background: selFmt.textColor || '#000' }} />
              </button>
              {picker === 'text' && <ColorPicker type="text" onApply={applyFmt} />}
            </div>

            {/* Background color */}
            <div className="relative shrink-0">
              <button
                onClick={e => { e.stopPropagation(); setPicker(v => v === 'bg' ? null : 'bg') }}
                title="Cell background color"
                className="w-7 h-7 rounded flex flex-col items-center justify-center gap-0.5 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <div
                  className="w-4 h-3 rounded-sm border border-slate-300"
                  style={{ background: selFmt.bgColor || 'transparent' }}
                />
                <div className="w-4 h-0.5 rounded-sm bg-slate-400" />
              </button>
              {picker === 'bg' && <ColorPicker type="bg" onApply={applyFmt} />}
            </div>

            <div className="w-px h-5 bg-slate-200 shrink-0" />
          </>
        )}

        <div className="flex-1" />

        <button
          onClick={exportXlsx}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          .xlsx
        </button>
      </div>

      {/* ── Grid ────────────────────────────────────────────── */}
      <div className="overflow-auto flex-1">
        <table
          className="border-collapse"
          style={{ tableLayout: 'fixed', width: totalW, minWidth: '100%' }}
        >
          <colgroup>
            <col style={{ width: NUM_COL_W }} />
            {Array.from({ length: numCols }, (_, i) => (
              <col key={i} style={{ width: colWidths[i] ?? DEFAULT_COL_W }} />
            ))}
          </colgroup>

          {/* Column headers */}
          <thead>
            <tr>
              <th
                className="sticky top-0 left-0 z-20 bg-slate-100 border border-slate-200 select-none"
                style={{ height: DEFAULT_ROW_H, minWidth: NUM_COL_W }}
              />
              {Array.from({ length: numCols }, (_, c) => (
                <th
                  key={c}
                  className="sticky top-0 z-10 bg-slate-100 border border-slate-200 text-center text-[10px] font-semibold text-slate-500 select-none relative group"
                  style={{ height: DEFAULT_ROW_H }}
                >
                  {colLabel(c)}
                  {/* Column resize handle */}
                  {editable && (
                    <div
                      onMouseDown={e => startColResize(e, c)}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 bg-transparent group-hover:bg-novax/30 transition-colors"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {cells.map((row, r) => {
              const rowH = rowHeights[r] ?? DEFAULT_ROW_H
              return (
                <tr key={r}>
                  {/* Row number */}
                  <td
                    className="sticky left-0 z-10 bg-slate-100 border border-slate-200 text-center text-[10px] font-medium text-slate-400 select-none relative group"
                    style={{ height: rowH, minWidth: NUM_COL_W }}
                  >
                    {r + 1}
                    {/* Row resize handle */}
                    {editable && (
                      <div
                        onMouseDown={e => startRowResize(e, r)}
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize z-20 bg-transparent group-hover:bg-novax/30 transition-colors"
                      />
                    )}
                  </td>

                  {row.map((cellVal, c) => {
                    const isSel = sel?.r === r && sel?.c === c
                    const fmt   = getCellFmt(r, c)
                    return (
                      <td
                        key={c}
                        onClick={() => select(r, c)}
                        className={cn(
                          'border border-slate-200 p-0 relative overflow-hidden',
                          isSel
                            ? 'outline outline-2 outline-offset-[-1px] outline-novax z-10'
                            : editable ? 'hover:bg-blue-50/30 cursor-cell' : '',
                        )}
                        style={{
                          height:     rowH,
                          background: fmt.bgColor || undefined,
                        }}
                      >
                        {isSel ? (
                          <input
                            ref={inputRef}
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onBlur={() => { commit(r, c, editVal); setSel(null) }}
                            onKeyDown={e => handleKeyDown(e, r, c)}
                            className="absolute inset-0 w-full h-full px-1.5 outline-none bg-white text-xs"
                            style={{
                              fontWeight: fmt.bold      ? 'bold'          : 'normal',
                              color:      fmt.textColor ? fmt.textColor   : '#1e293b',
                              border:     'none',
                              fontFamily: 'ui-monospace, monospace',
                            }}
                          />
                        ) : (
                          <span
                            className="absolute inset-0 flex items-center px-1.5 text-xs overflow-hidden"
                            style={{
                              fontWeight:  fmt.bold      ? 'bold'        : 'normal',
                              color:       fmt.textColor ? fmt.textColor : '#334155',
                              fontFamily:  'ui-monospace, monospace',
                              whiteSpace:  rowH > DEFAULT_ROW_H * 1.5 ? 'normal' : 'nowrap',
                              overflowWrap: rowH > DEFAULT_ROW_H * 1.5 ? 'break-word' : undefined,
                              alignItems:  rowH > DEFAULT_ROW_H * 1.5 ? 'flex-start' : 'center',
                              paddingTop:  rowH > DEFAULT_ROW_H * 1.5 ? '4px' : undefined,
                            }}
                          >
                            {cellVal}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Add rows / cols */}
        {editable && (
          <div className="flex items-center border-t border-slate-200 bg-white sticky left-0" style={{ width: totalW, minWidth: '100%' }}>
            <button
              onClick={addRows}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-novax transition-colors flex-1"
            >
              <Plus className="w-3 h-3" /> Add 10 rows
            </button>
            <div className="w-px h-5 bg-slate-100 shrink-0" />
            <button
              onClick={addCols}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-novax transition-colors flex-1"
            >
              <Plus className="w-3 h-3" /> Add 5 columns
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
