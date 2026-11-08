// 库存流水的查询过滤（分页接口与导出接口共用）
import { STOCK_LOG_TYPE_LABEL, type StockLog, type StockLogType } from './types'

export function filterLogs(logs: StockLog[], url: URL): StockLog[] {
  const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase()
  const type = url.searchParams.get('type') as StockLogType | null
  const skuId = Number(url.searchParams.get('skuId') ?? 0) || 0
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  let rows = [...logs]
  if (keyword) {
    rows = rows.filter(
      (l) =>
        l.productName.toLowerCase().includes(keyword) ||
        l.skuCode.toLowerCase().includes(keyword) ||
        (l.refNo ?? '').toLowerCase().includes(keyword) ||
        (l.reason ?? '').toLowerCase().includes(keyword),
    )
  }
  if (type) rows = rows.filter((l) => l.type === type)
  if (skuId) rows = rows.filter((l) => l.skuId === skuId)
  if (startDate) {
    const from = new Date(`${startDate}T00:00:00+08:00`).getTime()
    rows = rows.filter((l) => new Date(l.createdAt).getTime() >= from)
  }
  if (endDate) {
    const to = new Date(`${endDate}T23:59:59+08:00`).getTime()
    rows = rows.filter((l) => new Date(l.createdAt).getTime() <= to)
  }
  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

const HEADERS = [
  '时间', '商品名称', '款号/SKU编码', '规格', '类型',
  '变动克重(g)', '变动前(g)', '变动后(g)', '单据号', '原因', '操作人',
]

const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
/** 文本单元格：以公式触发字符开头时加单引号，防 CSV 注入 */
const textCell = (v: unknown) => {
  const s = String(v ?? '')
  return cell(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s)
}

/** 库存流水 CSV 文本，带 BOM 保证 Excel 正确识别 UTF-8 中文 */
export function stockLogsCsv(logs: StockLog[]): string {
  const lines = [HEADERS.map(cell).join(',')]
  for (const l of logs) {
    lines.push(
      [
        cell(new Date(l.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })),
        textCell(l.productName),
        textCell(l.skuCode),
        textCell(l.specName),
        cell(STOCK_LOG_TYPE_LABEL[l.type] ?? l.type),
        cell(l.changeWeight.toFixed(3)),
        cell(l.beforeWeight.toFixed(3)),
        cell(l.afterWeight.toFixed(3)),
        textCell(l.refNo ?? ''),
        textCell(l.reason ?? ''),
        textCell(l.operator),
      ].join(','),
    )
  }
  return `\uFEFF${lines.join('\r\n')}`
}

export function stockLogsFilename(): string {
  return `stock-logs-${new Date().toISOString().slice(0, 10)}.csv`
}
