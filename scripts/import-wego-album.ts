// 微购相册商品增量导入：图片传腾讯云 COS，自动补演示工费
//
// 数据目录（由抓取 / 筛选流程生成）需包含：
//   import.json            新增商品：名称 / 克重 / 宽度 / 说明 / 目标分类 / 图片文件名 / 发布时间
//   existing_cats.json     可选：已有商品的重新归类
//   fimg/{序号}_{图序}.jpg   已压缩、已剔除带价格标记的拼图
//
// 用法（在 huangjin-web 目录下，.env.local 需有 Redis 和 TENCENT_COS_* 变量）：
//   npx tsx --env-file=.env.local scripts/import-wego-album.ts <数据目录> --first=260           # 试运行
//   npx tsx --env-file=.env.local scripts/import-wego-album.ts <数据目录> --first=260 --apply   # 写入
//   npx tsx --env-file=.env.local scripts/import-wego-album.ts --remove --first=260             # 删除款号 ≥ first 的商品
//
// --first 是本批第一个款号的数字（WG{first}），用线上最大款号 + 1。
// import.json 每项可带 ts（相册发布时间，毫秒），写入后作为商品创建时间，「上新」排序据此。
// 工费按 lib/demo-labor-fee.ts 生成演示占位值，前台不再显示「面议」；真实工费请在后台修改。

import fs from 'fs'
import path from 'path'
import { loadDB, mutate, nextId } from '../lib/store'
import { saveFile } from '../lib/files'
import { addLog } from '../lib/api'
import { createProduct } from '../lib/product-service'
import { demoLaborFee } from '../lib/demo-labor-fee'
import type { AdminSession, DB } from '../lib/types'

interface Item {
  n: number
  name: string
  weights: Array<[string, number]>
  width: string | null
  length: string | null
  note: string | null
  desc: string[]
  cat: [string, string]
  images: string[]
  /** 相册发布时间（毫秒时间戳），用作商品创建时间 */
  ts?: number
}

const firstArg = process.argv.find((a) => a.startsWith('--first='))
// 本批款号起点；必须显式给出，避免 --remove 误删历史批次
const FIRST_NO = firstArg ? Number(firstArg.slice(8)) : NaN
if (!Number.isInteger(FIRST_NO) || FIRST_NO < 1) {
  console.error('请用 --first=<数字> 指定本批第一个款号（线上最大 WG 款号 + 1）')
  process.exit(1)
}
const styleNoOf = (n: number) => `WG${String(n + FIRST_NO).padStart(3, '0')}`
const PLACEHOLDER_QTY = 10 // 相册没有库存数据，演示占位：每个规格 10 件
const NEW_PRIMARY: Array<{ name: string; icon: string; sort: number }> = [
  { name: '系列套装', icon: '/img/cat-necklace.svg', sort: 60 },
]

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const round3 = (x: number) => Math.round(x * 1000) / 1000
const live = (db: DB) => db.category.filter((c) => !c.deleted)

function ensureCategory(db: DB, primary: string, secondary: string): number {
  const ts = new Date().toISOString()
  let p = live(db).find((c) => c.parentId === 0 && c.name === primary)
  if (!p) {
    const def = NEW_PRIMARY.find((x) => x.name === primary)
    if (!def) throw new Error(`一级分类「${primary}」不存在且未定义`)
    p = {
      id: nextId(db, 'category'), createdAt: ts, updatedAt: ts, deleted: false,
      parentId: 0, name: def.name, icon: def.icon, sort: def.sort, status: 1,
    }
    db.category.push(p)
  }
  let c = live(db).find((x) => x.parentId === p!.id && x.name === secondary)
  if (!c) {
    const sibs = live(db).filter((x) => x.parentId === p!.id)
    c = {
      id: nextId(db, 'category'), createdAt: ts, updatedAt: ts, deleted: false,
      parentId: p.id, name: secondary, sort: Math.max(0, ...sibs.map((x) => x.sort)) + 10, status: 1,
    }
    db.category.push(c)
  }
  return c.id
}

