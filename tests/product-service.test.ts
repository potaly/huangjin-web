import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addProduct, emptyDB } from './helpers'
import { deleteProduct, setProductStatus } from '../lib/product-service'
import type { AdminSession, Order } from '../lib/types'

const actor: AdminSession = { id: 1, username: 'mall:1', realName: '张三（小程序）', roleCode: 'OPERATOR', exp: 0 }

test('deleteProduct：已上架的商品不能删除', () => {
  const db = emptyDB()
  const { product } = addProduct(db, { status: 1, stockQty: 0 })
  assert.throws(() => deleteProduct(db, product.id, actor), /请先下架/)
})

test('deleteProduct：仍有库存不能删除', () => {
  const db = emptyDB()
  const { product } = addProduct(db, { status: 0, stockQty: 2 })
  assert.throws(() => deleteProduct(db, product.id, actor), /仍有库存/)
})

test('deleteProduct：有未完成订单不能删除', () => {
  const db = emptyDB()
  const { product, sku } = addProduct(db, { status: 0, stockQty: 0 })
  db.order.push({
    id: 1, status: 'PENDING', deleted: false,
    items: [{ productId: product.id, skuId: sku.id }],
  } as unknown as Order)
  assert.throws(() => deleteProduct(db, product.id, actor), /未完成订单/)
})

test('deleteProduct：成功时商品和 SKU 都软删除', () => {
  const db = emptyDB()
  const { product, sku } = addProduct(db, { status: 0, stockQty: 0 })
  deleteProduct(db, product.id, actor)
  assert.equal(product.deleted, true)
  assert.equal(sku.deleted, true)
  assert.equal(product.updatedBy, 'mall:1')
})

test('setProductStatus：无主图不能上架', () => {
  const db = emptyDB()
  const { product } = addProduct(db, { status: 0 })
  product.cover = undefined
  assert.throws(() => setProductStatus(db, product.id, 1, actor), /主图/)
})

test('setProductStatus：没有启用 SKU 不能上架', () => {
  const db = emptyDB()
  const { product, sku } = addProduct(db, { status: 0 })
  sku.status = 0
  assert.throws(() => setProductStatus(db, product.id, 1, actor), /SKU/)
})

test('setProductStatus：上架和下架成功', () => {
  const db = emptyDB()
  const { product } = addProduct(db, { status: 0 })
  setProductStatus(db, product.id, 1, actor)
  assert.equal(product.status, 1)
  setProductStatus(db, product.id, 0, actor)
  assert.equal(product.status, 0)
})
