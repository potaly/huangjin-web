// 库存流水的查询过滤（分页接口与导出接口共用）
import type { StockLog, StockLogType } from './types'

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
    const from = new Date(`${startDate}T00:00:00`).getTime()
    rows = rows.filter((l) => new Date(l.createdAt).getTime() >= from)
  }
  if (endDate) {
    const to = new Date(`${endDate}T23:59:59`).getTime()
    rows = rows.filter((l) => new Date(l.createdAt).getTime() <= to)
  }
  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
