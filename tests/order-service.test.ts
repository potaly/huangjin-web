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
