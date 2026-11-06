// 演示前清理：
//   1. 下架种子数据里仍用 SVG 占位图的商品（非真实货品，可在后台重新上架）
//   2. 站点名称改为「凡晟珠宝」
//   3. 打开前台「演示版」标识（系统参数 site.demo.label，留空即关闭）
//
// 用法（在 huangjin-web 目录下）：
//   npx tsx --env-file=.env.local scripts/demo-cleanup.ts          # 只预览
//   npx tsx --env-file=.env.local scripts/demo-cleanup.ts --apply  # 实际写入

import { loadDB, mutate, nextId } from '../lib/store'
import { addLog } from '../lib/api'
import type { DB } from '../lib/types'

const APPLY = process.argv.includes('--apply')
const SITE_NAME = '凡晟珠宝'
const DEMO_LABEL = '演示版'

const isPlaceholder = (cover?: string | null) => !cover || cover.endsWith('.svg')

function plan(db: DB) {
  const products = db.product.filter((p) => !p.deleted && p.status === 1 && isPlaceholder(p.cover))
  const cfg = (key: string) => db.sysConfig.find((c) => !c.deleted && c.configKey === key)
  return { products, siteName: cfg('site.name'), demoLabel: cfg('site.demo.label') }
}

async function main() {
  const preview = plan(await loadDB())
  console.log(`将下架 ${preview.products.length} 款占位图商品：`)
  preview.products.forEach((p) => console.log(`  #${p.id} ${p.styleNo} ${p.name}  (${p.cover})`))
  console.log(`站点名称：${preview.siteName?.configValue ?? '(无)'} → ${SITE_NAME}`)
  console.log(`演示版标识：${preview.demoLabel?.configValue ?? '(无)'} → ${DEMO_LABEL}`)

  if (!APPLY) {
    console.log('\n预览模式，未写入。加 --apply 实际执行。')
    return
  }

  const done = await mutate((db) => {
    const a = db.sysAdmin.find((x) => !x.deleted && x.roleCode === 'SUPER' && x.status === 1)
    if (!a) throw new Error('找不到可用的超级管理员')
    const ts = new Date().toISOString()
    const by = 'script:demo-cleanup'
    const { products, siteName, demoLabel } = plan(db)

    for (const p of products) {
      p.status = 0
      p.updatedAt = ts
      p.updatedBy = by
    }

    if (siteName) {
      siteName.configValue = SITE_NAME
      siteName.updatedAt = ts
      siteName.updatedBy = by
    }

    if (demoLabel) {
      demoLabel.configValue = DEMO_LABEL
      demoLabel.updatedAt = ts
      demoLabel.updatedBy = by
    } else {
      db.sysConfig.push({
        id: nextId(db, 'sysConfig'),
        createdAt: ts,
        updatedAt: ts,
        createdBy: by,
        updatedBy: by,
        deleted: false,
        configKey: 'site.demo.label',
        configValue: DEMO_LABEL,
        remark: '演示版标识文字（如「演示版」），留空不显示',
      })
    }

    addLog(db, { id: a.id, username: a.username, realName: a.realName, roleCode: a.roleCode, exp: 0 }, {
      module: '系统',
      action: '演示前清理：下架占位商品、改站点名称、开启演示版标识',
      requestUri: by,
      requestBody: { offSale: products.map((p) => p.id), siteName: SITE_NAME, demoLabel: DEMO_LABEL },
    })
    return products.length
  })
  console.log(`\n已写入：下架 ${done} 款，站点名称与演示版标识已更新。`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
