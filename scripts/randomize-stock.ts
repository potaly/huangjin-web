// 把演示库存改成「每个规格 3–30 件」的随机值（同一规格编码每次结果相同），并把前台库存展示切到精确数量。
//
// ⚠️ 这是演示占位数据，不是真实库存。真实库存请在后台「库存管理」中入库/盘点。
// 库存仍以克为单位存储：stockWeight = 件数 × 参考单件克重；前台按 件数 = 可售克重 ÷ 单件克重 展示。
//
// 用法：npx tsx --env-file=.env.local scripts/randomize-stock.ts [--apply]
import { loadDB, mutate } from '../lib/store'
import { addLog } from '../lib/api'
import { roundWeight } from '../lib/num'
import type { Sku } from '../lib/types'

const MIN = 3, MAX = 30

function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15
  return ((h >>> 0) % 100000) / 100000
}

const qtyOf = (sku: Sku) => MIN + Math.floor(hash01(sku.skuCode + ':stock') * (MAX - MIN + 1))

async function main() {
  const apply = process.argv.includes('--apply')
  const db0 = await loadDB()
  const skus = db0.productSku.filter((s) => !s.deleted && typeof s.refWeight === 'number' && s.refWeight > 0)
  const qtys = skus.map(qtyOf)
  const hist: Record<string, number> = {}
  qtys.forEach((q) => { const k = `${Math.floor((q - 1) / 5) * 5 + 1}-${Math.floor((q - 1) / 5) * 5 + 5}`; hist[k] = (hist[k] ?? 0) + 1 })
  console.log(`将调整 ${skus.length} 个规格，件数范围 ${Math.min(...qtys)}–${Math.max(...qtys)}，分布`, hist)
  skus.slice(0, 6).forEach((s, i) => console.log(`  ${s.skuCode} 单件 ${s.refWeight}g → ${qtys[i]} 件 = ${roundWeight(qtys[i] * s.refWeight!)}g（原 ${s.stockWeight}g）`))
  const noRef = db0.productSku.filter((s) => !s.deleted && !(typeof s.refWeight === 'number' && s.refWeight > 0)).length
  console.log(`无参考克重、保持不变的规格：${noRef} 个；当前展示模式：${db0.sysConfig.find((c) => c.configKey === 'stock.display.mode')?.configValue}`)
  if (!apply) { console.log('\n试运行，未写入。'); return }

  await mutate((db) => {
    const a = db.sysAdmin.find((x) => !x.deleted && x.roleCode === 'SUPER' && x.status === 1)!
    const ts = new Date().toISOString()
    for (const s of db.productSku) {
      if (s.deleted || !(typeof s.refWeight === 'number' && s.refWeight > 0)) continue
      s.stockWeight = roundWeight(qtyOf(s) * s.refWeight)
      s.lockedWeight = 0
      s.refQty = qtyOf(s)
      s.updatedAt = ts
    }
    const cfg = db.sysConfig.find((c) => c.configKey === 'stock.display.mode')
    if (cfg) cfg.configValue = 'EXACT'
    addLog(db, { id: a.id, username: a.username, realName: a.realName, roleCode: a.roleCode, exp: 0 }, {
      module: '库存', action: '批量设置演示库存（3–30 件随机）并切换前台为精确数量', requestUri: 'script:randomize-stock', requestBody: { skus: skus.length },
    })
  })
  console.log('\n已写入。')
}
main().catch((e) => { console.error(e); process.exit(1) })
