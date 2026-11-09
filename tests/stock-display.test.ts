import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addProduct, emptyDB } from './helpers'
import { productDetail, productCard } from '../lib/mall'
import { mallProductStockLevel, mallStockLevelOf, stockLevelOf } from '../lib/stock'
import { mainActionLabel, productStockDisplay, skuStockDisplay } from '../lib/stock-display'

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

const product = (over: Partial<Parameters<typeof productStockDisplay>[0]> = {}) => ({
  stockLevel: 'ENOUGH' as const,
  stockDisplayMode: 'EXACT' as const,
  offSale: false,
  skus: [
    { level: 'ENOUGH' as const, availableQty: 18 },
    { level: 'LOW' as const, availableQty: 2 },
  ],
  ...over,
})

test('总件数：汇总各规格，偏低用「仅剩」', () => {
  assert.deepEqual(productStockDisplay(product()), {
    tone: 'ENOUGH', qty: 20, prefix: '共', word: '',
  })
  assert.deepEqual(
    productStockDisplay(product({ stockLevel: 'LOW', skus: [{ level: 'LOW', availableQty: 3 }] })),
    { tone: 'LOW', qty: 3, prefix: '仅剩', word: '' },
  )
})

test('总件数：任一规格无法换算时退回等级文字', () => {
  const d = productStockDisplay(
    product({ skus: [{ level: 'ENOUGH', availableQty: 18 }, { level: 'ENOUGH', availableQty: null }] }),
  )
  assert.deepEqual(d, { tone: 'ENOUGH', qty: null, prefix: '', word: '现货充足' })
})

test('总件数：售罄、下架、等级模式、没有规格', () => {
  assert.equal(
    productStockDisplay(product({ stockLevel: 'SOLD_OUT', skus: [{ level: 'SOLD_OUT', availableQty: 0 }] })).word,
    '已售罄，可咨询补货',
  )
  assert.deepEqual(productStockDisplay(product({ offSale: true })), {
    tone: 'OFF_SALE', qty: null, prefix: '', word: '该商品已下架',
  })
  const level = productStockDisplay(product({ stockDisplayMode: 'LEVEL', skus: [{ level: 'ENOUGH' }] }))
  assert.deepEqual(level, { tone: 'ENOUGH', qty: null, prefix: '', word: '现货充足' })
  assert.equal(productStockDisplay(product({ stockLevel: 'SOLD_OUT', skus: [] })).tone, 'SOLD_OUT')
})

test('底部按钮：可买时返回空，售罄和下架给出咨询文案', () => {
  assert.equal(mainActionLabel(product()), '')
  assert.equal(mainActionLabel(product({ stockLevel: 'SOLD_OUT' })), '已售罄 · 咨询补货')
  assert.equal(mainActionLabel(product({ offSale: true })), '已下架 · 咨询客服')
})
