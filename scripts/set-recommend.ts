// 把真实商品里每个二级分类挑几款标为「推荐」，让首页「推荐款式」→「查看全部」不只有几款
// 用法：npx tsx --env-file=.env.local scripts/set-recommend.ts [--per=2] [--apply]
import { loadDB, mutate } from '../lib/store'
import { addLog } from '../lib/api'
import type { DB, Product } from '../lib/types'

const PER = Number((process.argv.find((a) => a.startsWith('--per=')) ?? '--per=2').slice(6))

function pick(db: DB): Product[] {
  const byCat = new Map<number, Product[]>()
  for (const p of db.product) {
    if (p.deleted || p.status !== 1 || !/^WG\d+/.test(p.styleNo) || (p.images?.length ?? 0) < 3) continue
    ;(byCat.get(p.categoryId) ?? byCat.set(p.categoryId, []).get(p.categoryId)!).push(p)
  }
  const out: Product[] = []
  for (const list of byCat.values()) {
    // 优先最新发布、图片多的
    list.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.images.length - a.images.length)
    out.push(...list.slice(0, PER))
  }
  return out
}

async function main() {
  const apply = process.argv.includes('--apply')
  const db0 = await loadDB()
  const now = db0.product.filter((p) => !p.deleted && p.isRecommend).length
  const picks = pick(db0)
  const add = picks.filter((p) => !p.isRecommend)
  console.log(`当前推荐 ${now} 款；每个二级分类取 ${PER} 款 → 新增 ${add.length} 款，共 ${now + add.length} 款`)
  const cat = (id: number) => db0.category.find((c) => c.id === id)?.name
  add.forEach((p) => console.log(`  ${p.styleNo} ${p.name}（${cat(p.categoryId)}）`))
  if (!apply) { console.log('\n试运行，未写入。'); return }
  const ids = new Set(add.map((p) => p.id))
  await mutate((db) => {
    const a = db.sysAdmin.find((x) => !x.deleted && x.roleCode === 'SUPER' && x.status === 1)!
    const ts = new Date().toISOString()
    for (const p of db.product) if (ids.has(p.id)) { p.isRecommend = true; p.updatedAt = ts }
    addLog(db, { id: a.id, username: a.username, realName: a.realName, roleCode: a.roleCode, exp: 0 }, {
      module: '商品', action: '批量设置推荐款', requestUri: 'script:set-recommend', requestBody: { count: ids.size },
    })
  })
  console.log(`\n已把 ${ids.size} 款设为推荐`)
}
main().catch((e) => { console.error(e); process.exit(1) })
