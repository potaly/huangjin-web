# 下单闭环 · 第二、三批：选购清单、下单与订单管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 客户在小程序把商品加入选购清单并一次提交订单（服务端校验并扣库存）；客户查看/取消自己的订单；老板与业务员在小程序里确认、完成、取消订单，有新单红点。

**Architecture:** 新增 `order` 表与纯函数服务 `lib/order-service.ts`（下单、状态流转、可见范围、视图），全部在 `mutate()` 事务内执行，库存变化复用 `applyStockChange` 写流水（新类型 `ORDER_OUT` / `ORDER_BACK`）。选购清单只存在小程序本地。路由层只做鉴权与入参。

**Tech Stack:** Next.js 14 Route Handlers、TypeScript、`tsx --test`、原生微信小程序。

设计文档：`docs/superpowers/specs/2026-11-06-order-flow-design.md` 第 3、5、6、7、8 节。第一批（登录与用户）已上线：`lib/mall-auth.ts` 的 `requireMallUser(db, roles?)`、`lib/mall-user-service.ts` 的 `findUser`、小程序 `utils/request.js`（`get/post/put`、401 处理）、`utils/auth.js`（`getUser/getToken`）。

**冲突约束：** 主目录 `huangjin-web` 有另一处未提交改动（`lib/stock.ts`、`lib/mall.ts`、`lib/api-types.ts`、`components/mall/ProductCard.tsx`）。本计划**不得修改这四个文件**；可售件数等计算放在新文件里。

**约定：** 后端在 `huangjin-web-order/`（分支 `feat/order-flow-login`）执行；小程序在 `xiaojing-mp/`（非 git，只改文件）。提交只 add 明确路径，提交信息不加 Claude 署名。

**范围调整：** 设计里的「PC 后台只读订单列表」本批不做（演示用小程序管理端即可），记入后续。

---

## 文件结构

后端：

| 文件 | 职责 |
|---|---|
| `lib/types.ts`（改） | `OrderStatus`、`OrderItem`、`Order`、`DB.order`；流水类型 `ORDER_OUT` / `ORDER_BACK` |
| `lib/store.ts`、`lib/seed.ts`（改） | 迁移与种子补 `order` |
| `lib/order-service.ts`（新） | 可售件数、下单、状态流转、可见范围、视图、红点数 |
| `app/api/mall/orders/route.ts`、`[id]/route.ts`、`[id]/cancel/route.ts`（新） | 客户下单、我的订单、取消 |
| `app/api/mall/products/[id]/sku-stock/route.ts`（新） | 详情页加购用的各规格可售件数 |
| `app/api/mall/manage/orders/route.ts`、`[id]/route.ts`、`[id]/[action]/route.ts`、`app/api/mall/manage/badge/route.ts`（新） | 管理端订单 |
| `scripts/seed-demo-orders.ts`（新） | 演示订单 |
| `tests/helpers.ts`（改）、`tests/order-service.test.ts`（新） | 测试 |

小程序：`utils/cart.js`（新）、`pages/goods-detail/*`（改：加购弹层）、`pages/cart/*`（新，tab）、`pages/order-list/*`、`pages/order-detail/*`（新）、`pages/manage-orders/*`、`pages/manage-order-detail/*`（新）、`pages/mine/*`（改：入口与红点）、`tools/gen-tabbar-icons.js`（改：清单图标）、`app.json`（改）。

---

### Task 1: 数据模型

**Files:** Modify `lib/types.ts`、`lib/store.ts`、`lib/seed.ts`、`tests/helpers.ts`

- [ ] **Step 1: 流水类型**

`lib/types.ts` 的 `StockLogType` 联合类型末尾（`| 'REFUND_BACK'` 之后）加：

```ts
  | 'ORDER_OUT'
  | 'ORDER_BACK'
```

`STOCK_LOG_TYPE_LABEL` 中 `REFUND_BACK: '退款回库',` 之后加：

```ts
  ORDER_OUT: '下单扣减',
  ORDER_BACK: '取消回库',
```

- [ ] **Step 2: 订单类型**

在 `/** 整库文档 */` 注释之前插入：

```ts
/** 订单状态：待确认 / 已确认 / 已完成 / 已取消 */
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

/** 订单明细：下单时的商品快照 */
export interface OrderItem {
  productId: number
  skuId: number
  name: string
  styleNo: string
  specName: string
  cover: string
  /** 单件参考克重（g） */
  unitWeight: number
  /** 每克工费（元），未设置为 null */
  laborFeePerG: number | null
  qty: number
  /** qty × unitWeight，3 位小数 */
  weight: number
  /** weight × laborFeePerG，2 位小数；无工费为 null */
  laborFee: number | null
}

/** order 订单（无在线支付，提交后由业务员跟进） */
export interface Order extends BaseEntity {
  /** 例：FS20261106-0001 */
  orderNo: string
  customerId: number
  customerName: string
  customerPhone: string
  /** 下单时客户绑定的业务员 */
  salesId: number | null
  status: OrderStatus
  items: OrderItem[]
  totalQty: number
  totalWeight: number
  /** 所有明细都有工费时为合计，否则为 null */
  totalLaborFee: number | null
  remark?: string
  /** 客户端生成的提交编号，用于防重复提交 */
  clientToken: string
  confirmedAt?: string
  completedAt?: string
  cancelledAt?: string
  cancelledBy?: string
  cancelReason?: string
  /** 管理端是否已查看（用于新单红点） */
  seenBySales: boolean
}
```

`DB` 接口中 `mallUser: MallUser[]` 下一行加 `  order: Order[]`。

- [ ] **Step 3: 迁移与种子**

`lib/store.ts` 的 `migrate()` 中 `db.mallUser ??= []` 下一行加 `  db.order ??= []`。

`lib/seed.ts` 的 `buildSeedDB()` 返回对象中 `mallUser: [],` 下一行加 `    order: [],`。

- [ ] **Step 4: 测试辅助**

`tests/helpers.ts`：`emptyDB()` 返回对象中 `mallUser: [],` 下一行加 `    order: [],`；文件顶部 import 改为：

```ts
import type { DB, MallUser, Product, Sku } from '../lib/types'
```

文件末尾追加：

```ts
let pid = 7000

/** 塞一个上架商品和一个启用规格；stockQty 按件给出，库存克重 = stockQty × refWeight */
export function addProduct(
  db: DB,
  opts: { name?: string; refWeight?: number | null; stockQty?: number; laborFeePerG?: number | null; status?: 0 | 1 } = {},
): { product: Product; sku: Sku } {
  const ts = new Date().toISOString()
  const id = ++pid
  const refWeight = opts.refWeight === undefined ? 5 : opts.refWeight
  const product = {
    id,
    createdAt: ts,
    updatedAt: ts,
    name: opts.name ?? `商品${id}`,
    styleNo: `WG${id}`,
    categoryId: 1,
    materialId: 1,
    cover: `/img/${id}.jpg`,
    images: [],
    attrs: [],
    isRecommend: false,
    status: opts.status ?? 1,
    sort: 0,
    laborFeePerG: opts.laborFeePerG === undefined ? 20 : opts.laborFeePerG,
  } as Product
  const sku = {
    id: id * 10,
    createdAt: ts,
    updatedAt: ts,
    productId: id,
    skuCode: `WG${id}-01`,
    specName: '单件',
    refWeight,
    refQty: null,
    stockWeight: (opts.stockQty ?? 10) * (refWeight ?? 0),
    lockedWeight: 0,
    warnWeight: 0,
    status: 1,
    version: 0,
  } as Sku
  db.product.push(product)
  db.productSku.push(sku)
  return { product, sku }
}
```

- [ ] **Step 5: 检查**

Run: `npm run typecheck && npm test`
Expected: 通过（28 个测试）。若 typecheck 报其他地方缺 `order`（完整 DB 字面量），补 `order: []`。

- [ ] **Step 6: 提交**

```bash
git add lib/types.ts lib/store.ts lib/seed.ts tests/helpers.ts
git commit -m "feat: 新增订单表 order 与下单扣减、取消回库流水类型"
```

---

### Task 2: 订单服务 `lib/order-service.ts`

**Files:** Create `lib/order-service.ts`、Test `tests/order-service.test.ts`

- [ ] **Step 1: 写失败的测试**

`tests/order-service.test.ts`：

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addProduct, addUser, emptyDB } from './helpers'
import {
  changeOrderStatus, managerBadge, placeOrder, sellableQty, visibleOrders,
} from '../lib/order-service'

function setup() {
  const db = emptyDB()
  const owner = addUser(db, { phone: '13800000000', role: 'OWNER', name: '老板' })
  const s1 = addUser(db, { phone: '13800000011', role: 'SALES', name: '小王' })
  const s2 = addUser(db, { phone: '13800000012', role: 'SALES', name: '小李' })
  const c1 = addUser(db, { phone: '13800000021', role: 'CUSTOMER', name: '金福', salesId: s1.id })
  const c2 = addUser(db, { phone: '13800000022', role: 'CUSTOMER', name: '周记', salesId: s2.id })
  const a = addProduct(db, { name: '项链A', refWeight: 9.7, stockQty: 10, laborFeePerG: 22 })
  const b = addProduct(db, { name: '戒指B', refWeight: 4.9, stockQty: 2, laborFeePerG: null })
  return { db, owner, s1, s2, c1, c2, a, b }
}

