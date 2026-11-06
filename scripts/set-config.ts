// 直接修改系统参数（与后台「系统参数」页保存效果相同，并写操作日志）
//
// 用法（在 huangjin-web 目录下）：
//   npx tsx --env-file=.env.local scripts/set-config.ts company.address=深圳市... contact.wechat=xxx
//   值留空表示清空，例如 contact.phone=

import { mutate, nextId } from '../lib/store'
import { addLog } from '../lib/api'

const pairs = process.argv.slice(2).map((arg) => {
  const i = arg.indexOf('=')
  if (i <= 0) throw new Error(`参数格式应为 key=value：${arg}`)
  return [arg.slice(0, i).trim(), arg.slice(i + 1).trim()] as const
})

async function main() {
  if (pairs.length === 0) throw new Error('没有要修改的参数')
  const changes = await mutate((db) => {
    const a = db.sysAdmin.find((x) => !x.deleted && x.roleCode === 'SUPER' && x.status === 1)
    if (!a) throw new Error('找不到可用的超级管理员')
    const ts = new Date().toISOString()
    const by = 'script:set-config'
    const out: string[] = []
    for (const [key, value] of pairs) {
      const c = db.sysConfig.find((x) => !x.deleted && x.configKey === key)
      if (c) {
        out.push(`${key}: ${c.configValue} → ${value}`)
        c.configValue = value
        c.updatedAt = ts
        c.updatedBy = by
      } else {
        out.push(`${key}: (新增) ${value}`)
        db.sysConfig.push({
          id: nextId(db, 'sysConfig'), createdAt: ts, updatedAt: ts, createdBy: by, updatedBy: by,
          deleted: false, configKey: key, configValue: value,
        })
      }
    }
    addLog(db, { id: a.id, username: a.username, realName: a.realName, roleCode: a.roleCode, exp: 0 }, {
      module: '系统参数', action: '保存', requestUri: by, requestBody: { keys: pairs.map(([k]) => k) },
    })
    return out
  })
  changes.forEach((s) => console.log(s))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
