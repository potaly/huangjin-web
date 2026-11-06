// 从 demo-prep.ts 生成的备份 JSON 恢复商品工费（只恢复当前为空的商品，不覆盖已手工维护的值）
//
// 用法（在 huangjin-web 目录下）：
//   npx tsx --env-file=.env.local scripts/restore-labor-fee.ts --from=<备份文件>

import fs from 'fs'
import { mutate } from '../lib/store'
import { addLog } from '../lib/api'

const fromArg = process.argv.find((a) => a.startsWith('--from='))
if (!fromArg) throw new Error('请用 --from=<备份文件> 指定工费备份')
const backup = JSON.parse(fs.readFileSync(fromArg.slice('--from='.length), 'utf8')) as {
  laborFeePerG: Record<string, number | null>
}

async function main() {
  const n = await mutate((db) => {
    const a = db.sysAdmin.find((x) => !x.deleted && x.roleCode === 'SUPER' && x.status === 1)
    if (!a) throw new Error('找不到可用的超级管理员')
    const ts = new Date().toISOString()
    const by = 'script:restore-labor-fee'
    let count = 0
    for (const p of db.product) {
      if (p.deleted || p.laborFeePerG != null) continue
      const fee = backup.laborFeePerG[String(p.id)]
      if (fee == null) continue
      p.laborFeePerG = fee
      p.updatedAt = ts
      p.updatedBy = by
      count += 1
    }
    addLog(db, { id: a.id, username: a.username, realName: a.realName, roleCode: a.roleCode, exp: 0 }, {
      module: '商品', action: '从备份恢复工费', requestUri: by, requestBody: { count },
    })
    return count
  })
  console.log(`已恢复 ${n} 款商品的工费`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