test('sellableQty 按单件克重向下取整，无克重为 0', () => {
  const { a } = setup()
  assert.equal(sellableQty(a.sku), 10)
  assert.equal(sellableQty({ ...a.sku, refWeight: null }), 0)
})

test('下单成功：扣库存、写流水、快照与合计正确', () => {
  const { db, c1, s1, a, b } = setup()
  const o = placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 3 }, { skuId: b.sku.id, qty: 1 }], clientToken: 't1', remark: '急' })
  assert.match(o.orderNo, /^FS\d{8}-0001$/)
  assert.equal(o.status, 'PENDING')
  assert.equal(o.salesId, s1.id)
  assert.equal(o.totalQty, 4)
  assert.equal(o.totalWeight, 34)
  assert.equal(o.items[0].laborFee, 640.2)
  assert.equal(o.totalLaborFee, null)
  assert.equal(sellableQty(a.sku), 7)
  assert.equal(sellableQty(b.sku), 1)
  assert.equal(db.stockLog.filter((l) => l.type === 'ORDER_OUT' && l.refNo === o.orderNo).length, 2)
})

test('同一规格多行合并', () => {
  const { db, c1, a } = setup()
  const o = placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 1 }, { skuId: a.sku.id, qty: 2 }], clientToken: 't' })
  assert.equal(o.items.length, 1)
  assert.equal(o.items[0].qty, 3)
})

test('任一款库存不足整单失败，不扣任何库存', () => {
  const { db, c1, a, b } = setup()
  assert.throws(
    () => placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 1 }, { skuId: b.sku.id, qty: 3 }], clientToken: 't' }),
    /戒指B.*库存不足，剩余 2 件/,
  )
  assert.equal(sellableQty(a.sku), 10)
  assert.equal(db.order.length, 0)
  assert.equal(db.stockLog.length, 0)
})

test('下架商品、非客户、非法件数被拒绝', () => {
  const { db, c1, s1, a } = setup()
  a.product.status = 0
  assert.throws(() => placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 1 }], clientToken: 't' }), /已下架/)
  a.product.status = 1
  assert.throws(() => placeOrder(db, s1, { items: [{ skuId: a.sku.id, qty: 1 }], clientToken: 't' }), /客户/)
  assert.throws(() => placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 0 }], clientToken: 't' }), /件数/)
  assert.throws(() => placeOrder(db, c1, { items: [], clientToken: 't' }), /选购清单为空/)
  assert.throws(() => placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 1 }], clientToken: '' }), /提交编号/)
})

test('同一 clientToken 重复提交只生成一单、只扣一次', () => {
  const { db, c1, a } = setup()
  const o1 = placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 2 }], clientToken: 'same' })
  const o2 = placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 2 }], clientToken: 'same' })
  assert.equal(o1.id, o2.id)
  assert.equal(db.order.length, 1)
  assert.equal(sellableQty(a.sku), 8)
})

test('订单号按天递增', () => {
  const { db, c1, a } = setup()
  placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 1 }], clientToken: 'x1' })
  const o2 = placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 1 }], clientToken: 'x2' })
  assert.match(o2.orderNo, /-0002$/)
})

test('取消恢复库存，二次取消被拒绝且库存不变', () => {
  const { db, c1, a } = setup()
  const o = placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 4 }], clientToken: 't' })
  changeOrderStatus(db, c1, o.id, 'cancel')
  assert.equal(o.status, 'CANCELLED')
  assert.equal(sellableQty(a.sku), 10)
  assert.equal(db.stockLog.filter((l) => l.type === 'ORDER_BACK').length, 1)
  assert.throws(() => changeOrderStatus(db, c1, o.id, 'cancel'), /不能取消/)
  assert.equal(sellableQty(a.sku), 10)
})

test('客户只能取消待确认的本人订单；业务员取消须填原因', () => {
  const { db, c1, c2, s1, a } = setup()
  const o = placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 1 }], clientToken: 't' })
  assert.throws(() => changeOrderStatus(db, c2, o.id, 'cancel'), /订单不存在/)
  changeOrderStatus(db, s1, o.id, 'confirm')
  assert.equal(o.status, 'CONFIRMED')
  assert.throws(() => changeOrderStatus(db, c1, o.id, 'cancel'), /不能取消/)
  assert.throws(() => changeOrderStatus(db, s1, o.id, 'cancel'), /原因/)
  changeOrderStatus(db, s1, o.id, 'cancel', '客户改款')
  assert.equal(o.cancelReason, '客户改款')
  assert.equal(o.cancelledBy, '小王')
})

test('状态只能按顺序推进；客户不能确认', () => {
  const { db, c1, s1, a } = setup()
  const o = placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 1 }], clientToken: 't' })
  assert.throws(() => changeOrderStatus(db, s1, o.id, 'complete'), /待确认/)
  assert.throws(() => changeOrderStatus(db, c1, o.id, 'confirm'), /权限/)
  changeOrderStatus(db, s1, o.id, 'confirm')
  changeOrderStatus(db, s1, o.id, 'complete')
  assert.equal(o.status, 'COMPLETED')
  assert.ok(o.completedAt)
  assert.throws(() => changeOrderStatus(db, s1, o.id, 'cancel', 'x'), /不能取消/)
})

test('可见范围：客户看自己，业务员看自己客户，老板看全部；业务员动不了别人的单', () => {
  const { db, owner, s1, s2, c1, c2, a } = setup()
  const o1 = placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 1 }], clientToken: 'a' })
  placeOrder(db, c2, { items: [{ skuId: a.sku.id, qty: 1 }], clientToken: 'b' })
  assert.equal(visibleOrders(db, c1).length, 1)
  assert.equal(visibleOrders(db, s1).length, 1)
  assert.equal(visibleOrders(db, s2).length, 1)
  assert.equal(visibleOrders(db, owner).length, 2)
  assert.equal(visibleOrders(db, owner, 'PENDING').length, 2)
  assert.throws(() => changeOrderStatus(db, s2, o1.id, 'confirm'), /订单不存在/)
})

