// GET/PUT /api/admin/configs — 系统参数
import { addLog, handle, ok, readJson, requireAdmin } from '@/lib/api'
import { listConfigs, saveConfigs, type ConfigItem } from '@/lib/config-service'
import { loadDB, mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    requireAdmin('system')
    const db = await loadDB()
    return ok(listConfigs(db))
  })
}

export async function PUT(req: Request) {
  return handle(async () => {
    const session = requireAdmin('system')
    const body = await readJson<{ items?: ConfigItem[] }>(req)
    const items = Array.isArray(body.items) ? body.items : []

    const saved = await mutate((db) => {
      const count = saveConfigs(db, items, session)
      addLog(db, session, {
        module: '系统参数', action: '保存', requestUri: '/api/admin/configs',
        requestBody: { keys: items.map((i) => i.configKey) },
      })
      return count
    })
    return ok(saved, `已保存 ${saved} 项参数`)
  })
}
