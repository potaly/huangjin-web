import type { DB, MallUser, Product, Sku } from '../lib/types'

/** 构造一个所有表为空的内存库，供纯函数测试使用 */
export function emptyDB(): DB {
  return {
    schemaVersion: 1,
    seq: {},
    sysAdmin: [],
    sysConfig: [],
    sysOperationLog: [],
    goldMaterial: [],
    category: [],
    product: [],
    productSku: [],
    stockLog: [],
    notice: [],
    banner: [],
    mallUser: [],
    order: [],
  }
}

let uid = 9000

/** 直接往库里塞一个用户（绕过校验，用于准备测试数据） */
export function addUser(db: DB, partial: Partial<MallUser> & Pick<MallUser, 'phone' | 'role'>): MallUser {
  const ts = new Date().toISOString()
  const user: MallUser = {
    id: ++uid,
    createdAt: ts,
    updatedAt: ts,
    name: partial.name ?? `用户${uid}`,
    salesId: null,
    openid: null,
    status: 1,
    ...partial,
  }
  db.mallUser.push(user)
  return user
}

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
