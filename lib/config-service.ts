// 系统参数与操作日志：PC 后台与小程序管理端共用
import { bad, pageParams, paginate } from './api'
import { nextId } from './store'
import type { AdminSession, Config, DB } from './types'

export function listConfigs(db: DB): Config[] {
  return db.sysConfig
    .filter((c) => !c.deleted)
    .sort((a, b) => a.configKey.localeCompare(b.configKey))
}

export interface ConfigItem {
  configKey?: string
  configValue?: string
}

/** 保存参数（存在则更新，不存在则新增），返回实际保存的数量 */
export function saveConfigs(db: DB, items: ConfigItem[], session: AdminSession): number {
  if (!Array.isArray(items) || items.length === 0) throw bad('没有需要保存的参数')
  const ts = new Date().toISOString()
  let count = 0
  for (const item of items) {
    const key = String(item.configKey ?? '').trim()
    if (!key) continue
    const value = String(item.configValue ?? '').slice(0, 2000)

    if (key === 'stock.display.mode' && !['EXACT', 'LEVEL'].includes(value)) {
      throw bad('库存展示方式只能是 EXACT 或 LEVEL')
    }

    const existing = db.sysConfig.find((c) => !c.deleted && c.configKey === key)
    if (existing) {
      existing.configValue = value
      existing.updatedAt = ts
      existing.updatedBy = session.username
    } else {
      db.sysConfig.push({
        id: nextId(db, 'sysConfig'),
        createdAt: ts,
        updatedAt: ts,
        createdBy: session.username,
        updatedBy: session.username,
        deleted: false,
        configKey: key,
        configValue: value,
      })
    }
    count += 1
  }
  return count
}

export function queryOperationLogs(db: DB, url: URL) {
  const { pageNum, pageSize } = pageParams(url)
  const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase()
  const moduleName = (url.searchParams.get('module') ?? '').trim()

  let rows = [...db.sysOperationLog]
  if (keyword) {
    rows = rows.filter(
      (l) =>
        l.adminName.toLowerCase().includes(keyword) ||
        l.action.toLowerCase().includes(keyword) ||
        l.requestUri.toLowerCase().includes(keyword),
    )
  }
  if (moduleName) rows = rows.filter((l) => l.module === moduleName)

  return {
    ...paginate(rows, pageNum, pageSize),
    modules: Array.from(new Set(db.sysOperationLog.map((l) => l.module))),
  }
}
