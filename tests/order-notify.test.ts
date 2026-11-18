import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addProduct, addUser, emptyDB } from './helpers'
import { placeOrder } from '../lib/order-service'
import { nameValue, newOrderMessage, orderNotifyTargets, timeValue } from '../lib/order-notify'

function setup() {
  const db = emptyDB()
  const owner = addUser(db, { phone: '13800000000', role: 'OWNER', name: '老板', openid: 'o-owner' })
  const sales = addUser(db, { phone: '13800000011', role: 'SALES', name: '小王', openid: 'o-sales' })
  const c1 = addUser(db, { phone: '13800000021', role: 'CUSTOMER', name: '金福珠宝01', salesId: sales.id })
  const c2 = addUser(db, { phone: '13800000022', role: 'CUSTOMER', name: '周记' })
  const a = addProduct(db, { refWeight: 5, stockQty: 10 })
  const order = (c: typeof c1, token: string) => placeOrder(db, c, { items: [{ skuId: a.sku.id, qty: 1 }], clientToken: token })
  return { db, owner, sales, c1, c2, order }
}

test('通知对象：有业务员发业务员，没有则发老板', () => {
  const { db, owner, sales, c1, c2, order } = setup()
  assert.deepEqual(orderNotifyTargets(db, order(c1, 't1')).map((u) => u.id), [sales.id])
  assert.deepEqual(orderNotifyTargets(db, order(c2, 't2')).map((u) => u.id), [owner.id])
})

test('通知对象：业务员未绑微信或已停用时不发', () => {
  const { db, sales, c1, order } = setup()
  const o = order(c1, 't1')
  sales.openid = null
  assert.equal(orderNotifyTargets(db, o).length, 0)
  sales.openid = 'o-sales'
  sales.status = 0
  assert.equal(orderNotifyTargets(db, o).length, 0)
})

test('消息字段符合模版各类型限制', () => {
  const { c1, order } = setup()
  const o = order(c1, 't1')
  o.createdAt = '2026-11-10T09:05:00.000Z'
  const m = newOrderMessage(o, 'o-sales')
  assert.equal(m.touser, 'o-sales')
  assert.equal(m.page, `pages/order-detail/order-detail?id=${o.id}&mode=manage`)
  assert.deepEqual(m.data, {
    character_string1: { value: o.orderNo },
    name2: { value: '金福珠宝' },
    phone_number5: { value: '13800000021' },
    phrase6: { value: '待确认' },
    time7: { value: '2026年11月10日 17:05' },
  })
})

test('name 字段：纯汉字优先，其次纯字母，都没有时兜底', () => {
  assert.equal(nameValue('深圳水贝金福珠宝批发有限公司'), '深圳水贝金福珠宝批发')
  assert.equal(nameValue('Tom-2'), 'Tom')
  assert.equal(nameValue('123'), '客户')
  assert.equal(timeValue('2026-12-31T16:00:00.000Z'), '2027年1月1日 00:00')
})