test('红点：可见范围内待确认且未查看的单数', () => {
  const { db, owner, s1, c1, a } = setup()
  const o = placeOrder(db, c1, { items: [{ skuId: a.sku.id, qty: 1 }], clientToken: 'a' })
  assert.equal(managerBadge(db, s1), 1)
  assert.equal(managerBadge(db, owner), 1)
  o.seenBySales = true
  assert.equal(managerBadge(db, s1), 0)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx tsx --test tests/order-service.test.ts`
Expected: FAIL，`Cannot find module '../lib/order-service'`

- [ ] **Step 3: 实现**

`lib/order-service.ts`：

```ts
// 订单业务规则：纯函数，调用方负责放进 mutate() 事务
// 库存以克存储；可售件数 = floor((stockWeight − lockedWeight) / refWeight)
import { bad, forbidden, notFound } from './api'
import { nextId } from './store'
import { applyStockChange } from './stock'
import { addWeight, roundAmount, roundWeight } from './num'
import {
  ORDER_STATUS_LABEL, type DB, type MallUser, type Order, type OrderItem, type OrderStatus, type Sku,
} from './types'

export const MAX_QTY_PER_ITEM = 999

/** 可售件数；没有单件参考克重时无法按件售卖，返回 0 */
export function sellableQty(sku: Sku): number {
  const w = sku.refWeight
  if (typeof w !== 'number' || !(w > 0)) return 0
  const available = addWeight(sku.stockWeight, -sku.lockedWeight)
  return Math.max(0, Math.floor(available / w + 1e-6))
}

export interface PlaceOrderInput {
  items: Array<{ skuId: unknown; qty: unknown }>
  remark?: unknown
  clientToken?: unknown
}

function todayKey(d = new Date()): string {
  // 以北京时间划分日期
  const t = new Date(d.getTime() + 8 * 3600 * 1000)
  return t.toISOString().slice(0, 10).replace(/-/g, '')
}

function nextOrderNo(db: DB): string {
  const prefix = `FS${todayKey()}-`
  const n = db.order.filter((o) => o.orderNo.startsWith(prefix)).length + 1
  return `${prefix}${String(n).padStart(4, '0')}`
}

export function placeOrder(db: DB, customer: MallUser, input: PlaceOrderInput): Order {
  if (customer.role !== 'CUSTOMER') throw forbidden('只有客户账号可以下单')
  const clientToken = String(input.clientToken ?? '').trim()
  if (!clientToken) throw bad('缺少提交编号，请刷新后重试')

  const existed = db.order.find((o) => o.customerId === customer.id && o.clientToken === clientToken)
  if (existed) return existed

  // 合并同一规格
  const merged = new Map<number, number>()
  for (const raw of input.items ?? []) {
    const skuId = Number(raw.skuId)
    const qty = Number(raw.qty)
    if (!Number.isInteger(skuId) || skuId <= 0) throw bad('规格不合法')
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) throw bad(`件数须为 1–${MAX_QTY_PER_ITEM} 的整数`)
    merged.set(skuId, (merged.get(skuId) ?? 0) + qty)
  }
  if (merged.size === 0) throw bad('选购清单为空')

  // 先全部校验，任何一项不通过都不改库
  const lines: Array<{ sku: Sku; item: OrderItem }> = []
  for (const [skuId, qty] of merged) {
    const sku = db.productSku.find((s) => s.id === skuId && !s.deleted)
    const product = sku && db.product.find((p) => p.id === sku.productId && !p.deleted)
    if (!sku || !product) throw bad('商品不存在，请刷新选购清单')
    if (product.status !== 1) throw bad(`${product.name} 已下架`)
    if (sku.status !== 1) throw bad(`${product.name} ${sku.specName} 已停售`)
    const unitWeight = sku.refWeight
    if (typeof unitWeight !== 'number' || !(unitWeight > 0)) throw bad(`${product.name} ${sku.specName} 暂不支持按件下单`)
    const left = sellableQty(sku)
    if (left < qty) throw bad(`${product.name} ${sku.specName} 库存不足，剩余 ${left} 件`)
    const weight = roundWeight(unitWeight * qty)
    const fee = product.laborFeePerG ?? null
    lines.push({
      sku,
      item: {
        productId: product.id,
        skuId: sku.id,
        name: product.name,
        styleNo: product.styleNo,
        specName: sku.specName,
        cover: product.cover ?? product.images?.[0] ?? '',
        unitWeight,
        laborFeePerG: fee,
        qty,
        weight,
        laborFee: fee === null ? null : roundAmount(weight * fee),
      },
    })
  }

  const orderNo = nextOrderNo(db)
  for (const { sku, item } of lines) {
    applyStockChange(db, {
      skuId: sku.id,
      type: 'ORDER_OUT',
      changeWeight: -item.weight,
      reason: `客户下单 ${customer.name}`,
      refNo: orderNo,
      operator: customer.name,
    })
  }

  const items = lines.map((l) => l.item)
  const ts = new Date().toISOString()
  const remark = String(input.remark ?? '').trim().slice(0, 200)
  const order: Order = {
    id: nextId(db, 'order'),
    createdAt: ts,
    updatedAt: ts,
    createdBy: customer.name,
    orderNo,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    salesId: customer.salesId ?? null,
    status: 'PENDING',
    items,
    totalQty: items.reduce((s, i) => s + i.qty, 0),
    totalWeight: roundWeight(items.reduce((s, i) => s + i.weight, 0)),
    totalLaborFee: items.every((i) => i.laborFee !== null)
      ? roundAmount(items.reduce((s, i) => s + (i.laborFee ?? 0), 0))
      : null,
    ...(remark ? { remark } : {}),
    clientToken,
    seenBySales: false,
  }
  db.order.unshift(order)
  return order
}

/** 可见范围：客户看自己，业务员看自己客户的单，老板看全部 */
export function visibleOrders(db: DB, actor: MallUser, status?: OrderStatus): Order[] {
  let list = db.order.filter((o) => !o.deleted)
  if (actor.role === 'CUSTOMER') list = list.filter((o) => o.customerId === actor.id)
  else if (actor.role === 'SALES') list = list.filter((o) => o.salesId === actor.id)
  if (status) list = list.filter((o) => o.status === status)
  return list
}

export function findVisibleOrder(db: DB, actor: MallUser, id: number): Order {
  const o = visibleOrders(db, actor).find((x) => x.id === id)
  if (!o) throw notFound('订单不存在')
  return o
}

export type OrderAction = 'confirm' | 'complete' | 'cancel'

export function changeOrderStatus(db: DB, actor: MallUser, id: number, action: OrderAction, reason?: string): Order {
  const o = findVisibleOrder(db, actor, id)
  const isManager = actor.role === 'OWNER' || actor.role === 'SALES'
  const ts = new Date().toISOString()

  if (action === 'confirm' || action === 'complete') {
    if (!isManager) throw forbidden('没有该操作权限')
    const from: OrderStatus = action === 'confirm' ? 'PENDING' : 'CONFIRMED'
    if (o.status !== from) throw bad(`只有「${ORDER_STATUS_LABEL[from]}」的订单才能${action === 'confirm' ? '确认' : '完成'}，当前为「${ORDER_STATUS_LABEL[o.status]}」`)
    o.status = action === 'confirm' ? 'CONFIRMED' : 'COMPLETED'
    if (action === 'confirm') o.confirmedAt = ts
    else o.completedAt = ts
  } else if (action === 'cancel') {
    const allowed: OrderStatus[] = isManager ? ['PENDING', 'CONFIRMED'] : ['PENDING']
    if (!allowed.includes(o.status)) throw bad(`「${ORDER_STATUS_LABEL[o.status]}」的订单不能取消`)
    const why = String(reason ?? '').trim().slice(0, 200)
    if (isManager && !why) throw bad('请填写取消原因')
    for (const item of o.items) {
      applyStockChange(db, {
        skuId: item.skuId,
        type: 'ORDER_BACK',
        changeWeight: item.weight,
        reason: `取消订单 ${why || '客户取消'}`,
        refNo: o.orderNo,
        operator: actor.name,
      })
    }
    o.status = 'CANCELLED'
    o.cancelledAt = ts
    o.cancelledBy = actor.name
    o.cancelReason = why || '客户取消'
  } else {
    throw bad('不支持的操作')
  }
  o.seenBySales = true
  o.updatedAt = ts
  o.updatedBy = actor.name
  return o
}

/** 管理端红点：可见范围内待确认且未查看的单数 */
export function managerBadge(db: DB, actor: MallUser): number {
  if (actor.role !== 'OWNER' && actor.role !== 'SALES') return 0
  return visibleOrders(db, actor, 'PENDING').filter((o) => !o.seenBySales).length
}

export function orderView(o: Order) {
  return {
    id: o.id,
    orderNo: o.orderNo,
    status: o.status,
    statusLabel: ORDER_STATUS_LABEL[o.status],
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    items: o.items,
    totalQty: o.totalQty,
    totalWeight: o.totalWeight,
    totalLaborFee: o.totalLaborFee,
    remark: o.remark ?? '',
    createdAt: o.createdAt,
    confirmedAt: o.confirmedAt ?? '',
    completedAt: o.completedAt ?? '',
    cancelledAt: o.cancelledAt ?? '',
    cancelledBy: o.cancelledBy ?? '',
    cancelReason: o.cancelReason ?? '',
    seenBySales: o.seenBySales,
  }
}

export type OrderView = ReturnType<typeof orderView>
```

注意：`applyStockChange` 在库存变为负数时抛错；本函数已在扣减前校验件数，正常不会触发。

- [ ] **Step 4: 运行测试**

Run: `npx tsx --test tests/order-service.test.ts && npm test && npm run typecheck`
Expected: 新增 12 个用例 PASS，全部测试通过，typecheck 干净。如 `totalWeight` 等浮点断言因精度失败，检查是否都经过 `roundWeight`/`roundAmount`。

- [ ] **Step 5: 提交**

```bash
git add lib/order-service.ts tests/order-service.test.ts
git commit -m "feat: 订单服务（整单校验扣库存、防重复提交、状态流转与取消回库、可见范围）"
```

---

### Task 3: 客户端订单接口与规格可售件数

**Files:**
- Create `app/api/mall/orders/route.ts`、`app/api/mall/orders/[id]/route.ts`、`app/api/mall/orders/[id]/cancel/route.ts`
- Create `app/api/mall/products/[id]/sku-stock/route.ts`

- [ ] **Step 1: 下单与我的订单**

`app/api/mall/orders/route.ts`：

```ts
// POST /api/mall/orders { items:[{skuId,qty}], remark, clientToken } — 客户下单
// GET  /api/mall/orders?status=                                      — 我的订单
import { handle, ok, readJson } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { orderView, placeOrder, visibleOrders, type PlaceOrderInput } from '@/lib/order-service'
import type { OrderStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'
const STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']

export async function GET(req: Request) {
  return handle(async () => {
    const db = await loadDB()
    const user = requireMallUser(db, ['CUSTOMER'])
    const s = new URL(req.url).searchParams.get('status') as OrderStatus | null
    return ok(visibleOrders(db, user, s && STATUSES.includes(s) ? s : undefined).map(orderView))
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const input = await readJson<PlaceOrderInput>(req)
    const view = await mutate((db) => {
      const user = requireMallUser(db, ['CUSTOMER'])
      return orderView(placeOrder(db, user, input))
    })
    return ok(view, '订单已提交')
  })
}
```

- [ ] **Step 2: 订单详情与取消**

`app/api/mall/orders/[id]/route.ts`：

```ts
// GET /api/mall/orders/{id} — 客户查看自己的订单
import { handle, ok, requireId } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { findVisibleOrder, orderView } from '@/lib/order-service'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const db = await loadDB()
    const user = requireMallUser(db, ['CUSTOMER'])
    return ok(orderView(findVisibleOrder(db, user, id)))
  })
}
```

`app/api/mall/orders/[id]/cancel/route.ts`：

```ts
// POST /api/mall/orders/{id}/cancel — 客户取消待确认的本人订单
import { handle, ok, requireId } from '@/lib/api'
import { mutate } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { changeOrderStatus, orderView } from '@/lib/order-service'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const view = await mutate((db) => {
      const user = requireMallUser(db, ['CUSTOMER'])
      return orderView(changeOrderStatus(db, user, id, 'cancel'))
    })
    return ok(view, '订单已取消')
  })
}
```

- [ ] **Step 3: 各规格可售件数**

`app/api/mall/products/[id]/sku-stock/route.ts`：

```ts
// GET /api/mall/products/{id}/sku-stock — 加购弹层用：各启用规格的可售件数（与库存展示方式无关）
import { handle, notFound, ok, requireId } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { requireMallAccess } from '@/lib/mall-auth'
import { sellableQty } from '@/lib/order-service'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const db = await loadDB()
    requireMallAccess(db)
    const product = db.product.find((p) => p.id === id && !p.deleted && p.status === 1)
    if (!product) throw notFound('商品不存在或已下架')
    const skus = db.productSku
      .filter((s) => !s.deleted && s.productId === id && s.status === 1)
      .map((s) => ({ skuId: s.id, specName: s.specName, unitWeight: s.refWeight ?? null, availableQty: sellableQty(s) }))
    return ok({ productId: id, laborFeePerG: product.laborFeePerG ?? null, skus })
  })
}
```

- [ ] **Step 4: 检查并提交**

Run: `npm run typecheck && npm test`

```bash
git add app/api/mall/orders "app/api/mall/products/[id]/sku-stock"
git commit -m "feat: 客户下单、我的订单、取消订单接口与规格可售件数接口"
```

---

### Task 4: 管理端订单接口

**Files:** Create `app/api/mall/manage/orders/route.ts`、`app/api/mall/manage/orders/[id]/route.ts`、`app/api/mall/manage/orders/[id]/[action]/route.ts`、`app/api/mall/manage/badge/route.ts`

- [ ] **Step 1: 列表**

`app/api/mall/manage/orders/route.ts`：

```ts
// GET /api/mall/manage/orders?status= — 老板看全部，业务员看自己客户的单
import { handle, ok } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { orderView, visibleOrders } from '@/lib/order-service'
import type { OrderStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'
const STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']

export async function GET(req: Request) {
  return handle(async () => {
    const db = await loadDB()
    const actor = requireMallUser(db, ['OWNER', 'SALES'])
    const s = new URL(req.url).searchParams.get('status') as OrderStatus | null
    return ok(visibleOrders(db, actor, s && STATUSES.includes(s) ? s : undefined).map(orderView))
  })
}
```

- [ ] **Step 2: 详情（顺带标记已查看）**

`app/api/mall/manage/orders/[id]/route.ts`：

```ts
// GET /api/mall/manage/orders/{id} — 查看即标记已读，消除红点
import { handle, ok, requireId } from '@/lib/api'
import { mutate } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { findVisibleOrder, orderView } from '@/lib/order-service'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const view = await mutate((db) => {
      const actor = requireMallUser(db, ['OWNER', 'SALES'])
      const o = findVisibleOrder(db, actor, id)
      o.seenBySales = true
      return orderView(o)
    })
    return ok(view)
  })
}
```

- [ ] **Step 3: 确认 / 完成 / 取消**

`app/api/mall/manage/orders/[id]/[action]/route.ts`：

```ts
// POST /api/mall/manage/orders/{id}/{confirm|complete|cancel} { reason? }
import { bad, handle, ok, readJson, requireId } from '@/lib/api'
import { mutate } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { changeOrderStatus, orderView, type OrderAction } from '@/lib/order-service'

