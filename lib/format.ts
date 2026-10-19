// 前后端共用的展示格式化
import { STOCK_LEVEL_LABEL, type StockLevel } from './types'

/** 1250.36 → "1,250.360" */
export function fmtWeight(weight: number | null | undefined): string {
  if (weight === null || weight === undefined || !Number.isFinite(weight)) return '—'
  return weight.toLocaleString('zh-CN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}

/** 列表页用的紧凑克重：超过 1000 g 显示 1.25 kg */
export function fmtWeightShort(weight: number | null | undefined): string {
  if (weight === null || weight === undefined || !Number.isFinite(weight)) return '—'
  if (weight >= 1000) return `${(weight / 1000).toFixed(2)} kg`
  return `${weight.toFixed(weight % 1 === 0 ? 0 : 2)} g`
}

export function fmtLevel(level: StockLevel | undefined): string {
  return level ? STOCK_LEVEL_LABEL[level] : '—'
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${fmtDate(value)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** "3 分钟前" */
export function fmtAgo(value: string | null | undefined): string {
  if (!value) return '—'
  const diff = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diff)) return '—'
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  return fmtDate(value)
}

/** 参考单件克重区间：3.2–5.8 g/件 */
export function fmtRefWeightRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return ''
  if (min != null && max != null && Math.abs(min - max) > 0.0005) {
    return `${min}–${max} g/件`
  }
  return `约 ${min ?? max} g/件`
}
