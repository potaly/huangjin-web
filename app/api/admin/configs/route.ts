// GET/PUT /api/admin/configs — 系统参数
import { addLog, bad, handle, ok, readJson, requireAdmin } from '@/lib/api'
import { loadDB, mutate, nextId } from '@/lib/store'
import type { Config } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    requireAdmin('system')
    const db = await loadDB()
    const records = db.sysConfig
      .filter((c) => !c.deleted)
      .sort((a, b) => a.configKey.localeCompare(b.configKey))
    return ok(records)
  })
}

export async function PUT(req: Request) {
  return handle(async () => {
    const session = requireAdmin('system')
    const body = await readJson<{ items?: Array<{ configKey?: string; configValue?: string }> }>(req)
    const items = Array.isArray(body.items) ? body.items : []
    if (items.length === 0) throw bad('没有需要保存的参数')

    const saved = await mutate((db) => {
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
          const config: Config = {
            id: nextId(db, 'sysConfig'),
            createdAt: ts,
            updatedAt: ts,
            createdBy: session.username,
            updatedBy: session.username,
            deleted: false,
            configKey: key,
            configValue: value,
          }
          db.sysConfig.push(config)
        }
        count += 1
      }
      addLog(db, session, {
        module: '系统参数', action: '保存', requestUri: '/api/admin/configs',
        requestBody: { keys: items.map((i) => i.configKey) },
      })
      return count
    })
    return ok(saved, `已保存 ${saved} 项参数`)
  })
}