export const dynamic = 'force-dynamic'
const ACTIONS: OrderAction[] = ['confirm', 'complete', 'cancel']
const DONE: Record<OrderAction, string> = { confirm: '已确认', complete: '已完成', cancel: '已取消' }

export async function POST(req: Request, { params }: { params: { id: string; action: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const action = params.action as OrderAction
    if (!ACTIONS.includes(action)) throw bad('不支持的操作')
    const body = action === 'cancel' ? await readJson<{ reason?: string }>(req) : {}
    const view = await mutate((db) => {
      const actor = requireMallUser(db, ['OWNER', 'SALES'])
      return orderView(changeOrderStatus(db, actor, id, action, body.reason))
    })
    return ok(view, DONE[action])
  })
}
```

- [ ] **Step 4: 红点**

`app/api/mall/manage/badge/route.ts`：

```ts
// GET /api/mall/manage/badge — { pendingUnseen }，非管理角色返回 0
import { handle, ok } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { managerBadge } from '@/lib/order-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const db = await loadDB()
    const actor = requireMallUser(db)
    return ok({ pendingUnseen: managerBadge(db, actor) })
  })
}
```

- [ ] **Step 5: 本地冒烟（内存存储；worktree 没有 `.env.local`，先 `ls .env.local` 确认不存在）**

启动 `npx next dev -p 3312`，用下面的 Node 脚本在**同一进程的内存库**里走一遍（内存模式下种子数据含商品与 SKU，但没有前台用户；用 `curl` 无法直接建用户，因此本步只验证未登录返回 401、路由能编译）：

```bash
curl -s -X POST localhost:3312/api/mall/orders -H 'content-type: application/json' -d '{"items":[],"clientToken":"x"}'
curl -s localhost:3312/api/mall/manage/orders
curl -s localhost:3312/api/mall/manage/badge
curl -s localhost:3312/api/mall/products/5001/sku-stock | head -c 200
```

Expected：前三个 `{"code":401,...}`；第四个 `code 0` 或 `code 404`（视种子商品 id 而定，不是 500）。停掉服务。

- [ ] **Step 6: 提交**

```bash
git add app/api/mall/manage/orders app/api/mall/manage/badge
git commit -m "feat: 管理端订单接口（列表、详情已读、确认/完成/取消、新单红点）"
```

---

### Task 5: 小程序选购清单与加购

**Files:**
- Create `xiaojing-mp/utils/cart.js`
- Modify `xiaojing-mp/pages/goods-detail/goods-detail.{js,wxml,wxss}`
- Create `xiaojing-mp/pages/cart/cart.{js,json,wxml,wxss}`
- Modify `xiaojing-mp/tools/gen-tabbar-icons.js`、`xiaojing-mp/app.json`

- [ ] **Step 1: 本地清单工具**

`utils/cart.js`：

```js
/**
 * 选购清单：只存在本机，提交订单时由服务端重新校验库存与价格
 * 每行：{ skuId, productId, name, specName, cover, unitWeight, laborFeePerG, qty }
 */
const KEY = 'fs_cart';

function list() {
  return wx.getStorageSync(KEY) || [];
}

function save(items) {
  wx.setStorageSync(KEY, items);
  refreshBadge(items);
  return items;
}

function count(items) {
  return (items || list()).reduce(function (s, i) {
    return s + i.qty;
  }, 0);
}

/** tab「选购清单」角标；当前页面不是 tab 页时 setTabBarBadge 会失败，忽略即可 */
function refreshBadge(items) {
  const n = count(items);
  if (n > 0) wx.setTabBarBadge({ index: 2, text: n > 99 ? '99+' : String(n), fail: function () {} });
  else wx.removeTabBarBadge({ index: 2, fail: function () {} });
}

function add(line) {
  const items = list();
  const hit = items.find(function (i) {
    return i.skuId === line.skuId;
  });
  if (hit) hit.qty += line.qty;
  else items.unshift(line);
  return save(items);
}

function setQty(skuId, qty) {
  const items = list()
    .map(function (i) {
      return i.skuId === skuId ? Object.assign({}, i, { qty: qty }) : i;
    })
    .filter(function (i) {
      return i.qty > 0;
    });
  return save(items);
}

function remove(skuId) {
  return save(
    list().filter(function (i) {
      return i.skuId !== skuId;
    })
  );
}

function clear() {
  return save([]);
}