function craftOf(name: string): string | null {
  if (/古法/.test(name)) return '古法点钻'
  if (/5D/.test(name)) return '5D无氢'
  if (/5G/.test(name)) return '5G黄金'
  if (/莫桑/.test(name)) return '莫桑镶嵌'
  if (/镶嵌|贝母|猫眼|碧玺|珐琅/.test(name)) return '镶嵌'
  return null
}

function skusOf(it: Item, no: string) {
  // 相同标签只取第一个；无标签统一叫「单件」
  const seen = new Set<string>()
  const ws = it.weights.filter(([l]) => (seen.has(l) ? false : (seen.add(l), true))).slice(0, 4)
  return ws.map(([label, g], i) => ({
    skuCode: `${no}-${String(i + 1).padStart(2, '0')}`,
    specName: `${label || '单件'} ${g}g`,
    refWeight: g,
    refQty: 1,
    warnWeight: round3(g * 2),
    status: 1,
    initialWeight: round3(g * PLACEHOLDER_QTY),
  }))
}

async function remove() {
  const n = await mutate((db) => {
    const a = db.sysAdmin.find((x) => !x.deleted && x.roleCode === 'SUPER' && x.status === 1)!
    const ts = new Date().toISOString()
    const targets = db.product.filter((p) => !p.deleted && /^WG\d{3}$/.test(p.styleNo) && Number(p.styleNo.slice(2)) >= FIRST_NO)
    for (const p of targets) {
      p.deleted = true; p.updatedAt = ts
      for (const s of db.productSku) if (s.productId === p.id) { s.deleted = true; s.updatedAt = ts }
    }
    addLog(db, { id: a.id, username: a.username, realName: a.realName, roleCode: a.roleCode, exp: 0 }, {
      module: '商品', action: '批量删除（撤销微购相册导入）', requestUri: 'script:import-wego-album', requestBody: { count: targets.length },
    })
    return targets.length
  })
  console.log(`已删除 ${n} 个商品（WG${FIRST_NO} 起）；分类请另行清理`)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--remove')) return remove()
  const dir = args.find((a) => !a.startsWith('--'))
  if (!dir) throw new Error('请指定数据目录')
  const apply = args.includes('--apply')

  const items: Item[] = JSON.parse(fs.readFileSync(path.join(dir, 'import.json'), 'utf8'))
  const existingFile = path.join(dir, 'existing_cats.json')
  const existing: Record<string, [string, string]> = fs.existsSync(existingFile) ? JSON.parse(fs.readFileSync(existingFile, 'utf8')) : {}

  const byCat = new Map<string, number>()
  for (const it of items) byCat.set(it.cat.join(' > '), (byCat.get(it.cat.join(' > ')) ?? 0) + 1)
  console.log(`新增 ${items.length} 款（${styleNoOf(0)}–${styleNoOf(items.length - 1)}），分布：`)
  ;[...byCat.entries()].sort().forEach(([k, v]) => console.log(`  ${k}：${v}`))
  const imgCount = items.reduce((s, it) => s + it.images.length, 0)
  const multi = items.filter((it) => skusOf(it, 'x').length > 1).length
  console.log(`图片 ${imgCount} 张；多规格商品 ${multi} 款`)
  if (!apply) { console.log('\n试运行结束，未写入。'); return }

  const db0 = await loadDB()
  const material = db0.goldMaterial.find((m) => !m.deleted && m.code === 'AU999')
  if (!material) throw new Error('找不到材质 AU999')
  const taken = new Set(db0.product.filter((p) => !p.deleted).map((p) => p.styleNo))

  // 1) 先上传图片（不持有数据库锁）
  const urls = new Map<number, string[]>()
  let done = 0
  for (const it of items) {
    if (taken.has(styleNoOf(it.n))) continue
    const list: string[] = []
    for (const f of it.images) {
      const buffer = fs.readFileSync(path.join(dir, 'fimg', f))
      const saved = await saveFile({ mime: 'image/jpeg', buffer, name: `${styleNoOf(it.n)}-${list.length + 1}.jpg` })
      list.push(saved.url)
    }
    urls.set(it.n, list)
    if (++done % 20 === 0) console.log(`  已上传 ${done} 款图片`)
  }
  console.log(`  图片上传完成：${done} 款`)

  // 2) 一次事务：分类 + 第一批改归类 + 新商品
  const res = await mutate((db) => {
    const a = db.sysAdmin.find((x) => !x.deleted && x.roleCode === 'SUPER' && x.status === 1)
    if (!a) throw new Error('找不到可用的超级管理员')
    const session: AdminSession = { id: a.id, username: a.username, realName: a.realName, roleCode: a.roleCode, exp: Date.now() + 3600_000 }
    const ts = new Date().toISOString()

    // 第一批：按新分类体系重新归类
    let moved = 0
    for (const [no, [pri, sec]] of Object.entries(existing)) {
      const p = db.product.find((x) => !x.deleted && x.styleNo === no)
      if (!p) continue
      const cid = ensureCategory(db, pri, sec)
      if (p.categoryId !== cid) { p.categoryId = cid; p.updatedAt = ts; p.updatedBy = 'import-wego-album'; moved++ }
    }

    // 第二批：新增商品
    let created = 0
    for (const it of items) {
      const no = styleNoOf(it.n)
      if (db.product.some((x) => !x.deleted && x.styleNo === no)) continue
      const list = urls.get(it.n) ?? []
      const categoryId = ensureCategory(db, it.cat[0], it.cat[1])

      const attrs: Array<{ name: string; value: string }> = [
        { name: '参考克重', value: it.weights.length > 1 ? it.weights.map(([l, g]) => `${l || '单件'} ${g}g`).join(' / ') : `${it.weights[0][1]}g` },
      ]
      if (it.width) attrs.push({ name: '宽度', value: it.width })
      if (it.length) attrs.push({ name: '长度', value: it.length })
      const craft = craftOf(it.name)
      if (craft) attrs.push({ name: '工艺', value: craft })
      if (it.note) attrs.push({ name: '款式说明', value: it.note })

      const detail =
        `<p>${esc(it.name)}</p>` +
        it.desc.map((d) => `<p>${esc(d)}</p>`).join('') +
        `<p><strong>参考克重：</strong>${esc(attrs[0].value)}${it.width ? `　<strong>宽度：</strong>${it.width}` : ''}</p>` +
        `<p><strong>批发说明：</strong>按克计价、按克发货，支持混批。具体价格请联系客服。</p>`

      const created1 = createProduct(
        db,
        {
          name: it.name.slice(0, 100),
          styleNo: no,
          categoryId,
          materialId: material.id,
          cover: list[0],
          images: list,
          sizeDesc: it.width ? `宽度 ${it.width}` : it.length ? `长度 ${it.length}` : undefined,
          attrs,
          detailHtml: detail,
          laborFeePerG: demoLaborFee({ category: it.cat[1], styleNo: no, name: it.name, weight: it.weights[0][1] }),
          isRecommend: false,
          status: 1,
          sort: it.n + FIRST_NO,
          skus: skusOf(it, no),
        },
        session,
      )
      if (it.ts) created1.createdAt = new Date(it.ts).toISOString()
      created++
    }
    addLog(db, session, {
      module: '商品', action: '批量导入（微购相册）', requestUri: 'script:import-wego-album', requestBody: { created, moved },
    })
    return { created, moved }
  })
  console.log(`\n导入完成：新增 ${res.created} 款（已补演示工费）；已有商品重新归类 ${res.moved} 款`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
