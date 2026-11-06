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
