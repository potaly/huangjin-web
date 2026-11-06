import type { DB, MallUser } from '../lib/types'

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
