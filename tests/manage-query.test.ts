import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addProduct, emptyDB } from './helpers'
import {
  filterProducts, productDetail, productOptions, productRow, stockRows, stockSummary,
} from '../lib/manage-query'

test('filterProducts：按关键词和状态筛选，排除已删除，按 sort 升序', () => {
  const db = emptyDB()
  const a = addProduct(db, { name: '古法手链', status: 1 }).product
  const b = addProduct(db, { name: '素圈戒指', status: 0 }).product
  const c = addProduct(db, { name: '已删手链', status: 1 }).product
  c.deleted = true
  a.sort = 2
  b.sort = 1
  assert.deepEqual(filterProducts(db, {}).map((p) => p.id), [b.id, a.id])
  assert.deepEqual(filterProducts(db, { keyword: '手链' }).map((p) => p.id), [a.id])
  assert.deepEqual(filterProducts(db, { keyword: a.styleNo.toLowerCase() }).map((p) => p.id), [a.id])
  assert.deepEqual(filterProducts(db, { status: 0 }).map((p) => p.id), [b.id])
})

test('filterProducts：一级分类包含其二级分类的商品', () => {
  const db = emptyDB()
  const { product } = addProduct(db)
  product.categoryId = 11
  db.category.push({ id: 10, parentId: 0, name: '手链', sort: 0, status: 1, createdAt: '', updatedAt: '' })
  db.category.push({ id: 11, parentId: 10, name: '古法', sort: 0, status: 1, createdAt: '', updatedAt: '' })
  assert.equal(filterProducts(db, { categoryId: 10 }).length, 1)
  assert.equal(filterProducts(db, { categoryId: 11 }).length, 1)
  assert.equal(filterProducts(db, { categoryId: 12 }).length, 0)
})

test('productRow：汇总 SKU 克重和分类材质名', () => {
  const db = emptyDB()
  const { product } = addProduct(db, { refWeight: 5, stockQty: 2 })
  db.category.push({ id: 1, parentId: 0, name: '手链', sort: 0, status: 1, createdAt: '', updatedAt: '' })
  db.goldMaterial.push({ id: 1, code: 'AU999', name: '足金', sort: 0, status: 1, createdAt: '', updatedAt: '' })
  const row = productRow(db, product)
  assert.equal(row.skuCount, 1)
  assert.equal(row.stockWeight, 10)
  assert.equal(row.availableWeight, 10)
  assert.equal(row.categoryName, '手链')
  assert.equal(row.materialName, '足金')
})

test('productDetail：不存在时报错，存在时带 SKU', () => {
  const db = emptyDB()
  assert.throws(() => productDetail(db, 1), /商品不存在/)
  const { product, sku } = addProduct(db, { refWeight: 5, stockQty: 2 })
  const detail = productDetail(db, product.id)
  assert.equal(detail.skus.length, 1)
  assert.equal(detail.skus[0].id, sku.id)
  assert.equal(detail.skus[0].availableWeight, 10)
})

test('productOptions：一级在前二级紧随，含停用项', () => {
  const db = emptyDB()
  db.category.push({ id: 10, parentId: 0, name: '手链', sort: 0, status: 1, createdAt: '', updatedAt: '' })
  db.category.push({ id: 11, parentId: 10, name: '古法', sort: 0, status: 0, createdAt: '', updatedAt: '' })
  db.category.push({ id: 20, parentId: 0, name: '戒指', sort: 1, status: 1, createdAt: '', updatedAt: '' })
  db.goldMaterial.push({ id: 1, code: 'AU999', name: '足金', purity: '999', sort: 0, status: 1, createdAt: '', updatedAt: '' })
  const options = productOptions(db)
  assert.deepEqual(options.categories, [
    { id: 10, label: '手链', status: 1 },
    { id: 11, label: '手链 / 古法', status: 0 },
    { id: 20, label: '戒指', status: 1 },
  ])
  assert.deepEqual(options.materials, [{ id: 1, name: '足金', purity: '999', status: 1 }])
})

test('stockRows 和 stockSummary：关键词、预警筛选和汇总', () => {
  const db = emptyDB()
  const a = addProduct(db, { name: '手链', refWeight: 5, stockQty: 2 })
  const b = addProduct(db, { name: '戒指', refWeight: 1, stockQty: 1 })
  b.sku.warnWeight = 5
  a.sku.lockedWeight = 1
  const all = stockRows(db, {})
  assert.equal(all.length, 2)
  assert.equal(stockRows(db, { keyword: '戒指' }).length, 1)
  assert.deepEqual(stockRows(db, { onlyWarn: true }).map((r) => r.id), [b.sku.id])
  const summary = stockSummary(all)
  assert.equal(summary.skuCount, 2)
  assert.equal(summary.stockWeight, 11)
  assert.equal(summary.lockedWeight, 1)
  assert.equal(summary.availableWeight, 10)
  assert.equal(summary.warnCount, 1)
})
