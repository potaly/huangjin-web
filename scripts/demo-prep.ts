// 发演示版给客户前的数据清理：
//   1. 清空占位客服电话、与微信号不符的客服二维码（前台自动隐藏这两块）
//   2. 清空脚本生成的占位工费（前台显示「面议」），原值先备份到 JSON
//   3. 下线种子数据里的示例公告（国庆发货、旧档口地址等）
//
// 用法（在 huangjin-web 目录下）：
//   npx tsx --env-file=.env.local scripts/demo-prep.ts                          # 只预览
//   npx tsx --env-file=.env.local scripts/demo-prep.ts --apply --backup=<文件>   # 实际写入
//
// 恢复工费：读备份 JSON（{ 商品id: 工费 }）写回 product.laborFeePerG 即可。

import fs from 'fs'
import { loadDB, mutate } from '../lib/store'
import { addLog } from '../lib/api'
import type { DB } from '../lib/types'

const APPLY = process.argv.includes('--apply')
const backupArg = process.argv.find((a) => a.startsWith('--backup='))
const BACKUP = backupArg ? backupArg.slice('--backup='.length) : ''

function plan(db: DB) {
  const cfg = (key: string) => db.sysConfig.find((c) => !c.deleted && c.configKey === key)
  return {
    phone: cfg('contact.phone'),
    qrcode: cfg('contact.wechat.qrcode'),
    feeProducts: db.product.filter((p) => !p.deleted && p.laborFeePerG != null),
    notices: db.notice.filter((n) => !n.deleted && n.status === 1 && n.createdBy === 'system'),
  }
}

async function main() {
  const p = plan(await loadDB())
  console.log(`客服电话：${p.phone?.configValue || '(空)'} → (清空)`)
  console.log(`客服二维码：${p.qrcode?.configValue || '(空)'} → (清空)`)
  console.log(`清空工费：${p.feeProducts.length} 款`)
  console.log(`下线示例公告：${p.notices.length} 条`)
  p.notices.forEach((n) => console.log(`  #${n.id} ${n.title}`))

  if (!APPLY) {
    console.log('\n预览模式，未写入。加 --apply --backup=<文件> 实际执行。')
    return
  }
  if (!BACKUP) throw new Error('实际执行必须指定 --backup=<文件>，用于保存原工费')

  const result = await mutate((db) => {
    const a = db.sysAdmin.find((x) => !x.deleted && x.roleCode === 'SUPER' && x.status === 1)
    if (!a) throw new Error('找不到可用的超级管理员')
    const ts = new Date().toISOString()
    const by = 'script:demo-prep'
    const { phone, qrcode, feeProducts, notices } = plan(db)

    // 先落盘备份，写失败则整个事务不执行
    const backup = Object.fromEntries(feeProducts.map((x) => [x.id, x.laborFeePerG]))
    fs.writeFileSync(BACKUP, JSON.stringify({ createdAt: ts, laborFeePerG: backup }, null, 2))

    for (const c of [phone, qrcode]) {
      if (!c) continue
      c.configValue = ''
      c.updatedAt = ts
      c.updatedBy = by
    }
    for (const x of feeProducts) {
      x.laborFeePerG = null
      x.updatedAt = ts
      x.updatedBy = by
    }
    for (const n of notices) {
      n.status = 2
      n.updatedAt = ts
      n.updatedBy = by
    }
    addLog(db, { id: a.id, username: a.username, realName: a.realName, roleCode: a.roleCode, exp: 0 }, {
      module: '系统',
      action: '演示前清理：清空占位电话/二维码与工费，下线示例公告',
      requestUri: by,
      requestBody: { fees: feeProducts.length, notices: notices.map((n) => n.id) },
    })
    return { fees: feeProducts.length, notices: notices.length }
  })
  console.log(`\n已写入：清空工费 ${result.fees} 款，下线公告 ${result.notices} 条，电话与二维码已清空。工费备份：${BACKUP}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
