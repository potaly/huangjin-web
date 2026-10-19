// GET /api/admin/stock-logs/export — 导出库存流水（CSV，Excel 可直接打开）
import { requireAdmin } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { STOCK_LOG_TYPE_LABEL } from '@/lib/types'
import { filterLogs } from '@/lib/stock-logs'

export const dynamic = 'force-dynamic'

const HEADERS = [
  '时间', '商品名称', '款号/SKU编码', '规格', '类型',
  '变动克重(g)', '变动前(g)', '变动后(g)', '单据号', '原因', '操作人',
]

const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

export async function GET(req: Request) {
  try {
    requireAdmin('stock')
  } catch {
    return new Response('未登录或无权限', { status: 401 })
  }

  const db = await loadDB()
  const rows = filterLogs(db.stockLog, new URL(req.url))

  const lines = [HEADERS.map(cell).join(',')]
  for (const l of rows) {
    lines.push(
      [
        new Date(l.createdAt).toLocaleString('zh-CN'),
        l.productName,
        l.skuCode,
        l.specName,
        STOCK_LOG_TYPE_LABEL[l.type] ?? l.type,
        l.changeWeight.toFixed(3),
        l.beforeWeight.toFixed(3),
        l.afterWeight.toFixed(3),
        l.refNo ?? '',
        l.reason ?? '',
        l.operator,
      ].map(cell).join(','),
    )
  }

  // BOM 保证 Excel 正确识别 UTF-8 中文
  const csv = `﻿${lines.join('\r\n')}`
  const filename = `stock-logs-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