module.exports = { list: list, add: add, setQty: setQty, remove: remove, clear: clear, count: count, refreshBadge: refreshBadge };
```

- [ ] **Step 2: 清单 tab 图标**

`tools/gen-tabbar-icons.js`：在 `function contactIcon` 之后加：

```js
function cartIcon(px, py) {
  // 清单：圆角矩形外框 + 三条横线
  const inBox = px >= 0.2 && px <= 0.8 && py >= 0.18 && py <= 0.84;
  const nearX = Math.min(Math.abs(px - 0.2), Math.abs(px - 0.8)) <= STROKE && py >= 0.18 && py <= 0.84;
  const nearY = Math.min(Math.abs(py - 0.18), Math.abs(py - 0.84)) <= STROKE && px >= 0.2 && px <= 0.8;
  if (nearX || nearY) return true;
  if (!inBox) return false;
  return [0.38, 0.52, 0.66].some(function (y) {
    return Math.abs(py - y) <= STROKE * 0.8 && px >= 0.32 && px <= 0.68;
  });
}
```

`icons` 数组改为：

```js
const icons = [
  ['home', homeIcon],
  ['category', categoryIcon],
  ['cart', cartIcon],
  ['contact', contactIcon],
];
```

Run（在 `xiaojing-mp/`）：`node tools/gen-tabbar-icons.js && ls assets/tabbar`
Expected: 出现 `cart.png`、`cart-active.png`

- [ ] **Step 3: tabBar 与页面注册**

`app.json`：`pages` 末尾加 `"pages/cart/cart"`；`tabBar.list` 在「分类」与「我的」之间插入：

```json
      {
        "pagePath": "pages/cart/cart",
        "text": "选购清单",
        "iconPath": "assets/tabbar/cart.png",
        "selectedIconPath": "assets/tabbar/cart-active.png"
      },
```

（「我的」变为第 4 项，index 3；`utils/cart.js` 的角标 index 2 对应「选购清单」。）

- [ ] **Step 4: 详情页加购弹层**

`pages/goods-detail/goods-detail.js`：顶部 require 区加：

```js
const cart = require('../../utils/cart');
const { getUser } = require('../../utils/auth');
```

`data` 中加：

```js
    sheetOpen: false,
    sheetSkus: [],
    sheetIndex: 0,
    sheetQty: 1,
    sheetLoading: false,
```

在 `Page({...})` 中加以下方法（放在 `consult` 方法之前）：

```js
  /** 打开加购弹层：先确认是客户账号，再取各规格可售件数 */
  openSheet: function () {
    const that = this;
    const me = getUser();
    if (!me) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    if (me.role !== 'CUSTOMER') {
      wx.showToast({ title: '当前是管理账号，用客户账号登录后才能下单', icon: 'none' });
      return;
    }
    this.setData({ sheetOpen: true, sheetLoading: true });
    get('/api/mall/products/' + this.data.id + '/sku-stock')
      .then(function (res) {
        const skus = res.skus.map(function (s) {
          return Object.assign({}, s, { label: s.specName + (s.availableQty > 0 ? '（可售 ' + s.availableQty + ' 件）' : '（缺货）') });
        });
        const first = Math.max(0, skus.findIndex(function (s) { return s.availableQty > 0; }));
        that.setData({ sheetSkus: skus, sheetIndex: first, sheetQty: 1, sheetLoading: false, sheetFee: res.laborFeePerG });
      })
      .catch(function (e) {
        that.setData({ sheetOpen: false, sheetLoading: false });
        wx.showToast({ title: errMsg(e), icon: 'none' });
      });
  },

  closeSheet: function () {
    this.setData({ sheetOpen: false });
  },

  pickSku: function (e) {
    this.setData({ sheetIndex: Number(e.currentTarget.dataset.index), sheetQty: 1 });
  },

  stepQty: function (e) {
    const sku = this.data.sheetSkus[this.data.sheetIndex];
    const max = sku ? sku.availableQty : 0;
    const next = this.data.sheetQty + Number(e.currentTarget.dataset.d);
    this.setData({ sheetQty: Math.max(1, Math.min(max, next)) });
  },

  confirmAdd: function () {
    const p = this.data.product;
    const sku = this.data.sheetSkus[this.data.sheetIndex];
    if (!sku || sku.availableQty < 1) {
      wx.showToast({ title: '该规格暂时缺货', icon: 'none' });
      return;
    }
    const inCart = cart.list().find(function (i) { return i.skuId === sku.skuId; });
    if ((inCart ? inCart.qty : 0) + this.data.sheetQty > sku.availableQty) {
      wx.showToast({ title: '超过可售件数（清单里已有 ' + (inCart ? inCart.qty : 0) + ' 件）', icon: 'none' });
      return;
    }
    cart.add({
      skuId: sku.skuId,
      productId: p.id,
      name: p.name,
      specName: sku.specName,
      cover: p.cover,
      unitWeight: sku.unitWeight,
      laborFeePerG: this.data.sheetFee,
      qty: this.data.sheetQty,
    });
    this.setData({ sheetOpen: false });
    wx.showToast({ title: '已加入选购清单', icon: 'success' });
  },

  goCart: function () {
    wx.switchTab({ url: '/pages/cart/cart' });
  },
```

`pages/goods-detail/goods-detail.wxml`：把底部按钮栏中的

```xml
      <view class="bar-main" hover-class="bar-main-hover" bindtap="consult">咨询客服 · 获取报价</view>
```

替换为：

```xml
      <view class="bar-left" hover-class="bar-left-hover" bindtap="goCart">
        <text class="bar-cart-icon">☰</text>
        <text class="bar-left-text">清单</text>
      </view>
      <view class="bar-sub" hover-class="bar-sub-hover" bindtap="consult">咨询客服</view>
      <view class="bar-main" hover-class="bar-main-hover" bindtap="openSheet">加入选购清单</view>
```

并在 `</block>`（`viewState === 'ready'` 的 block 结束）之前、底部按钮栏之后加入弹层：

```xml
    <view wx:if="{{sheetOpen}}" class="sheet-mask" bindtap="closeSheet">
      <view class="sheet" catchtap="noop">
        <view class="sheet-head">
          <text class="sheet-title">{{product.name}}</text>
          <text class="sheet-close" bindtap="closeSheet">✕</text>
        </view>
        <view wx:if="{{sheetLoading}}" class="sheet-loading">加载中…</view>
        <block wx:else>
          <text class="sheet-label">规格</text>
          <view class="sheet-skus">
            <view
              wx:for="{{sheetSkus}}"
              wx:key="skuId"
              class="sheet-sku {{index === sheetIndex ? 'sheet-sku-on' : ''}} {{item.availableQty < 1 ? 'sheet-sku-off' : ''}}"
              data-index="{{index}}"
              bindtap="pickSku"
            >{{item.label}}</view>
          </view>
          <view class="sheet-qty-row">
            <text class="sheet-label">件数</text>
            <view class="stepper">
              <view class="step" data-d="-1" bindtap="stepQty">－</view>
              <text class="step-num">{{sheetQty}}</text>
              <view class="step" data-d="1" bindtap="stepQty">＋</view>
            </view>
          </view>
          <button class="btn btn-gold sheet-ok" bindtap="confirmAdd">加入选购清单</button>
        </block>
      </view>
    </view>
