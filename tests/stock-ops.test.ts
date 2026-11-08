import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addProduct, emptyDB } from './helpers'
import { parseStockOp, runStockOp } from '../lib/stock-ops'

test('parseStockOp：校验 SKU、原因和克重', () => {
  assert.throws(() => parseStockOp('IN', { weight: 1, reason: 'x' }), /SKU/)
  assert.throws(() => parseStockOp('IN', { skuId: 1, weight: 1 }), /原因/)
  assert.throws(() => parseStockOp('IN', { skuId: 1, weight: 'abc', reason: 'x' }), /克重/)
  assert.throws(() => parseStockOp('OUT', { skuId: 1, weight: 0, reason: 'x' }), /大于 0/)
  assert.equal(parseStockOp('ADJUST', { skuId: 1, weight: 0, reason: 'x' }).weight, 0)
  assert.equal(parseStockOp('IN', { skuId: 1, weight: 1.5, reason: 'x', refNo: 'R1' }).refNo, 'R1')
})

test('runStockOp：入库、出库、盘点的克重变化，操作人写入流水', () => {
  const db = emptyDB()
  const { sku } = addProduct(db, { refWeight: 5, stockQty: 2 })
  const operator = '张三（小程序）'

  const inLog = runStockOp(db, 'IN', { skuId: sku.id, weight: 1.5, reason: '进货' }, operator)
  assert.equal(sku.stockWeight, 11.5)
  assert.equal(inLog.operator, operator)
  assert.equal(inLog.changeWeight, 1.5)

  const outLog = runStockOp(db, 'OUT', { skuId: sku.id, weight: 0.5, reason: '损耗' }, operator)
  assert.equal(sku.stockWeight, 11)
  assert.equal(outLog.changeWeight, -0.5)

  runStockOp(db, 'ADJUST', { skuId: sku.id, weight: 8, reason: '盘点' }, operator)
  assert.equal(sku.stockWeight, 8)
})

test('runStockOp：出库超过库存时报错', () => {
  const db = emptyDB()
  const { sku } = addProduct(db, { refWeight: 1, stockQty: 1 })
  assert.throws(() => runStockOp(db, 'OUT', { skuId: sku.id, weight: 2, reason: 'x' }, 'a'), /库存不足/)
})
