// GET/PUT /api/mall/manage/configs — 系统参数（仅老板）
import { addLog, handle, ok, readJson } from '@/lib/api'
import { listConfigs, saveConfigs, type ConfigItem } from '@/lib/config-service'
import { mallActor, requireMallUser } from '@/lib/mall-auth'
import { loadDB, mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const db = await loadDB()
    requireMallUser(db, ['OWNER'])
    return ok(listConfigs(db))
  })
}

export async function PUT(req: Request) {
  return handle(async () => {
    const body = await readJson<{ items?: ConfigItem[] }>(req)
    const items = Array.isArray(body.items) ? body.items : []

    const saved = await mutate((db) => {
      const actor = mallActor(requireMallUser(db, ['OWNER']))
      const count = saveConfigs(db, items, actor)
      addLog(db, actor, {
        module: '系统参数', action: '保存', requestUri: '/api/mall/manage/configs',
        requestBody: { keys: items.map((i) => i.configKey) },
      })
      return count
    })
    return ok(saved, `已保存 ${saved} 项参数`)
  })
}