```

`Page` 中加空方法 `noop: function () {},`（若已存在则不重复加）。

`pages/goods-detail/goods-detail.wxss` 末尾追加：

```css
.bar-cart-icon { font-size: 36rpx; color: #8c6b3b; line-height: 1; }
.bar-sub {
  margin-left: 16rpx;
  height: 88rpx;
  padding: 0 28rpx;
  border-radius: 24rpx;
  border: 1rpx solid #a8864f;
  color: #8c6b3b;
  font-size: 28rpx;
  display: flex;
  align-items: center;
}
.bar-sub-hover { background: #f8f4ee; }
.sheet-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 100; display: flex; align-items: flex-end; }
.sheet { width: 100%; background: #ffffff; border-radius: 32rpx 32rpx 0 0; padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom)); }
.sheet-head { display: flex; justify-content: space-between; align-items: center; }
.sheet-title { font-size: 30rpx; font-weight: 600; color: #2e261f; }
.sheet-close { font-size: 32rpx; color: #a39a8e; padding: 8rpx; }
.sheet-loading { padding: 80rpx 0; text-align: center; color: #8a7a66; }
.sheet-label { display: block; margin-top: 28rpx; font-size: 26rpx; color: #52525b; }
.sheet-skus { display: flex; flex-wrap: wrap; margin-top: 12rpx; }
.sheet-sku { margin: 0 16rpx 16rpx 0; padding: 12rpx 24rpx; border-radius: 16rpx; background: #f4f4f5; font-size: 26rpx; color: #2e261f; }
.sheet-sku-on { background: #f3ece2; color: #8c6b3b; border: 1rpx solid #a8864f; }
.sheet-sku-off { color: #a1a1aa; }
.sheet-qty-row { display: flex; align-items: center; justify-content: space-between; }
.stepper { display: flex; align-items: center; margin-top: 28rpx; }
.step { width: 64rpx; height: 64rpx; border-radius: 16rpx; background: #f4f4f5; text-align: center; line-height: 64rpx; font-size: 32rpx; }
.step-num { width: 88rpx; text-align: center; font-size: 30rpx; }
.sheet-ok { margin-top: 40rpx; }
```

- [ ] **Step 5: 选购清单页**

`pages/cart/cart.json`：

```json
{
  "navigationBarTitleText": "选购清单",
  "usingComponents": {}
}
```

`pages/cart/cart.js`：

```js
const cart = require('../../utils/cart');
const { post, errMsg } = require('../../utils/request');
const { imageUrl } = require('../../utils/asset');
const { getUser } = require('../../utils/auth');

function newToken() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

Page({
  data: {
    items: [],
    totalQty: 0,
    totalWeight: '0',
    totalFee: '',
    remark: '',
    submitting: false,
    isCustomer: true,
  },

  /** 一次提交用同一个编号，网络重试不会生成重复订单；成功后换新 */
  clientToken: newToken(),

  onShow: function () {
    const me = getUser();
    this.setData({ isCustomer: !me || me.role === 'CUSTOMER' });
    this.render(cart.list());
  },

  render: function (items) {
    let weight = 0;
    let fee = 0;
    let feeKnown = true;
    const rows = items.map(function (i) {
      const w = (i.unitWeight || 0) * i.qty;
      weight += w;
      if (i.laborFeePerG === null || i.laborFeePerG === undefined) feeKnown = false;
      else fee += w * i.laborFeePerG;
      return Object.assign({}, i, { coverUrl: imageUrl(i.cover), weightText: w.toFixed(2) });
    });
    this.setData({
      items: rows,
      totalQty: cart.count(items),
      totalWeight: weight.toFixed(2),
      totalFee: items.length && feeKnown ? fee.toFixed(2) : '',
    });
    cart.refreshBadge(items);
  },

  step: function (e) {
    const skuId = Number(e.currentTarget.dataset.id);
    const d = Number(e.currentTarget.dataset.d);
    const hit = cart.list().find(function (i) { return i.skuId === skuId; });
    if (!hit) return;
    this.render(cart.setQty(skuId, Math.max(1, hit.qty + d)));
  },

  remove: function (e) {
    const that = this;
    const skuId = Number(e.currentTarget.dataset.id);
    wx.showModal({
      title: '移出清单',
      content: '确定把这一款移出选购清单？',
      success: function (r) {
        if (r.confirm) that.render(cart.remove(skuId));
      },
    });
  },

  onRemark: function (e) {
    this.setData({ remark: e.detail.value });
  },

  goShop: function () {
    wx.switchTab({ url: '/pages/index/index' });
  },

  submit: function () {
    const that = this;
    const items = cart.list();
    if (!items.length || this.data.submitting) return;
    if (!getUser()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({ submitting: true });
    post('/api/mall/orders', {
      items: items.map(function (i) { return { skuId: i.skuId, qty: i.qty }; }),
      remark: this.data.remark,
      clientToken: this.clientToken,
    })
      .then(function (order) {
        cart.clear();
        that.clientToken = newToken();
        that.setData({ submitting: false, remark: '' });
        that.render([]);
        wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + order.id + '&fresh=1' });
      })
      .catch(function (e) {
        that.setData({ submitting: false });
        wx.showModal({ title: '提交失败', content: errMsg(e), showCancel: false });
      });
  },
});
```

`pages/cart/cart.wxml`：

```xml
<view class="page cart">
  <view wx:if="{{!items.length}}" class="empty">
    <text class="empty-title">选购清单是空的</text>
    <text class="empty-sub">在商品详情页点「加入选购清单」，选好后一次提交</text>
    <button class="btn btn-gold empty-btn" bindtap="goShop">去选货</button>
  </view>

  <block wx:else>
    <view class="card list">
      <view wx:for="{{items}}" wx:key="skuId" class="row">
        <image class="cover" src="{{item.coverUrl}}" mode="aspectFill" />
        <view class="main">
          <text class="name clamp-2">{{item.name}}</text>
          <text class="spec">{{item.specName}} · 约 {{item.weightText}} g</text>
          <view class="ops">
            <view class="stepper">
              <view class="step" data-id="{{item.skuId}}" data-d="-1" bindtap="step">－</view>
              <text class="num">{{item.qty}}</text>
              <view class="step" data-id="{{item.skuId}}" data-d="1" bindtap="step">＋</view>
            </view>
            <text class="del" data-id="{{item.skuId}}" bindtap="remove">移除</text>
          </view>
        </view>
      </view>
    </view>

    <view class="card remark">
      <textarea class="remark-input" maxlength="200" placeholder="备注（选填）：如尺寸、交货时间" value="{{remark}}" bindinput="onRemark" auto-height />
    </view>

    <text class="note">预估克重与工费不含当日金价，最终以业务员确认为准。提交后业务员会联系您。</text>

    <view class="bar">
      <view class="sum">
        <text class="sum-main">共 {{totalQty}} 件 · 约 {{totalWeight}} g</text>
        <text class="sum-sub">{{totalFee ? '预估工费 ¥' + totalFee : '工费以业务员报价为准'}}</text>
      </view>
      <button class="btn btn-gold submit" loading="{{submitting}}" disabled="{{submitting || !isCustomer}}" bindtap="submit">{{isCustomer ? '提交订单' : '管理账号不能下单'}}</button>
    </view>
  </block>
</view>
```

`pages/cart/cart.wxss`：

```css
.cart { background: #f6f3ee; padding-bottom: 200rpx; }
.empty { padding: 200rpx 64rpx 0; display: flex; flex-direction: column; align-items: center; }
.empty-title { font-size: 32rpx; color: #2e261f; }
.empty-sub { margin-top: 12rpx; font-size: 24rpx; color: #8a7a66; text-align: center; }
.empty-btn { margin-top: 40rpx; width: 280rpx; }
.list { margin: 24rpx; padding: 0 24rpx; }
.row { display: flex; padding: 24rpx 0; border-bottom: 1rpx solid #f0ebe3; }
.row:last-child { border-bottom: none; }
.cover { width: 160rpx; height: 160rpx; border-radius: 16rpx; background: #f3ece2; flex-shrink: 0; }
.main { flex: 1; min-width: 0; margin-left: 20rpx; display: flex; flex-direction: column; }
.name { font-size: 28rpx; color: #2e261f; }
.spec { margin-top: 8rpx; font-size: 24rpx; color: #8a7a66; }
.ops { margin-top: auto; display: flex; justify-content: space-between; align-items: center; }
.stepper { display: flex; align-items: center; }
.step { width: 56rpx; height: 56rpx; border-radius: 12rpx; background: #f4f4f5; text-align: center; line-height: 56rpx; font-size: 28rpx; }
.num { width: 72rpx; text-align: center; font-size: 28rpx; }
.del { font-size: 24rpx; color: #a39a8e; }
.remark { margin: 0 24rpx; padding: 20rpx 24rpx; }
.remark-input { width: 100%; min-height: 80rpx; font-size: 26rpx; }
.note { display: block; margin: 20rpx 32rpx; font-size: 22rpx; color: #a39a8e; }
.bar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center; padding: 16rpx 24rpx; background: #ffffff; box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.05); }
.sum { flex: 1; min-width: 0; }
.sum-main { display: block; font-size: 28rpx; color: #2e261f; font-weight: 600; }
.sum-sub { display: block; margin-top: 4rpx; font-size: 22rpx; color: #8c6b3b; }
.submit { width: 260rpx; margin: 0; }
```

（tab 页底部已有 tabBar，`.bar` 固定在 tabBar 之上，无需安全区留白。）

- [ ] **Step 6: 首页等 tab 页显示角标**

在 `pages/index/index.js`、`pages/category/category.js` 的 `onShow`（没有就新增 `onShow: function () {...}`）里调用：

```js
    require('../../utils/cart').refreshBadge();
```

`pages/mine/mine.js` 的 `onShow` 开头同样调用一次（「我的」也是 tab 页）。

- [ ] **Step 7: 语法检查**

Run（在 `xiaojing-mp/`）：

```bash
for f in utils/cart.js pages/cart/cart.js pages/goods-detail/goods-detail.js pages/index/index.js pages/category/category.js pages/mine/mine.js tools/gen-tabbar-icons.js; do node --check $f || echo BAD $f; done
python3 -c "import json;[json.load(open(p)) for p in ['app.json','pages/cart/cart.json']]"
```

Expected: 无 BAD 输出

---

### Task 6: 小程序我的订单

**Files:** Create `xiaojing-mp/pages/order-list/*`、`xiaojing-mp/pages/order-detail/*`；Modify `xiaojing-mp/pages/mine/*`、`app.json`

- [ ] **Step 1: 订单列表（客户、管理端共用一个组件逻辑：通过 `mode` 区分接口）**

`pages/order-list/order-list.json`：

```json
{
  "navigationBarTitleText": "我的订单",
  "enablePullDownRefresh": true,
  "usingComponents": {
    "state-view": "/components/state-view/state-view"
  }
}
```

`pages/order-list/order-list.js`：

```js
const { get, errMsg } = require('../../utils/request');

const TABS = [
  { key: '', label: '全部' },
  { key: 'PENDING', label: '待确认' },
  { key: 'CONFIRMED', label: '已确认' },
  { key: 'COMPLETED', label: '已完成' },
  { key: 'CANCELLED', label: '已取消' },
];

Page({
  data: {
    manage: false,
    tabs: TABS,
    status: '',
    list: [],
    viewState: 'loading',
    errorText: '',
  },

  onLoad: function (options) {
    const manage = options.mode === 'manage';
    this.setData({ manage: manage, status: options.status || '' });
    wx.setNavigationBarTitle({ title: manage ? '订单管理' : '我的订单' });
  },

  onShow: function () {
    this.load();
  },

  onPullDownRefresh: function () {
    this.load(function () {
      wx.stopPullDownRefresh();
    });
  },

  load: function (done) {
    const that = this;
    this.setData({ viewState: 'loading' });
    const url = this.data.manage ? '/api/mall/manage/orders' : '/api/mall/orders';
    get(url, { status: this.data.status })
      .then(function (list) {
        const rows = list.map(function (o) {
          return Object.assign({}, o, {
            timeText: o.createdAt.slice(5, 16).replace('T', ' '),
            firstName: o.items[0] ? o.items[0].name : '',
            unseen: that.data.manage && o.status === 'PENDING' && !o.seenBySales,
          });
        });
        that.setData({ list: rows, viewState: rows.length ? 'ready' : 'empty' });
      })
      .catch(function (e) {
        that.setData({ viewState: 'error', errorText: errMsg(e) });
      })
      .then(function () {
        if (typeof done === 'function') done();
      });
  },

  onTab: function (e) {
    this.setData({ status: e.currentTarget.dataset.key });
    this.load();
  },

  onItem: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/order-detail/order-detail?id=' + id + (this.data.manage ? '&mode=manage' : ''),
    });
  },
});
```

`pages/order-list/order-list.wxml`：

```xml
<view class="page orders">
  <scroll-view scroll-x class="tabs">
    <view
      wx:for="{{tabs}}"
      wx:key="key"
      class="tab {{status === item.key ? 'tab-on' : ''}}"
      data-key="{{item.key}}"
      bindtap="onTab"
    >{{item.label}}</view>
  </scroll-view>

  <state-view wx:if="{{viewState !== 'ready'}}" state="{{viewState}}" text="{{viewState === 'empty' ? '还没有订单' : errorText}}" bind:retry="load" />

  <view wx:else>
    <view wx:for="{{list}}" wx:key="id" class="card order" data-id="{{item.id}}" bindtap="onItem">
      <view class="order-head">
        <text class="order-no">{{item.orderNo}}</text>
        <text class="status s-{{item.status}}">{{item.statusLabel}}</text>
      </view>
      <text wx:if="{{manage}}" class="customer">{{item.customerName}} · {{item.customerPhone}}</text>
      <text class="goods ellipsis">{{item.firstName}}{{item.items.length > 1 ? ' 等 ' + item.items.length + ' 款' : ''}}</text>
      <view class="order-foot">
        <text class="time">{{item.timeText}}</text>
        <text class="sum">{{item.totalQty}} 件 · {{item.totalWeight}} g</text>
      </view>
      <view wx:if="{{item.unseen}}" class="dot"></view>
    </view>
  </view>
</view>
```

`pages/order-list/order-list.wxss`：

```css
.orders { background: #f6f3ee; padding-bottom: 40rpx; }
.tabs { white-space: nowrap; padding: 20rpx 16rpx; background: #ffffff; }
.tab { display: inline-block; margin: 0 8rpx; padding: 10rpx 26rpx; border-radius: 999rpx; font-size: 26rpx; color: #52525b; background: #f4f4f5; }
.tab-on { background: #a8864f; color: #ffffff; }
.order { position: relative; margin: 24rpx 24rpx 0; padding: 28rpx; }
.order-head { display: flex; justify-content: space-between; align-items: center; }
.order-no { font-size: 26rpx; color: #52525b; }
.status { font-size: 24rpx; }
.s-PENDING { color: #ea580c; }
.s-CONFIRMED { color: #8c6b3b; }
.s-COMPLETED { color: #16a34a; }
.s-CANCELLED { color: #a1a1aa; }
.customer { display: block; margin-top: 12rpx; font-size: 28rpx; color: #2e261f; font-weight: 600; }
.goods { display: block; margin-top: 12rpx; font-size: 28rpx; color: #2e261f; }
.order-foot { margin-top: 16rpx; display: flex; justify-content: space-between; font-size: 24rpx; color: #8a7a66; }
.dot { position: absolute; top: 20rpx; right: 20rpx; width: 16rpx; height: 16rpx; border-radius: 50%; background: #dc2626; }
```

- [ ] **Step 2: 订单详情（客户可取消待确认；管理端可确认/完成/取消）**

`pages/order-detail/order-detail.json`：

```json
{
  "navigationBarTitleText": "订单详情",
  "usingComponents": {
    "state-view": "/components/state-view/state-view"
  }
}
```

`pages/order-detail/order-detail.js`：

```js
const { get, post, errMsg } = require('../../utils/request');
const { imageUrl } = require('../../utils/asset');

Page({
  data: {
    id: 0,
    manage: false,
    fresh: false,
    order: null,
    viewState: 'loading',
    errorText: '',
    busy: false,
  },

  onLoad: function (options) {
    this.setData({ id: Number(options.id), manage: options.mode === 'manage', fresh: options.fresh === '1' });
    this.load();
  },

  load: function () {
    const that = this;
    const url = (this.data.manage ? '/api/mall/manage/orders/' : '/api/mall/orders/') + this.data.id;
    get(url)
      .then(function (o) {
        o.items = o.items.map(function (i) {
          return Object.assign({}, i, { coverUrl: imageUrl(i.cover) });
        });
        o.timeText = o.createdAt.slice(0, 16).replace('T', ' ');
        that.setData({ order: o, viewState: 'ready' });
      })
      .catch(function (e) {
        that.setData({ viewState: 'error', errorText: errMsg(e) });
      });
  },

  call: function () {
    wx.makePhoneCall({ phoneNumber: this.data.order.customerPhone });
  },

  act: function (e) {
    const that = this;
    const action = e.currentTarget.dataset.action;
    const titles = { confirm: '确认订单', complete: '标记完成', cancel: '取消订单' };
    if (action === 'cancel' && this.data.manage) {
      wx.showModal({
        title: '取消订单',
        editable: true,
        placeholderText: '请填写取消原因（必填）',
        success: function (r) {
          if (r.confirm) that.send(action, (r.content || '').trim());
        },
      });
      return;
    }
    wx.showModal({
      title: titles[action],
      content: action === 'cancel' ? '取消后库存会退回，确定取消？' : '确定' + titles[action] + '？',
      success: function (r) {
        if (r.confirm) that.send(action, '');
      },
    });
  },

  send: function (action, reason) {
    const that = this;
    if (action === 'cancel' && this.data.manage && !reason) {
      wx.showToast({ title: '请填写取消原因', icon: 'none' });
      return;
    }
    const url = this.data.manage
      ? '/api/mall/manage/orders/' + this.data.id + '/' + action
      : '/api/mall/orders/' + this.data.id + '/cancel';
    this.setData({ busy: true });
    post(url, { reason: reason })
      .then(function () {
        wx.showToast({ title: '已更新', icon: 'success' });
        that.setData({ busy: false });
        that.load();
      })
      .catch(function (e) {
        that.setData({ busy: false });
        wx.showModal({ title: '操作失败', content: errMsg(e), showCancel: false });
      });
  },
});
```

`pages/order-detail/order-detail.wxml`：

```xml
<view class="page detail">
  <state-view wx:if="{{viewState !== 'ready'}}" state="{{viewState}}" text="{{errorText}}" bind:retry="load" />

  <block wx:else>
    <view wx:if="{{fresh}}" class="fresh">订单已提交，业务员会尽快与您联系确认</view>

    <view class="card head">
      <view class="head-row">
        <text class="status s-{{order.status}}">{{order.statusLabel}}</text>
        <text class="no">{{order.orderNo}}</text>
      </view>
      <text class="time">下单时间 {{order.timeText}}</text>
      <view wx:if="{{manage}}" class="cust" bindtap="call">
        <text>{{order.customerName}} · {{order.customerPhone}}</text>
        <text class="call">拨打</text>
      </view>
      <text wx:if="{{order.status === 'CANCELLED'}}" class="cancel">取消原因：{{order.cancelReason}}（{{order.cancelledBy}}）</text>
    </view>

    <view class="card items">
      <view wx:for="{{order.items}}" wx:key="skuId" class="item">
        <image class="cover" src="{{item.coverUrl}}" mode="aspectFill" />
        <view class="item-main">
          <text class="name clamp-2">{{item.name}}</text>
          <text class="spec">{{item.styleNo}} · {{item.specName}}</text>
          <text class="spec">{{item.qty}} 件 · 约 {{item.weight}} g{{item.laborFee !== null ? ' · 工费 ¥' + item.laborFee : ''}}</text>
        </view>
      </view>
      <view class="total">
        <text>共 {{order.totalQty}} 件 · 约 {{order.totalWeight}} g</text>
        <text class="fee">{{order.totalLaborFee !== null ? '预估工费 ¥' + order.totalLaborFee : '工费以业务员报价为准'}}</text>
      </view>
      <text wx:if="{{order.remark}}" class="remark">备注：{{order.remark}}</text>
    </view>

    <text class="note">预估克重与工费不含当日金价，以业务员确认为准。</text>

    <view class="actions">
      <block wx:if="{{manage}}">
        <button wx:if="{{order.status === 'PENDING'}}" class="btn btn-gold" disabled="{{busy}}" data-action="confirm" bindtap="act">确认订单</button>
        <button wx:if="{{order.status === 'CONFIRMED'}}" class="btn btn-gold" disabled="{{busy}}" data-action="complete" bindtap="act">标记完成</button>
        <button wx:if="{{order.status === 'PENDING' || order.status === 'CONFIRMED'}}" class="btn btn-plain" disabled="{{busy}}" data-action="cancel" bindtap="act">取消订单</button>
      </block>
      <button wx:elif="{{order.status === 'PENDING'}}" class="btn btn-plain" disabled="{{busy}}" data-action="cancel" bindtap="act">取消订单</button>
    </view>
  </block>
</view>
```

`pages/order-detail/order-detail.wxss`：

```css
.detail { background: #f6f3ee; padding-bottom: 60rpx; }
.fresh { margin: 24rpx 24rpx 0; padding: 20rpx 24rpx; border-radius: 16rpx; background: #ecfdf5; color: #059669; font-size: 26rpx; }
.head { margin: 24rpx 24rpx 0; padding: 28rpx; }
.head-row { display: flex; justify-content: space-between; align-items: center; }
.status { font-size: 34rpx; font-weight: 600; }
.s-PENDING { color: #ea580c; }
.s-CONFIRMED { color: #8c6b3b; }
.s-COMPLETED { color: #16a34a; }
.s-CANCELLED { color: #a1a1aa; }
.no { font-size: 24rpx; color: #8a7a66; }
.time { display: block; margin-top: 12rpx; font-size: 24rpx; color: #8a7a66; }
.cust { margin-top: 20rpx; display: flex; justify-content: space-between; font-size: 28rpx; color: #2e261f; }
.call { color: #8c6b3b; }
.cancel { display: block; margin-top: 16rpx; font-size: 24rpx; color: #dc2626; }
.items { margin: 24rpx 24rpx 0; padding: 0 28rpx 24rpx; }
.item { display: flex; padding: 24rpx 0; border-bottom: 1rpx solid #f0ebe3; }
.cover { width: 140rpx; height: 140rpx; border-radius: 12rpx; background: #f3ece2; flex-shrink: 0; }
.item-main { flex: 1; min-width: 0; margin-left: 20rpx; }
.name { font-size: 28rpx; color: #2e261f; }
.spec { display: block; margin-top: 6rpx; font-size: 24rpx; color: #8a7a66; }
.total { display: flex; justify-content: space-between; padding-top: 20rpx; font-size: 26rpx; color: #2e261f; }
.fee { color: #8c6b3b; }
.remark { display: block; margin-top: 16rpx; font-size: 24rpx; color: #52525b; }
.note { display: block; margin: 20rpx 32rpx; font-size: 22rpx; color: #a39a8e; }
.actions { padding: 0 32rpx; }
.actions .btn { margin-top: 20rpx; }
```

- [ ] **Step 3: 「我的」加入口与红点**

`pages/mine/mine.js`：`data` 加 `badge: 0`；在 `onShow` 中拿到用户后（`get('/api/mall/auth/me', ...)` 的 then 里，`that.setData({ user: user })` 之后）加：

```js
        if (user.role === 'OWNER' || user.role === 'SALES') {
          get('/api/mall/manage/badge')
            .then(function (b) {
              that.setData({ badge: b.pendingUnseen });
            })
            .catch(function () {});
        }
```

加方法：

```js
  goOrders: function () {
    wx.navigateTo({ url: '/pages/order-list/order-list' });
  },

  goManageOrders: function () {
    wx.navigateTo({ url: '/pages/order-list/order-list?mode=manage&status=PENDING' });
  },
```

`pages/mine/mine.wxml`：在第一个 `<view class="card list">` 内最前面加：

```xml
    <view wx:if="{{user && user.role === 'CUSTOMER'}}" class="row" bindtap="goOrders">
      <text class="row-label">我的订单</text>
      <text class="row-arrow">›</text>
    </view>
    <view wx:if="{{user && (user.role === 'OWNER' || user.role === 'SALES')}}" class="row" bindtap="goManageOrders">
      <text class="row-label">订单管理</text>
      <view class="row-right">
        <text wx:if="{{badge > 0}}" class="row-badge">{{badge}}</text>
        <text class="row-arrow">›</text>
      </view>
    </view>
```

`pages/mine/mine.wxss` 追加：

```css
.row-right { display: flex; align-items: center; }
.row-badge { margin-right: 12rpx; min-width: 36rpx; height: 36rpx; padding: 0 10rpx; border-radius: 18rpx; background: #dc2626; color: #ffffff; font-size: 22rpx; line-height: 36rpx; text-align: center; }
```

- [ ] **Step 4: 注册页面并检查**

`app.json` 的 `pages` 末尾加 `"pages/order-list/order-list"`、`"pages/order-detail/order-detail"`。

Run（在 `xiaojing-mp/`）：

```bash
for f in pages/order-list/order-list.js pages/order-detail/order-detail.js pages/mine/mine.js; do node --check $f || echo BAD $f; done
python3 -c "import json;[json.load(open(p)) for p in ['app.json','pages/order-list/order-list.json','pages/order-detail/order-detail.json']]"
```

Expected: 无 BAD 输出。确认 `components/state-view` 的属性名与 `state`/`text`/`retry` 一致；确认 `wx.showModal` 的 `editable` 在基础库 2.17.1+ 可用（`project.config.json` 的 `libVersion` 不低于此版本，否则报告）。

---

### Task 7: 演示订单脚本

**Files:** Create `scripts/seed-demo-orders.ts`

- [ ] **Step 1: 脚本**

`scripts/seed-demo-orders.ts`：

```ts
// 给演示客户造几笔订单（走正常下单逻辑扣库存）：待确认 2、已确认 1、已完成 1
// 用法（在 huangjin-web 目录下）：
//   npx tsx --env-file=.env.local scripts/seed-demo-orders.ts          # 试运行
//   npx tsx --env-file=.env.local scripts/seed-demo-orders.ts --yes    # 实际写入
// 已有 clientToken 以 demo- 开头的订单时不会重复创建
import { loadDB, mutate, storageDriver } from '../lib/store'
import { changeOrderStatus, placeOrder, sellableQty } from '../lib/order-service'
import type { DB } from '../lib/types'

const yes = process.argv.includes('--yes')
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
  const sales = (id: number | null | undefined) => db.mallUser.find((u) => u.id === id)
  // 取 4 款库存充足、有单件克重的在架商品
  const skus = db.productSku
    .filter((s) => !s.deleted && s.status === 1 && sellableQty(s) >= 3)
    .filter((s) => db.product.some((p) => p.id === s.productId && !p.deleted && p.status === 1))
    .slice(0, 4)
  if (skus.length < 4) throw new Error('可下单的商品不足 4 款')
  return { c: c as NonNullable<(typeof c)[number]>[], skus, sales }
}

async function main() {
  const preview = plan(await loadDB())
  if (!preview) {
    console.log('已存在演示订单，跳过')
    return
  }
  console.log('将创建 4 笔演示订单（待确认 2、已确认 1、已完成 1）')
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
```

- [ ] **Step 2: 检查并提交**

Run: `npm run typecheck`

```bash
git add scripts/seed-demo-orders.ts
git commit -m "chore: 演示订单脚本"
```

---

### Task 8: 上线与验收

- [ ] **Step 1:** `npm test && npm run typecheck && npm run build` 全部通过。
- [ ] **Step 2:** 推送并等部署：`git push origin feat/order-flow-login:main`，等 `curl -s https://xiaojing.keyseal.top/api/mall/manage/badge` 返回 `"code":401`（新接口已上线）。
- [ ] **Step 3:** 试运行再写入演示订单：`npx tsx --env-file=../huangjin-web/.env.local scripts/seed-demo-orders.ts`，确认后加 `--yes`。
- [ ] **Step 4（用户）:** 上传小程序体验版，验收：
  1. 客户 13800000021 登录 → 商品详情「加入选购清单」→ 选规格、件数 → 清单角标增加 → 清单页改件数 → 提交 → 跳到订单详情「订单已提交」。
  2. 「我的 → 我的订单」能看到刚才的单与演示单，待确认的可以取消，取消后再看商品可售件数恢复。
  3. 业务员 13800000011 登录 →「我的 → 订单管理」有红点 → 打开订单（红点消失）→ 确认 → 标记完成。
  4. 业务员取消订单必须填原因。
  5. 业务员 13800000012 看不到小王客户的订单；老板看得到全部。
