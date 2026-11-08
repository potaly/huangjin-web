import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addProduct, emptyDB } from './helpers'
import {
  createBanner, createCategory, createMaterial, createNotice, deleteBanner, deleteCategory,
  deleteMaterial, deleteNotice, updateBanner, updateCategory, updateMaterial, updateNotice,
} from '../lib/content-service'
import type { AdminSession } from '../lib/types'

const actor: AdminSession = { id: 1, username: 'mall:1', realName: '张三（小程序）', roleCode: 'OPERATOR', exp: 0 }

// ── 分类 ──
test('createCategory：同级重名被拒绝，不同上级下可重名', () => {
  const db = emptyDB()
  const a = createCategory(db, { name: '戒指' }, actor)
  const b = createCategory(db, { name: '手镯' }, actor)
  assert.throws(() => createCategory(db, { name: '戒指' }, actor), /同级下已存在同名分类/)
  createCategory(db, { name: '素圈', parentId: a.id }, actor)
  createCategory(db, { name: '素圈', parentId: b.id }, actor)
})

test('createCategory：上级不存在被拒绝', () => {
  assert.throws(() => createCategory(emptyDB(), { name: 'x', parentId: 999 }, actor), /上级分类不存在/)
})

test('createCategory：最多两级', () => {
  const db = emptyDB()
  const p = createCategory(db, { name: '一级' }, actor)
  const c = createCategory(db, { name: '二级', parentId: p.id }, actor)
  assert.throws(() => createCategory(db, { name: '三级', parentId: c.id }, actor), /分类最多两级/)
})

test('updateCategory：改名同级重名被拒绝', () => {
  const db = emptyDB()
  createCategory(db, { name: '戒指' }, actor)
  const b = createCategory(db, { name: '手镯' }, actor)
  assert.throws(() => updateCategory(db, b.id, { name: '戒指' }, actor), /同级下已存在同名分类/)
  assert.equal(updateCategory(db, b.id, { name: '手镯' }, actor).name, '手镯')
})

test('updateCategory：停用一级同步停用二级', () => {
  const db = emptyDB()
  const p = createCategory(db, { name: '一级' }, actor)
  const c = createCategory(db, { name: '二级', parentId: p.id }, actor)
  updateCategory(db, p.id, { status: 0 }, actor)
  assert.equal(c.status, 0)
})

test('deleteCategory：有子分类不能删除', () => {
  const db = emptyDB()
  const p = createCategory(db, { name: '一级' }, actor)
  createCategory(db, { name: '二级', parentId: p.id }, actor)
  assert.throws(() => deleteCategory(db, p.id), /1 个二级分类/)
})

test('deleteCategory：有商品不能删除，空分类可删', () => {
  const db = emptyDB()
  const c = createCategory(db, { name: '戒指' }, actor)
  const { product } = addProduct(db)
  product.categoryId = c.id
  assert.throws(() => deleteCategory(db, c.id), /1 个商品/)
  product.deleted = true
  deleteCategory(db, c.id)
  assert.equal(c.deleted, true)
})

// ── 材质 ──
test('createMaterial：编码转大写且唯一', () => {
  const db = emptyDB()
  const m = createMaterial(db, { code: 'au999', name: '足金999' }, actor)
  assert.equal(m.code, 'AU999')
  assert.throws(() => createMaterial(db, { code: 'Au999', name: '重复' }, actor), /AU999 已存在/)
})

test('updateMaterial：改编码转大写并检查唯一', () => {
  const db = emptyDB()
  createMaterial(db, { code: 'AU999', name: 'a' }, actor)
  const b = createMaterial(db, { code: 'AU9999', name: 'b' }, actor)
  assert.throws(() => updateMaterial(db, b.id, { code: 'au999' }, actor), /AU999 已存在/)
  assert.equal(updateMaterial(db, b.id, { code: 'pt950' }, actor).code, 'PT950')
})

test('deleteMaterial：被商品使用不能删除', () => {
  const db = emptyDB()
  const m = createMaterial(db, { code: 'AU999', name: 'a' }, actor)
  const { product } = addProduct(db)
  product.materialId = m.id
  assert.throws(() => deleteMaterial(db, m.id, actor), /1 个商品使用/)
  product.deleted = true
  deleteMaterial(db, m.id, actor)
  assert.equal(m.deleted, true)
})

