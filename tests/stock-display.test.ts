import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addProduct, emptyDB } from './helpers'
import { productDetail, productCard } from '../lib/mall'
import { mallProductStockLevel, mallStockLevelOf, stockLevelOf } from '../lib/stock'
import { mainActionLabel, skuStockDisplay } from '../lib/stock-display'

test('可售克重不足一件：前台按售罄，后台仍按克重', () => {
  const db = emptyDB()
  const { product, sku } = addProduct(db, { name: '项链', refWeight: 12, stockQty: 1 })
  sku.stockWeight = 5
  sku.warnWeight = 0
  assert.equal(stockLevelOf(sku), 'ENOUGH')
  assert.equal(mallStockLevelOf(sku), 'SOLD_OUT')
  assert.equal(mallProductStockLevel([sku]), 'SOLD_OUT')
  assert.equal(productDetail(db, product, 'EXACT').stockLevel, 'SOLD_OUT')
  assert.equal(productDetail(db, product, 'EXACT').skus[0].level, 'SOLD_OUT')
  assert.equal(productCard(db, product, 'LEVEL').stockLevel, 'SOLD_OUT')
})

test('没有参考克重时无法换算件数，等级仍按克重', () => {
  const db = emptyDB()
  const { sku } = addProduct(db, { name: '项链', refWeight: 12, stockQty: 1 })
  sku.refWeight = null
  sku.stockWeight = 5
  sku.warnWeight = 0
  assert.equal(mallStockLevelOf(sku), 'ENOUGH')
})

test('规格行：精确模式显示件数，偏低用「仅剩」', () => {
  assert.deepEqual(skuStockDisplay({ level: 'ENOUGH', availableQty: 18 }, 'EXACT', false), {
    tone: 'ENOUGH', qty: 18, prefix: '库存', word: '',
  })
  assert.deepEqual(skuStockDisplay({ level: 'LOW', availableQty: 3 }, 'EXACT', false), {
    tone: 'LOW', qty: 3, prefix: '仅剩', word: '',
  })
})

test('规格行：售罄、下架、等级模式、无法换算都不显示数字', () => {
  assert.deepEqual(skuStockDisplay({ level: 'SOLD_OUT', availableQty: 0 }, 'EXACT', false), {
    tone: 'SOLD_OUT', qty: null, prefix: '', word: '已售罄',
  })
  assert.deepEqual(skuStockDisplay({ level: 'ENOUGH', availableQty: 18 }, 'EXACT', true), {
    tone: 'OFF_SALE', qty: null, prefix: '', word: '已下架',
  })
  assert.deepEqual(skuStockDisplay({ level: 'LOW' }, 'LEVEL', false), {
    tone: 'LOW', qty: null, prefix: '', word: '库存紧张',
  })
  assert.deepEqual(skuStockDisplay({ level: 'ENOUGH', availableQty: null }, 'EXACT', false), {
    tone: 'ENOUGH', qty: null, prefix: '', word: '现货充足',
  })
})

test('底部按钮：可买时返回空，售罄和下架给出咨询文案', () => {
  assert.equal(mainActionLabel({ stockLevel: 'ENOUGH', offSale: false }), '')
  assert.equal(mainActionLabel({ stockLevel: 'SOLD_OUT', offSale: false }), '已售罄 · 咨询补货')
  assert.equal(mainActionLabel({ stockLevel: 'ENOUGH', offSale: true }), '已下架 · 咨询客服')
})
