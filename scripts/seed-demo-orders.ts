// 给演示客户造几笔订单（走正常下单逻辑扣库存）：待确认 2、已确认 1、已完成 1
// 用法（在 huangjin-web 目录下）：
//   npx tsx --env-file=.env.local scripts/seed-demo-orders.ts          # 试运行
//   npx tsx --env-file=.env.local scripts/seed-demo-orders.ts --yes    # 实际写入
//   npx tsx --env-file=.env.local scripts/seed-demo-orders.ts --cancel-demo --yes   # 取消演示订单并回库
// 已有 clientToken 以 demo- 开头的订单时不会重复创建
import { loadDB, mutate, storageDriver } from '../lib/store'
import { changeOrderStatus, placeOrder, sellableQty } from '../lib/order-service'
import type { DB } from '../lib/types'

const yes = process.argv.includes('--yes')
const cancelDemo = process.argv.includes('--cancel-demo')
console.log(`存储：${storageDriver()}`)
if (storageDriver() === 'memory') {
  console.error('当前为内存存储，写入不会持久化。')
  process.exit(1)
}

function plan(db: DB) {
  if (db.order.some((o) => o.clientToken.startsWith('demo-'))) return null
  const user = (p: string) => db.mallUser.find((u) => !u.deleted && u.phone === p && u.status === 1)
  const c = ['13800000021', '13800000022', '13800000023', '13800000024'].map(user)
  if (c.some((x) => !x || x.role !== 'CUSTOMER')) throw new Error('缺少演示客户，请先运行 seed-demo-users.ts --with-demo')
  const owner = db.mallUser.find((u) => !u.deleted && u.role === 'OWNER' && u.status === 1)
  // 订单的业务员缺失时退回老板账号
  const sales = (id: number | null | undefined) => {
    const u = db.mallUser.find((x) => x.id === id && !x.deleted) ?? owner
    if (!u) throw new Error('找不到订单对应的业务员，也没有老板账号可代为操作')
    return u
  }
  // 取 4 款库存充足、有单件克重的在架商品
  const skus = db.productSku
    .filter((s) => !s.deleted && s.status === 1 && sellableQty(s) >= 3)
    .filter((s) => db.product.some((p) => p.id === s.productId && !p.deleted && p.status === 1))
    .slice(0, 4)
  if (skus.length < 4) throw new Error('可下单的商品不足 4 款')
  return { c: c as NonNullable<(typeof c)[number]>[], skus, sales }
}

async function cancelDemoOrders() {
  const targets = (db: DB) => db.order.filter((o) => !o.deleted && o.clientToken.startsWith('demo-'))
  const db0 = await loadDB()
  const list = targets(db0)
  const open = list.filter((o) => o.status === 'PENDING' || o.status === 'CONFIRMED')
  console.log(`演示订单 ${list.length} 笔，其中可取消 ${open.length} 笔`)
  list.filter((o) => o.status === 'COMPLETED').forEach((o) => console.log(`${o.orderNo} 已完成，保持原状（不回库）`))
  if (!yes) {
    open.forEach((o) => console.log(`将取消 ${o.orderNo} ${o.customerName} ${o.status}`))
    console.log('试运行，未写入。加 --yes 执行。')
    return
  }
  const lines = await mutate((db) => {
    const owner = db.mallUser.find((u) => !u.deleted && u.role === 'OWNER' && u.status === 1)
    return targets(db)
      .filter((o) => o.status === 'PENDING' || o.status === 'CONFIRMED')
      .map((o) => {
        const actor = db.mallUser.find((u) => u.id === o.salesId && !u.deleted) ?? owner
        if (!actor) throw new Error(`订单 ${o.orderNo} 找不到业务员，也没有老板账号可代为取消`)
        changeOrderStatus(db, actor, o.id, 'cancel', '清理演示数据')
        return `${o.orderNo} 已取消并回库`
      })
  })
  lines.forEach((l) => console.log(l))
}

async function main() {
  if (cancelDemo) return cancelDemoOrders()
  const preview = plan(await loadDB())
  if (!preview) {
    console.log('已存在演示订单，跳过')
    return
  }
  console.log('将创建 4 笔演示订单（待确认 2、已确认 1、已完成 1）')
  {
    const db = await loadDB()
    preview.skus.forEach((k, i) => {
      const p = db.product.find((x) => x.id === k.productId)
      console.log(`款${i + 1}：${p?.name ?? '?'} / ${k.specName} / 可售 ${sellableQty(k)} 件`)
    })
    const { c, skus } = preview
    const who = (n: number, what: string) => `${c[n].name}(${c[n].phone})：${what}`
    console.log(who(0, `${label(skus[0])}×2 + ${label(skus[1])}×1，待确认，备注「周五前要货」`))
    console.log(who(2, `${label(skus[2])}×1，待确认`))
    console.log(who(1, `${label(skus[3])}×3，已确认`))
    console.log(who(3, `${label(skus[0])}×1，已完成`))
    function label(k: (typeof skus)[number]) {
      return `${db.product.find((x) => x.id === k.productId)?.name ?? '?'}/${k.specName}`
    }
  }
  if (!yes) {
    console.log('试运行，未写入。加 --yes 执行。')
    return
  }
  const nos = await mutate((db) => {
    const p = plan(db)
    if (!p) return []
    const { c, skus, sales } = p
    const o1 = placeOrder(db, c[0], { items: [{ skuId: skus[0].id, qty: 2 }, { skuId: skus[1].id, qty: 1 }], clientToken: 'demo-1', remark: '周五前要货' })
    const o2 = placeOrder(db, c[2], { items: [{ skuId: skus[2].id, qty: 1 }], clientToken: 'demo-2' })
    const o3 = placeOrder(db, c[1], { items: [{ skuId: skus[3].id, qty: 3 }], clientToken: 'demo-3' })
    const o4 = placeOrder(db, c[3], { items: [{ skuId: skus[0].id, qty: 1 }], clientToken: 'demo-4' })
    changeOrderStatus(db, sales(o3.salesId)!, o3.id, 'confirm')
    changeOrderStatus(db, sales(o4.salesId)!, o4.id, 'confirm')
    changeOrderStatus(db, sales(o4.salesId)!, o4.id, 'complete')
    return [o1, o2, o3, o4].map((o) => `${o.orderNo} ${o.customerName} ${o.status}`)
  })
  nos.forEach((l) => console.log(l))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
