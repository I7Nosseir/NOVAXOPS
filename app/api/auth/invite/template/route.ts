import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET() {
  const wb = XLSX.utils.book_new()

  const data = [
    ['Name', 'Email', 'Role'],
    ['Ahmed Hassan', 'ahmed@example.com', 'copywriter'],
    ['Sara Ali', 'sara@example.com', 'designer'],
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Column widths
  ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 20 }]

  XLSX.utils.book_append_sheet(wb, ws, 'Invite List')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="invite-template.xlsx"',
    },
  })
}