// ── 公告 ──
test('createNotice：正文经过 sanitizeHtml', () => {
  const db = emptyDB()
  const n = createNotice(db, { title: 't', contentHtml: '<p>hi</p><script>alert(1)</script>' }, actor)
  assert.ok(!/<script/i.test(n.contentHtml ?? ''))
  assert.match(n.contentHtml ?? '', /hi/)
})

test('createNotice：发布未指定生效时间补 publishAt，草稿不补，指定则保留', () => {
  const db = emptyDB()
  const pub = createNotice(db, { title: 'a', status: 1 }, actor)
  assert.ok(pub.publishAt)
  assert.equal(createNotice(db, { title: 'b', status: 0 }, actor).publishAt, undefined)
  const fixed = createNotice(db, { title: 'c', status: 1, publishAt: '2030-01-01T00:00:00.000Z' }, actor)
  assert.equal(fixed.publishAt, '2030-01-01T00:00:00.000Z')
})

test('updateNotice：改为发布且无 publishAt 时补，且正文被净化', () => {
  const db = emptyDB()
  const n = createNotice(db, { title: 'a', status: 0 }, actor)
  updateNotice(db, n.id, { status: 1, contentHtml: '<img src=x onerror=alert(1)>' }, actor)
  assert.ok(n.publishAt)
  assert.ok(!/onerror/i.test(n.contentHtml ?? ''))
})

test('updateNotice：草稿改发布且 publishAt 为空串时补当前时间', () => {
  const db = emptyDB()
  const n = createNotice(db, { title: 'a', status: 0 }, actor)
  updateNotice(db, n.id, { status: 1, publishAt: '' }, actor)
  assert.ok(n.publishAt)
})

test('updateNotice：已发布公告清空生效时间后仍有 publishAt', () => {
  const db = emptyDB()
  const n = createNotice(db, { title: 'a', status: 1, publishAt: '2030-01-01T00:00:00.000Z' }, actor)
  updateNotice(db, n.id, { publishAt: '' }, actor)
  assert.ok(n.publishAt)
  assert.notEqual(n.publishAt, '2030-01-01T00:00:00.000Z')
})

test('deleteNotice / updateNotice：不存在报错', () => {
  const db = emptyDB()
  assert.throws(() => updateNotice(db, 1, {}, actor), /公告不存在/)
  assert.throws(() => deleteNotice(db, 1), /公告不存在/)
})

// ── 轮播图 ──
test('createBanner：外链必须 http(s)', () => {
  const db = emptyDB()
  assert.throws(() => createBanner(db, { image: '/a.jpg', linkType: 'URL', linkValue: 'ftp://x' }, actor), /http/)
  createBanner(db, { image: '/a.jpg', linkType: 'URL', linkValue: 'https://x.com' }, actor)
})

test('createBanner：商品 / 公告跳转必须是数字 ID', () => {
  const db = emptyDB()
  assert.throws(() => createBanner(db, { image: '/a.jpg', linkType: 'PRODUCT', linkValue: 'abc' }, actor), /ID/)
  assert.throws(() => createBanner(db, { image: '/a.jpg', linkType: 'NOTICE', linkValue: '1a' }, actor), /ID/)
  createBanner(db, { image: '/a.jpg', linkType: 'PRODUCT', linkValue: '12' }, actor)
})

test('createBanner：非 NONE 必须有目标，NONE 无需', () => {
  const db = emptyDB()
  assert.throws(() => createBanner(db, { image: '/a.jpg', linkType: 'URL' }, actor), /请填写跳转目标/)
  createBanner(db, { image: '/a.jpg' }, actor)
})

test('updateBanner：同样校验外链 / 数字 ID / 目标', () => {
  const db = emptyDB()
  const b = createBanner(db, { image: '/a.jpg' }, actor)
  assert.throws(() => updateBanner(db, b.id, { linkType: 'URL' }, actor), /请填写跳转目标/)
  assert.throws(() => updateBanner(db, b.id, { linkType: 'URL', linkValue: 'x.com' }, actor), /http/)
  assert.throws(() => updateBanner(db, b.id, { linkType: 'PRODUCT', linkValue: 'abc' }, actor), /ID/)
  updateBanner(db, b.id, { linkType: 'PRODUCT', linkValue: '5' }, actor)
  assert.equal(b.linkValue, '5')
})

test('deleteBanner：软删除，不存在报错', () => {
  const db = emptyDB()
  const b = createBanner(db, { image: '/a.jpg' }, actor)
  deleteBanner(db, b.id)
  assert.equal(b.deleted, true)
  assert.throws(() => deleteBanner(db, b.id), /轮播图不存在/)
})
