# 下单闭环 · 第一批：登录与用户 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 白名单手机号登录（小程序可绑定微信一键登录）、按角色区分的小程序「我的」与老板端用户管理、可开关的全站登录门槛。

**Architecture:** 在现有 Next.js + Redis 单文档存储上新增 `mallUser` 表；纯函数服务层（`lib/mall-user-service.ts`、`lib/mall-token.ts`）放业务规则并用 `tsx --test` 测试；路由层只做鉴权、入参与 `mutate()` 包装。小程序新增登录页、「我的」、用户管理三组页面；H5 只加登录页。

**Tech Stack:** Next.js 14 Route Handlers、TypeScript、Upstash Redis（`lib/store.ts`）、Node 内置 `node:test`（经 `tsx --test` 运行）、原生微信小程序（WXML/WXSS/JS）。

设计文档：`docs/superpowers/specs/2026-11-06-order-flow-design.md`。第二批（选购清单与下单）、第三批（管理端订单）各自另写计划。

**约定：**
- 所有命令在 `huangjin-web/` 下执行，除非写明在 `xiaojing-mp/`。
- `xiaojing-mp/` 不是 git 仓库，只改文件不提交。
- 提交信息不要附加任何 Claude 署名 trailer（用户全局规则）。

---

## 文件结构

后端（`huangjin-web/`）：

| 文件 | 职责 |
|---|---|
| `lib/sign.ts`（新） | HMAC 签名令牌的通用签发/校验，按 purpose 隔离 |
| `lib/auth.ts`（改） | 后台会话改用 `lib/sign.ts` |
| `lib/types.ts`（改） | `MallRole`、`MallUser`、`MallSession`，`DB.mallUser` |
| `lib/store.ts`（改） | `migrate()` 补 `mallUser` |
| `lib/seed.ts`（改） | 种子 `mallUser: []`、参数 `mall.login.required` |
| `lib/mall-token.ts`（新） | 前台会话令牌与微信绑定凭证 |
| `lib/mall-user-service.ts`（新） | 手机号规范化、登录、增改查、视图 |
| `lib/rate-limit.ts`（新） | 内存滑动计数限流 |
| `lib/wechat.ts`（新） | `jscode2session` 换 openid |
| `lib/mall-auth.ts`（新） | 从请求头取会话、登录门槛、角色校验 |
| `app/api/mall/auth/{wx-login,phone-login,me}/route.ts`（新） | 登录接口 |
| `app/api/mall/manage/users/route.ts`、`[id]/route.ts`（新） | 用户管理接口 |
| `app/api/mall/{home,categories,materials,products,products/[id],notices,notices/[id]}/route.ts`（改） | 加登录门槛 |
| `app/admin/(panel)/configs/page.tsx`（改） | 后台可切换登录门槛 |
| `lib/client.ts`（改）、`app/login/page.tsx`（新） | H5 携带令牌、401 跳登录、手机号登录页 |
| `scripts/seed-demo-users.ts`（新） | 演示用户 |
| `tests/helpers.ts`、`tests/*.test.ts`（新） | 单元测试 |

小程序（`xiaojing-mp/`）：`config/index.js`（改）、`utils/request.js`（改）、`utils/auth.js`（新）、`pages/login/*`（新）、`pages/mine/*`（新）、`pages/manage-users/*`（新）、`pages/manage-user-edit/*`（新）、`app.json`（改）。

---

### Task 1: 测试脚手架

**Files:**
- Modify: `package.json`
- Create: `tests/helpers.ts`
- Create: `tests/smoke.test.ts`

- [ ] **Step 1: 加 test 脚本**

在 `package.json` 的 `"scripts"` 中 `"typecheck"` 下一行加入：

```json
    "test": "tsx --test \"tests/**/*.test.ts\"",
```

- [ ] **Step 2: 写测试辅助**

`tests/helpers.ts`：

```ts
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
```

- [ ] **Step 3: 冒烟测试**

`tests/smoke.test.ts`：

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyDB } from './helpers'

test('emptyDB 有 mallUser 表', () => {
  assert.deepEqual(emptyDB().mallUser, [])
})
```

- [ ] **Step 4: 运行，确认因类型缺失而失败**

Run: `npm test`
Expected: 运行时通过（tsx 不做类型检查），但 `npm run typecheck` 报 `'mallUser' does not exist in type 'DB'`、`Cannot find name 'MallUser'`。这两个错误由 Task 3 修复，此处先不提交。

---

### Task 2: 通用签名令牌 `lib/sign.ts`

**Files:**
- Create: `lib/sign.ts`
- Modify: `lib/auth.ts`（`b64url` / `fromB64url` / `sign` / `createToken` / `parseToken` 一段）
- Test: `tests/sign.test.ts`

- [ ] **Step 1: 写失败的测试**

`tests/sign.test.ts`：

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signToken, verifyToken } from '../lib/sign'

test('签发后可校验并取回载荷', () => {
  const t = signToken({ uid: 1, exp: Date.now() + 60_000 }, 'mall')
  assert.equal(verifyToken<{ uid: number; exp: number }>(t, 'mall')?.uid, 1)
})

test('purpose 不同则校验失败', () => {
  const t = signToken({ uid: 1, exp: Date.now() + 60_000 }, 'mall')
  assert.equal(verifyToken(t, 'wxbind'), null)
  assert.equal(verifyToken(t), null)
})

test('篡改载荷校验失败', () => {
  const t = signToken({ uid: 1, exp: Date.now() + 60_000 }, 'mall')
  const [, mac] = t.split('.')
  const forged = Buffer.from(JSON.stringify({ uid: 2, exp: Date.now() + 60_000 })).toString('base64url')
  assert.equal(verifyToken(`${forged}.${mac}`, 'mall'), null)
})

test('过期令牌校验失败', () => {
  const t = signToken({ uid: 1, exp: Date.now() - 1 }, 'mall')
  assert.equal(verifyToken(t, 'mall'), null)
})

test('空值与格式错误返回 null', () => {
  assert.equal(verifyToken(undefined), null)
  assert.equal(verifyToken('abc'), null)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx tsx --test tests/sign.test.ts`
Expected: FAIL，`Cannot find module '../lib/sign'`

- [ ] **Step 3: 实现**

`lib/sign.ts`：

```ts
// HMAC-SHA256 签名令牌：<base64url(JSON载荷)>.<base64url(签名)>
// purpose 参与签名，用于隔离后台会话、前台会话、微信绑定凭证，防止互相冒用。
// 后台会话 purpose 为空串，与历史令牌格式兼容。

import crypto from 'crypto'

function secret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    // 仅用于未配置密钥的本地 / 预览环境，生产必须设置 ADMIN_SESSION_SECRET
    'huangjin-dev-insecure-secret'
  )
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function mac(body: string, purpose: string): string {
  const input = purpose ? `${purpose}.${body}` : body
  return b64url(crypto.createHmac('sha256', secret()).update(input).digest())
}

export function signToken<T extends { exp: number }>(payload: T, purpose = ''): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  return `${body}.${mac(body, purpose)}`
}

export function verifyToken<T extends { exp: number }>(
  token: string | undefined | null,
  purpose = '',
): T | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const a = Buffer.from(sig)
  const b = Buffer.from(mac(body, purpose))
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as T
    if (!payload?.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}
```

- [ ] **Step 4: `lib/auth.ts` 改用 `lib/sign.ts`**

删除 `lib/auth.ts` 中 `function secret()`、`// ── 会话令牌 ──` 下的 `b64url`、`fromB64url`、`sign`、`createToken`、`parseToken` 整段，替换为：

```ts
// ── 会话令牌 ────────────────────────────────────────────────────

export function createToken(session: Omit<AdminSession, 'exp'>): string {
  return signToken<AdminSession>({ ...session, exp: Date.now() + SESSION_TTL_MS })
}

export function parseToken(token: string | undefined | null): AdminSession | null {
  return verifyToken<AdminSession>(token)
}
```

并在文件顶部 import 区加入：

```ts
import { signToken, verifyToken } from './sign'
```

`hashPassword` / `verifyPassword` 仍使用 `crypto`，保留 `import crypto from 'crypto'`。

- [ ] **Step 5: 运行测试**

Run: `npx tsx --test tests/sign.test.ts`
Expected: 5 个用例 PASS

- [ ] **Step 6: 提交**（typecheck 仍因 Task 1 的 `mallUser` 报错，Task 3 修复后统一检查）

```bash
git add lib/sign.ts lib/auth.ts tests/sign.test.ts
git commit -m "refactor: 抽出通用签名令牌 lib/sign.ts，后台会话改用它"
```

---

### Task 3: 数据模型与迁移

**Files:**
- Modify: `lib/types.ts`（`StockLevel` 之前、`DB` 接口）
- Modify: `lib/store.ts`（`migrate()`）
- Modify: `lib/seed.ts`（`configDefs`、`return`）

- [ ] **Step 1: 加类型**

在 `lib/types.ts` 的 `/** 整库文档 */` 注释之前插入：

```ts
/** 前台用户角色：老板 / 业务员 / 客户 */
export type MallRole = 'OWNER' | 'SALES' | 'CUSTOMER'

export const MALL_ROLE_LABEL: Record<MallRole, string> = {
  OWNER: '老板',
  SALES: '业务员',
  CUSTOMER: '客户',
}

/** mall_user 前台用户（白名单手机号） */
export interface MallUser extends BaseEntity {
  /** 11 位手机号，未删除范围内唯一 */
  phone: string
  name: string
  role: MallRole
  /** 仅客户：绑定的业务员 MallUser.id */
  salesId?: number | null
  /** 绑定的微信 openid，唯一 */
  openid?: string | null
  /** 0 停用 / 1 启用 */
  status: 0 | 1
  lastLoginAt?: string
}

/** 前台会话载荷 */
export interface MallSession {
  uid: number
  role: MallRole
  exp: number
}
```

在 `DB` 接口的 `banner: Banner[]` 下一行加：

```ts
  mallUser: MallUser[]
```

- [ ] **Step 2: 迁移**

`lib/store.ts` 的 `migrate()` 中 `db.banner ??= []` 下一行加：

```ts
  db.mallUser ??= []
```

- [ ] **Step 3: 种子**

`lib/seed.ts` 的 `configDefs` 数组中 `['site.demo.label', ...]` 下一行加：

```ts
    ['mall.login.required', 'false', '前台是否必须登录后才能浏览（true / false）'],
```

`buildSeedDB()` 的 `return` 对象中 `banner,` 下一行加：

```ts
    mallUser: [],
```

- [ ] **Step 4: 类型检查与测试**

Run: `npm run typecheck && npm test`
Expected: typecheck 无输出；测试全部 PASS（smoke + sign）

- [ ] **Step 5: 提交**

```bash
git add package.json tests/helpers.ts tests/smoke.test.ts lib/types.ts lib/store.ts lib/seed.ts
git commit -m "feat: 新增前台用户表 mallUser 与登录门槛参数，接入 tsx --test"
```

---

### Task 4: 前台令牌 `lib/mall-token.ts`

**Files:**
- Create: `lib/mall-token.ts`
- Test: `tests/mall-token.test.ts`

- [ ] **Step 1: 写失败的测试**

`tests/mall-token.test.ts`：

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBindTicket, createMallToken, parseBindTicket, parseMallToken } from '../lib/mall-token'
import { createToken } from '../lib/auth'

test('前台令牌往返', () => {
  const s = parseMallToken(createMallToken(7, 'CUSTOMER'))
  assert.equal(s?.uid, 7)
  assert.equal(s?.role, 'CUSTOMER')
  assert.ok(s!.exp > Date.now() + 29 * 24 * 3600 * 1000)
})

test('后台令牌不能当前台令牌用', () => {
  const admin = createToken({ id: 1, username: 'admin', realName: 'a', roleCode: 'SUPER' })
  assert.equal(parseMallToken(admin), null)
})

test('绑定凭证往返，且不能当登录令牌', () => {
  const t = createBindTicket('openid-x')
  assert.equal(parseBindTicket(t), 'openid-x')
  assert.equal(parseMallToken(t), null)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx tsx --test tests/mall-token.test.ts`
Expected: FAIL，`Cannot find module '../lib/mall-token'`

- [ ] **Step 3: 实现**

`lib/mall-token.ts`：

```ts
// 前台会话令牌（30 天）与微信绑定凭证（10 分钟）
import { signToken, verifyToken } from './sign'
import type { MallRole, MallSession } from './types'

export const MALL_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
const BIND_TTL_MS = 10 * 60 * 1000

export function createMallToken(uid: number, role: MallRole): string {
  return signToken<MallSession>({ uid, role, exp: Date.now() + MALL_TOKEN_TTL_MS }, 'mall')
}

export function parseMallToken(token: string | undefined | null): MallSession | null {
  return verifyToken<MallSession>(token, 'mall')
}

/** 微信 openid 尚未绑定手机号时签发，手机号登录时凭它完成绑定 */
export function createBindTicket(openid: string): string {
  return signToken({ openid, exp: Date.now() + BIND_TTL_MS }, 'wxbind')
}

export function parseBindTicket(ticket: string | undefined | null): string | null {
  return verifyToken<{ openid: string; exp: number }>(ticket, 'wxbind')?.openid ?? null
}
```

- [ ] **Step 4: 运行测试**

Run: `npx tsx --test tests/mall-token.test.ts`
Expected: 3 个用例 PASS

- [ ] **Step 5: 提交**

```bash
git add lib/mall-token.ts tests/mall-token.test.ts
git commit -m "feat: 前台会话令牌与微信绑定凭证"
```

---

### Task 5: 用户服务 `lib/mall-user-service.ts`

**Files:**
- Create: `lib/mall-user-service.ts`
- Test: `tests/mall-user-service.test.ts`

- [ ] **Step 1: 写失败的测试**

`tests/mall-user-service.test.ts`：

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addUser, emptyDB } from './helpers'
import {
  createUser, listUsers, loginByOpenid, loginByPhone, normalizePhone, updateUser, userView,
} from '../lib/mall-user-service'
import { BizError } from '../lib/api'

test('手机号规范化', () => {
  assert.equal(normalizePhone(' 138-0000 0001 '), '13800000001')
  assert.throws(() => normalizePhone('12345'), BizError)
})

test('白名单外手机号不能登录', () => {
  const db = emptyDB()
  assert.throws(() => loginByPhone(db, '13800000001'), /未开通/)
})

test('停用用户不能登录', () => {
  const db = emptyDB()
  addUser(db, { phone: '13800000001', role: 'CUSTOMER', status: 0 })
  assert.throws(() => loginByPhone(db, '13800000001'), /已停用/)
})

test('手机号登录并绑定 openid，openid 从旧用户转移', () => {
  const db = emptyDB()
  const a = addUser(db, { phone: '13800000001', role: 'CUSTOMER', openid: 'wx1' })
  const b = addUser(db, { phone: '13800000002', role: 'CUSTOMER' })
  const u = loginByPhone(db, '13800000002', 'wx1')
  assert.equal(u.id, b.id)
  assert.equal(b.openid, 'wx1')
  assert.equal(a.openid, null)
  assert.ok(b.lastLoginAt)
})

test('openid 登录只认启用用户', () => {
  const db = emptyDB()
  const a = addUser(db, { phone: '13800000001', role: 'CUSTOMER', openid: 'wx1' })
  assert.equal(loginByOpenid(db, 'wx1')?.id, a.id)
  a.status = 0
  assert.equal(loginByOpenid(db, 'wx1'), null)
  assert.equal(loginByOpenid(db, 'nobody'), null)
})

test('新增用户：手机号唯一、客户只能绑业务员', () => {
  const db = emptyDB()
  const owner = addUser(db, { phone: '13800000000', role: 'OWNER' })
  const sales = addUser(db, { phone: '13800000011', role: 'SALES' })
  const c = createUser(db, owner, { phone: '13800000021', name: '客户甲', role: 'CUSTOMER', salesId: sales.id })
  assert.equal(c.salesId, sales.id)
  assert.throws(() => createUser(db, owner, { phone: '13800000021', name: '重复', role: 'CUSTOMER' }), /已存在/)
  assert.throws(
    () => createUser(db, owner, { phone: '13800000022', name: 'x', role: 'CUSTOMER', salesId: owner.id }),
    /业务员/,
  )
})

test('只有老板能新增和修改用户', () => {
  const db = emptyDB()
  const sales = addUser(db, { phone: '13800000011', role: 'SALES' })
  assert.throws(() => createUser(db, sales, { phone: '13800000021', name: 'x', role: 'CUSTOMER' }), /权限/)
})

test('老板不能停用自己或改自己角色；业务员名下有客户时不能改角色', () => {
  const db = emptyDB()
  const owner = addUser(db, { phone: '13800000000', role: 'OWNER' })
  const sales = addUser(db, { phone: '13800000011', role: 'SALES' })
  addUser(db, { phone: '13800000021', role: 'CUSTOMER', salesId: sales.id })
  assert.throws(() => updateUser(db, owner, owner.id, { status: 0 }), /自己/)
  assert.throws(() => updateUser(db, owner, owner.id, { role: 'SALES' }), /自己/)
  assert.throws(() => updateUser(db, owner, sales.id, { role: 'CUSTOMER' }), /名下还有 1 个客户/)
  const u = updateUser(db, owner, sales.id, { name: '小王' })
  assert.equal(u.name, '小王')
})

test('列表可见范围：老板全部，业务员只看自己的客户', () => {
  const db = emptyDB()
  const owner = addUser(db, { phone: '13800000000', role: 'OWNER' })
  const s1 = addUser(db, { phone: '13800000011', role: 'SALES' })
  const s2 = addUser(db, { phone: '13800000012', role: 'SALES' })
  addUser(db, { phone: '13800000021', role: 'CUSTOMER', salesId: s1.id })
  addUser(db, { phone: '13800000022', role: 'CUSTOMER', salesId: s2.id })
  assert.equal(listUsers(db, owner).length, 5)
  const mine = listUsers(db, s1)
  assert.equal(mine.length, 1)
  assert.equal(mine[0].phone, '13800000021')
  assert.equal(listUsers(db, owner, 'SALES').length, 2)
})

test('userView 带业务员姓名与角色名', () => {
  const db = emptyDB()
  const s = addUser(db, { phone: '13800000011', role: 'SALES', name: '小王' })
  const c = addUser(db, { phone: '13800000021', role: 'CUSTOMER', salesId: s.id, openid: 'wx' })
  const v = userView(db, c)
  assert.equal(v.salesName, '小王')
  assert.equal(v.roleLabel, '客户')
  assert.equal(v.wxBound, true)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx tsx --test tests/mall-user-service.test.ts`
Expected: FAIL，`Cannot find module '../lib/mall-user-service'`

- [ ] **Step 3: 实现**

`lib/mall-user-service.ts`：

```ts
// 前台用户（白名单）业务规则：纯函数，调用方负责放进 mutate() 事务
import { bad, forbidden, notFound } from './api'
import { nextId } from './store'
import { MALL_ROLE_LABEL, type DB, type MallRole, type MallUser } from './types'

const ROLES: MallRole[] = ['OWNER', 'SALES', 'CUSTOMER']

export function normalizePhone(raw: unknown): string {
  const phone = String(raw ?? '').replace(/[\s-]/g, '')
  if (!/^1\d{10}$/.test(phone)) throw bad('请输入 11 位手机号')
  return phone
}

const alive = (db: DB) => db.mallUser.filter((u) => !u.deleted)

export function findUser(db: DB, id: number): MallUser | undefined {
  return alive(db).find((u) => u.id === id)
}

/** 白名单手机号登录；带 openid 时把微信绑到该用户（从其他用户上解绑） */
export function loginByPhone(db: DB, rawPhone: string, openid?: string): MallUser {
  const phone = normalizePhone(rawPhone)
  const user = alive(db).find((u) => u.phone === phone)
  if (!user) throw bad('该手机号未开通，请联系店家')
  if (user.status !== 1) throw bad('账号已停用，请联系店家')
  const ts = new Date().toISOString()
  if (openid) {
    for (const other of db.mallUser) {
      if (other.id !== user.id && other.openid === openid) {
        other.openid = null
        other.updatedAt = ts
      }
    }
    user.openid = openid
  }
  user.lastLoginAt = ts
  user.updatedAt = ts
  return user
}

/** 微信一键登录：openid 已绑定启用用户时返回该用户，否则 null */
export function loginByOpenid(db: DB, openid: string): MallUser | null {
  const user = alive(db).find((u) => u.openid === openid && u.status === 1)
  if (!user) return null
  user.lastLoginAt = new Date().toISOString()
  return user
}

export interface UserInput {
  phone?: unknown
  name?: unknown
  role?: unknown
  salesId?: unknown
  status?: unknown
}

function checkRole(role: unknown): MallRole {
  if (!ROLES.includes(role as MallRole)) throw bad('角色不合法')
  return role as MallRole
}

function checkSales(db: DB, salesId: unknown): number | null {
  if (salesId === null || salesId === undefined || salesId === '' || salesId === 0) return null
  const s = findUser(db, Number(salesId))
  if (!s || s.role !== 'SALES') throw bad('绑定的必须是业务员')
  return s.id
}

function checkName(name: unknown): string {
  const v = String(name ?? '').trim()
  if (!v) throw bad('姓名不能为空')
  if (v.length > 20) throw bad('姓名不能超过 20 个字')
  return v
}

function requireOwner(actor: MallUser) {
  if (actor.role !== 'OWNER') throw forbidden('只有老板有用户管理权限')
}

export function createUser(db: DB, actor: MallUser, input: UserInput): MallUser {
  requireOwner(actor)
  const phone = normalizePhone(input.phone)
  if (alive(db).some((u) => u.phone === phone)) throw bad('该手机号已存在')
  const role = checkRole(input.role)
  const ts = new Date().toISOString()
  const user: MallUser = {
    id: nextId(db, 'mallUser'),
    createdAt: ts,
    updatedAt: ts,
    createdBy: actor.name,
    updatedBy: actor.name,
    phone,
    name: checkName(input.name),
    role,
    salesId: role === 'CUSTOMER' ? checkSales(db, input.salesId) : null,
    openid: null,
    status: Number(input.status) === 0 ? 0 : 1,
  }
  db.mallUser.push(user)
  return user
}

export function updateUser(db: DB, actor: MallUser, id: number, input: UserInput): MallUser {
  requireOwner(actor)
  const user = findUser(db, id)
  if (!user) throw notFound('用户不存在')
  const isSelf = user.id === actor.id

  if (input.phone !== undefined) {
    const phone = normalizePhone(input.phone)
    if (alive(db).some((u) => u.phone === phone && u.id !== id)) throw bad('该手机号已存在')
    user.phone = phone
  }
  if (input.name !== undefined) user.name = checkName(input.name)
  if (input.role !== undefined) {
    const role = checkRole(input.role)
    if (role !== user.role) {
      if (isSelf) throw bad('不能修改自己的角色')
      if (user.role === 'SALES') {
        const n = alive(db).filter((u) => u.salesId === user.id).length
        if (n > 0) throw bad(`该业务员名下还有 ${n} 个客户，请先改绑`)
      }
      user.role = role
    }
  }
  if (user.role === 'CUSTOMER') {
    if (input.salesId !== undefined) user.salesId = checkSales(db, input.salesId)
  } else {
    user.salesId = null
  }
  if (input.status !== undefined) {
    const status = Number(input.status) === 0 ? 0 : 1
    if (isSelf && status === 0) throw bad('不能停用自己')
    user.status = status
  }
  user.updatedAt = new Date().toISOString()
  user.updatedBy = actor.name
  return user
}

/** 老板看全部（可按角色筛），业务员只看自己的客户 */
export function listUsers(db: DB, actor: MallUser, role?: MallRole): MallUser[] {
  let list = alive(db)
  if (actor.role === 'SALES') list = list.filter((u) => u.role === 'CUSTOMER' && u.salesId === actor.id)
  else if (actor.role !== 'OWNER') return []
  if (role) list = list.filter((u) => u.role === role)
  return list.sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.id - b.id)
}

export function userView(db: DB, u: MallUser) {
  const sales = u.salesId ? findUser(db, u.salesId) : undefined
  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    role: u.role,
    roleLabel: MALL_ROLE_LABEL[u.role],
    salesId: u.salesId ?? null,
    salesName: sales?.name ?? '',
    salesPhone: sales?.phone ?? '',
    status: u.status,
    wxBound: Boolean(u.openid),
    lastLoginAt: u.lastLoginAt ?? '',
  }
}

export type MallUserView = ReturnType<typeof userView>
```

- [ ] **Step 4: 运行测试**

Run: `npx tsx --test tests/mall-user-service.test.ts`
Expected: 10 个用例 PASS

- [ ] **Step 5: 提交**

```bash
git add lib/mall-user-service.ts tests/mall-user-service.test.ts
git commit -m "feat: 前台用户服务（白名单登录、openid 绑定、增改查与可见范围）"
```

---

### Task 6: 限流与微信换 openid

**Files:**
- Create: `lib/rate-limit.ts`
- Create: `lib/wechat.ts`
- Test: `tests/rate-limit.test.ts`

- [ ] **Step 1: 写失败的测试**

`tests/rate-limit.test.ts`：

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hitLimit } from '../lib/rate-limit'

test('窗口内超过次数被限流，窗口过后恢复', () => {
  const key = `k-${Math.random()}`
  for (let i = 0; i < 3; i++) assert.equal(hitLimit(key, 3, 1000, 0), false)
  assert.equal(hitLimit(key, 3, 1000, 10), true)
  assert.equal(hitLimit(key, 3, 1000, 2000), false)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx tsx --test tests/rate-limit.test.ts`
Expected: FAIL，`Cannot find module '../lib/rate-limit'`

- [ ] **Step 3: 实现限流**

`lib/rate-limit.ts`：

```ts
// 单实例内存限流（演示用的尽力限制，Serverless 多实例间不共享）
const buckets = new Map<string, number[]>()

/** 记一次访问；返回 true 表示已超限，应拒绝 */
export function hitLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    buckets.set(key, recent)
    return true
  }
  recent.push(now)
  buckets.set(key, recent)
  return false
}
```

- [ ] **Step 4: 实现微信换 openid**

`lib/wechat.ts`：

```ts
// 小程序登录：用 wx.login 的 code 换 openid
// 需要环境变量 WX_APPID / WX_SECRET（在 Vercel 项目设置里配置，不入库）
export function wechatConfigured(): boolean {
  return Boolean(process.env.WX_APPID && process.env.WX_SECRET)
}

/** 成功返回 openid；未配置或微信返回错误时返回 null（前端改走手机号登录） */
export async function code2session(code: string): Promise<string | null> {
  if (!wechatConfigured()) return null
  const url =
    'https://api.weixin.qq.com/sns/jscode2session' +
    `?appid=${encodeURIComponent(process.env.WX_APPID!)}` +
    `&secret=${encodeURIComponent(process.env.WX_SECRET!)}` +
    `&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    const body = (await res.json()) as { openid?: string; errcode?: number; errmsg?: string }
    if (body.openid) return body.openid
    console.warn('[wechat] jscode2session failed', body.errcode, body.errmsg)
    return null
  } catch (e) {
    console.warn('[wechat] jscode2session error', e)
    return null
  }
}
```

- [ ] **Step 5: 运行测试**

Run: `npx tsx --test tests/rate-limit.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add lib/rate-limit.ts lib/wechat.ts tests/rate-limit.test.ts
git commit -m "feat: 内存限流与微信 jscode2session"
```

---

### Task 7: 请求鉴权 `lib/mall-auth.ts`

**Files:**
- Create: `lib/mall-auth.ts`
- Test: `tests/mall-auth.test.ts`

- [ ] **Step 1: 写失败的测试**（只测不依赖请求头的部分）

`tests/mall-auth.test.ts`：

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addUser, emptyDB } from './helpers'
import { loginRequired, resolveMallUser } from '../lib/mall-auth'

test('登录门槛按系统参数开关', () => {
  const db = emptyDB()
  assert.equal(loginRequired(db), false)
  db.sysConfig.push({ id: 1, createdAt: '', updatedAt: '', configKey: 'mall.login.required', configValue: 'true' })
  assert.equal(loginRequired(db), true)
})

test('resolveMallUser：会话有效且用户启用才返回，以库里最新角色为准', () => {
  const db = emptyDB()
  const u = addUser(db, { phone: '13800000001', role: 'SALES' })
  const session = { uid: u.id, role: 'CUSTOMER' as const, exp: Date.now() + 1000 }
  assert.equal(resolveMallUser(db, session)?.role, 'SALES')
  u.status = 0
  assert.equal(resolveMallUser(db, session), null)
  assert.equal(resolveMallUser(db, null), null)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx tsx --test tests/mall-auth.test.ts`
Expected: FAIL，`Cannot find module '../lib/mall-auth'`

- [ ] **Step 3: 实现**

`lib/mall-auth.ts`：

```ts
// 前台请求鉴权：Authorization: Bearer <mall token>
import { headers } from 'next/headers'
import { forbidden, unauthorized } from './api'
import { parseMallToken } from './mall-token'
import { findUser } from './mall-user-service'
import type { DB, MallRole, MallSession, MallUser } from './types'

export function loginRequired(db: DB): boolean {
  const c = db.sysConfig.find((x) => !x.deleted && x.configKey === 'mall.login.required')
  return c?.configValue === 'true'
}

export function currentMallSession(): MallSession | null {
  const auth = headers().get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  return parseMallToken(token)
}

/** 会话对应的用户必须存在且启用；角色以库中最新值为准（改角色、停用立即生效） */
export function resolveMallUser(db: DB, session: MallSession | null): MallUser | null {
  if (!session) return null
  const user = findUser(db, session.uid)
  return user && user.status === 1 ? user : null
}

export function requireMallUser(db: DB, roles?: MallRole[]): MallUser {
  const user = resolveMallUser(db, currentMallSession())
  if (!user) throw unauthorized('请先登录')
  if (roles && !roles.includes(user.role)) throw forbidden()
  return user
}

/** 商品类接口的门槛：开启登录要求时必须是已登录的启用用户 */
export function requireMallAccess(db: DB): void {
  if (loginRequired(db)) requireMallUser(db)
}
```

- [ ] **Step 4: 运行全部测试与类型检查**

Run: `npm test && npm run typecheck`
Expected: 全部 PASS，typecheck 无输出

- [ ] **Step 5: 提交**

```bash
git add lib/mall-auth.ts tests/mall-auth.test.ts
git commit -m "feat: 前台请求鉴权与登录门槛"
```

---

### Task 8: 登录接口

**Files:**
- Create: `app/api/mall/auth/wx-login/route.ts`
- Create: `app/api/mall/auth/phone-login/route.ts`
- Create: `app/api/mall/auth/me/route.ts`

- [ ] **Step 1: 微信一键登录**

`app/api/mall/auth/wx-login/route.ts`：

```ts
// POST /api/mall/auth/wx-login { code } — 已绑定则直接登录，否则返回绑定凭证让前端走手机号
import { bad, handle, ok, readJson } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { code2session } from '@/lib/wechat'
import { createBindTicket, createMallToken } from '@/lib/mall-token'
import { loginByOpenid, userView } from '@/lib/mall-user-service'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handle(async () => {
    const { code } = await readJson<{ code?: string }>(req)
    if (!code) throw bad('缺少登录 code')
    const openid = await code2session(code)
    if (!openid) return ok({ needPhone: true, bindTicket: null })

    const db = await loadDB()
    const bound = db.mallUser.some((u) => !u.deleted && u.status === 1 && u.openid === openid)
    if (!bound) return ok({ needPhone: true, bindTicket: createBindTicket(openid) })

    const result = await mutate((d) => {
      const user = loginByOpenid(d, openid)
      return user ? { token: createMallToken(user.id, user.role), user: userView(d, user) } : null
    })
    return ok(result ?? { needPhone: true, bindTicket: createBindTicket(openid) })
  })
}
```

- [ ] **Step 2: 手机号登录**

`app/api/mall/auth/phone-login/route.ts`：

```ts
// POST /api/mall/auth/phone-login { phone, bindTicket? }
import { headers } from 'next/headers'
import { BizError, bad, handle, ok, readJson } from '@/lib/api'
import { mutate } from '@/lib/store'
import { hitLimit } from '@/lib/rate-limit'
import { createMallToken, parseBindTicket } from '@/lib/mall-token'
import { loginByPhone, userView } from '@/lib/mall-user-service'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handle(async () => {
    const ip = (headers().get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
    if (hitLimit(`phone-login:${ip}`, 10, 60_000)) throw new BizError('尝试太频繁，请一分钟后再试', 429)

    const { phone, bindTicket } = await readJson<{ phone?: string; bindTicket?: string | null }>(req)
    let openid: string | undefined
    if (bindTicket) {
      openid = parseBindTicket(bindTicket) ?? undefined
      if (!openid) throw bad('微信绑定已过期，请重新打开小程序')
    }
    const result = await mutate((db) => {
      const user = loginByPhone(db, String(phone ?? ''), openid)
      return { token: createMallToken(user.id, user.role), user: userView(db, user) }
    })
    return ok(result)
  })
}
```

- [ ] **Step 3: 当前用户**

`app/api/mall/auth/me/route.ts`：

```ts
// GET /api/mall/auth/me — 当前登录用户（含绑定业务员）
import { handle, ok } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { userView } from '@/lib/mall-user-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const db = await loadDB()
    const user = requireMallUser(db)
    return ok(userView(db, user))
  })
}
```

- [ ] **Step 4: 类型检查**

Run: `npm run typecheck`
Expected: 无输出

- [ ] **Step 5: 本地接口冒烟**（走内存存储，不碰线上数据）

`next dev` 会自动加载 `.env.local` 里的 Redis 变量，所以先临时改名，冒烟结束后还原：

Run（终端 A）：`mv .env.local .env.local.bak && npx next dev -p 3311`

Run（终端 B）：

```bash
curl -s -X POST localhost:3311/api/mall/auth/phone-login -H 'content-type: application/json' -d '{"phone":"13800000001"}'
curl -s -X POST localhost:3311/api/mall/auth/wx-login -H 'content-type: application/json' -d '{"code":"x"}'
curl -s localhost:3311/api/mall/auth/me
```

Expected：
1. `{"code":400,"msg":"该手机号未开通，请联系店家","data":null}`
2. `{"code":0,...,"data":{"needPhone":true,"bindTicket":null}}`（本地未配 WX_SECRET）
3. `{"code":401,"msg":"请先登录","data":null}`

停掉 dev 服务，执行 `mv .env.local.bak .env.local` 还原。

- [ ] **Step 6: 提交**

```bash
git add app/api/mall/auth
git commit -m "feat: 前台登录接口（微信一键登录、手机号登录、当前用户）"
```

---

### Task 9: 用户管理接口

**Files:**
- Create: `app/api/mall/manage/users/route.ts`
- Create: `app/api/mall/manage/users/[id]/route.ts`

- [ ] **Step 1: 列表与新增**

`app/api/mall/manage/users/route.ts`：

```ts
// GET  /api/mall/manage/users?role=  老板看全部，业务员看自己的客户
// POST /api/mall/manage/users          仅老板
import { handle, ok, readJson } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { createUser, listUsers, userView, type UserInput } from '@/lib/mall-user-service'
import type { MallRole } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    const db = await loadDB()
    const actor = requireMallUser(db, ['OWNER', 'SALES'])
    const role = new URL(req.url).searchParams.get('role') as MallRole | null
    const valid = role && ['OWNER', 'SALES', 'CUSTOMER'].includes(role) ? role : undefined
    return ok(listUsers(db, actor, valid).map((u) => userView(db, u)))
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const input = await readJson<UserInput>(req)
    const view = await mutate((db) => {
      const actor = requireMallUser(db, ['OWNER'])
      return userView(db, createUser(db, actor, input))
    })
    return ok(view, '已新增')
  })
}
```

- [ ] **Step 2: 详情与修改**

`app/api/mall/manage/users/[id]/route.ts`：

```ts
// GET /api/mall/manage/users/{id}；PUT 仅老板
import { forbidden, handle, notFound, ok, readJson, requireId } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { listUsers, updateUser, userView, type UserInput } from '@/lib/mall-user-service'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const db = await loadDB()
    const actor = requireMallUser(db, ['OWNER', 'SALES'])
    const user = listUsers(db, actor).find((u) => u.id === id)
    if (!user) throw actor.role === 'OWNER' ? notFound('用户不存在') : forbidden()
    return ok(userView(db, user))
  })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const input = await readJson<UserInput>(req)
    const view = await mutate((db) => {
      const actor = requireMallUser(db, ['OWNER'])
      return userView(db, updateUser(db, actor, id, input))
    })
    return ok(view, '已保存')
  })
}
```

- [ ] **Step 3: 类型检查与测试**

Run: `npm run typecheck && npm test`
Expected: 全部通过

- [ ] **Step 4: 提交**

```bash
git add app/api/mall/manage
git commit -m "feat: 小程序用户管理接口"
```

---

### Task 10: 商品类接口加登录门槛 + 后台开关

**Files:**
- Modify: `app/api/mall/home/route.ts`、`categories/route.ts`、`materials/route.ts`、`products/route.ts`、`products/[id]/route.ts`、`notices/route.ts`、`notices/[id]/route.ts`
- Modify: `app/admin/(panel)/configs/page.tsx`（`GROUPS`、`LABELS`）

- [ ] **Step 1: 每个文件加门槛**

以上 7 个路由文件，各自在 import 区加：

```ts
import { requireMallAccess } from '@/lib/mall-auth'
```

并在 `const db = await loadDB()` 的下一行加：

```ts
    requireMallAccess(db)
```

`settings/public` 与 `auth/*` 不加（登录页需要它们）。

- [ ] **Step 2: 确认 7 处都已加上**

Run: `grep -rL "requireMallAccess" app/api/mall/{home,categories,materials,products,notices}/route.ts "app/api/mall/products/[id]/route.ts" "app/api/mall/notices/[id]/route.ts"`
Expected: 无输出（没有遗漏的文件）

- [ ] **Step 3: 后台参数页可切换**

`app/admin/(panel)/configs/page.tsx` 的 `GROUPS` 数组中，`'站点信息'` 那一项之后插入：

```ts
  {
    title: '登录与下单',
    desc: '开启后，小程序与 H5 必须用白名单手机号登录才能浏览商品',
    keys: ['mall.login.required'],
  },
```

`LABELS` 中加：

```ts
  'mall.login.required': '必须登录才能浏览（true / false）',
```

- [ ] **Step 4: 类型检查**

Run: `npm run typecheck`
Expected: 无输出

- [ ] **Step 5: 提交**

```bash
git add app/api/mall "app/admin/(panel)/configs/page.tsx"
git commit -m "feat: 商品类接口按 mall.login.required 要求登录，后台可切换"
```

---

### Task 11: H5 登录页与令牌

**Files:**
- Modify: `lib/client.ts`（`request` 函数）
- Create: `app/login/page.tsx`

- [ ] **Step 1: 请求携带令牌、401 跳登录**

`lib/client.ts` 顶部（`ApiError` 定义之后）加：

```ts
export const MALL_TOKEN_KEY = 'fs_mall_token'

function mallToken(): string {
  try {
    return typeof window === 'undefined' ? '' : localStorage.getItem(MALL_TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}
```

把 `request` 函数里的 `fetch(url, {...})` 调用的 `headers` 改为：

```ts
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(url.startsWith('/api/mall/') && mallToken() ? { Authorization: `Bearer ${mallToken()}` } : {}),
      ...init?.headers,
    },
```

把 `if (body.code !== 0) throw new ApiError(...)` 一行替换为：

```ts
  if (body.code === 401 && url.startsWith('/api/mall/') && typeof window !== 'undefined') {
    try { localStorage.removeItem(MALL_TOKEN_KEY) } catch {}
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
    }
  }
  if (body.code !== 0) throw new ApiError(body.msg || '请求失败', body.code)
```

- [ ] **Step 2: 登录页**

`app/login/page.tsx`：

```tsx
'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api, errMsg, MALL_TOKEN_KEY } from '@/lib/client'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f3ee]" />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const redirect = useSearchParams().get('redirect') || '/'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^1\d{10}$/.test(phone.trim())) {
      setError('请输入 11 位手机号')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.post<{ token: string }>('/api/mall/auth/phone-login', { phone: phone.trim() })
      localStorage.setItem(MALL_TOKEN_KEY, res.token)
      router.replace(redirect.startsWith('/') ? redirect : '/')
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-shell flex-col bg-[#f6f3ee] px-6 pt-24">
      <h1 className="text-[22px] font-semibold text-champagne-ink">凡晟珠宝</h1>
      <p className="mt-1 text-[13px] text-champagne-sub">仅限店铺授权客户使用，请用登记的手机号登录</p>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setError('') }}
          inputMode="numeric"
          maxLength={11}
          placeholder="手机号"
          className="h-12 w-full rounded-xl bg-white px-4 text-[15px] outline-none ring-1 ring-neutral-200 focus:ring-gold-500"
        />
        {error && <p className="text-[13px] text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-xl bg-gold-500 text-[15px] font-medium text-white active:bg-gold-600 disabled:opacity-60"
        >
          {loading ? '登录中…' : '登录'}
        </button>
      </form>
      <p className="mt-6 text-center text-[12px] text-neutral-400">没有开通？请联系店家添加您的手机号</p>
    </div>
  )
}
```

- [ ] **Step 3: 类型检查与构建**

Run: `npm run typecheck && npm run build`
Expected: 构建成功，路由表中出现 `○ /login`

- [ ] **Step 4: 提交**

```bash
git add lib/client.ts app/login/page.tsx
git commit -m "feat: H5 手机号登录页，商品接口 401 时跳转登录"
```

---

### Task 12: 小程序请求层与登录工具

**Files:**
- Modify: `xiaojing-mp/config/index.js`
- Modify: `xiaojing-mp/utils/request.js`
- Create: `xiaojing-mp/utils/auth.js`

- [ ] **Step 1: 配置常量**

`config/index.js` 的 `module.exports` 对象中 `PAGE_SIZE: 10,` 下一行加：

```js
  // 前台登录令牌在本地存储中的键
  TOKEN_KEY: 'fs_mall_token',
  USER_KEY: 'fs_mall_user',
```

- [ ] **Step 2: 请求层带令牌、401 统一跳登录**

`utils/request.js`：第一行 require 改为

```js
const { BASE_URL, TOKEN_KEY, USER_KEY } = require('../config/index');

let redirecting = false;

/** 登录失效：清本地会话并跳登录页（防止多个并发请求重复跳转） */
function goLogin() {
  try {
    wx.removeStorageSync(TOKEN_KEY);
    wx.removeStorageSync(USER_KEY);
  } catch (e) {}
  const pages = getCurrentPages();
  const current = pages.length ? pages[pages.length - 1].route : '';
  if (redirecting || current === 'pages/login/login') return;
  redirecting = true;
  wx.reLaunch({
    url: '/pages/login/login',
    complete: function () {
      redirecting = false;
    },
  });
}
```

`request()` 中 `header` 改为：

```js
      header: Object.assign(
        {
          'content-type': 'application/json',
          Accept: 'application/json',
        },
        wx.getStorageSync(TOKEN_KEY) ? { Authorization: 'Bearer ' + wx.getStorageSync(TOKEN_KEY) } : {}
      ),
```

`success` 回调中 `if (body.code === 0) {...} else {...}` 的 else 分支改为：

```js
          } else {
            if (body.code === 401) goLogin();
            const err = new Error(body.msg || '请求失败');
            err.code = body.code;
            reject(err);
          }
```

`module.exports` 改为：

```js
module.exports = {
  request: request,
  get: function (url, data) {
    return request({ url: url + qs(data) });
  },
  post: function (url, data) {
    return request({ url: url, method: 'POST', data: data || {} });
  },
  put: function (url, data) {
    return request({ url: url, method: 'PUT', data: data || {} });
  },
  qs: qs,
  errMsg: errMsg,
};
```

- [ ] **Step 3: 登录工具**

`utils/auth.js`：

```js
/**
 * 登录态：令牌与用户信息保存在本地存储
 * 流程：wx.login → wx-login；未绑定时用 bindTicket + 手机号走 phone-login
 */
const { TOKEN_KEY, USER_KEY } = require('../config/index');
const { post } = require('./request');

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null;
}

function saveSession(res) {
  wx.setStorageSync(TOKEN_KEY, res.token);
  wx.setStorageSync(USER_KEY, res.user);
  return res.user;
}

function clearSession() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_KEY);
}

/** 微信一键登录：成功 resolve {user}；需要手机号时 resolve {needPhone, bindTicket} */
function wxLogin() {
  return new Promise(function (resolve) {
    wx.login({
      success: function (r) {
        post('/api/mall/auth/wx-login', { code: r.code })
          .then(function (res) {
            if (res.token) resolve({ user: saveSession(res) });
            else resolve({ needPhone: true, bindTicket: res.bindTicket || null });
          })
          .catch(function () {
            resolve({ needPhone: true, bindTicket: null });
          });
      },
      fail: function () {
        resolve({ needPhone: true, bindTicket: null });
      },
    });
  });
}

function phoneLogin(phone, bindTicket) {
  return post('/api/mall/auth/phone-login', { phone: phone, bindTicket: bindTicket || null }).then(saveSession);
}

module.exports = {
  getToken: getToken,
  getUser: getUser,
  clearSession: clearSession,
  wxLogin: wxLogin,
  phoneLogin: phoneLogin,
};
```

- [ ] **Step 4: 语法检查**

Run（在 `xiaojing-mp/`）：`node --check utils/request.js && node --check utils/auth.js && node --check config/index.js`
Expected: 无输出

---

### Task 13: 小程序登录页

**Files:**
- Create: `xiaojing-mp/pages/login/login.{js,json,wxml,wxss}`
- Modify: `xiaojing-mp/app.json`（`pages`）

- [ ] **Step 1: 页面**

`pages/login/login.json`：

```json
{
  "navigationBarTitleText": "登录",
  "usingComponents": {}
}
```

`pages/login/login.js`：

```js
const { SITE_NAME } = require('../../config/index');
const { wxLogin, phoneLogin } = require('../../utils/auth');
const { errMsg } = require('../../utils/request');

Page({
  data: {
    siteName: SITE_NAME,
    checking: true,
    phone: '',
    error: '',
    submitting: false,
  },

  bindTicket: null,

  onLoad: function () {
    const that = this;
    wx.hideHomeButton && wx.hideHomeButton();
    wxLogin().then(function (res) {
      if (res.user) return that.done();
      that.bindTicket = res.bindTicket;
      that.setData({ checking: false });
    });
  },

  onPhoneInput: function (e) {
    this.setData({ phone: e.detail.value, error: '' });
  },

  submit: function () {
    const that = this;
    const phone = (this.data.phone || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      this.setData({ error: '请输入 11 位手机号' });
      return;
    }
    this.setData({ submitting: true, error: '' });
    phoneLogin(phone, this.bindTicket)
      .then(function () {
        that.done();
      })
      .catch(function (e) {
        that.setData({ submitting: false, error: errMsg(e) });
      });
  },

  done: function () {
    wx.reLaunch({ url: '/pages/index/index' });
  },
});
```

`pages/login/login.wxml`：

```xml
<view class="login">
  <text class="brand">{{siteName}}</text>
  <text class="sub">仅限店铺授权客户使用</text>

  <view wx:if="{{checking}}" class="checking">正在登录…</view>

  <block wx:else>
    <input
      class="field"
      type="number"
      maxlength="11"
      placeholder="请输入登记的手机号"
      value="{{phone}}"
      bindinput="onPhoneInput"
      bindconfirm="submit"
    />
    <text wx:if="{{error}}" class="error">{{error}}</text>
    <button class="btn btn-gold submit" loading="{{submitting}}" disabled="{{submitting}}" bindtap="submit">登录</button>
    <text class="tip">首次登录后会绑定本微信，下次自动登录</text>
    <text class="tip">没有开通？请联系店家添加您的手机号</text>
  </block>
</view>
```

`pages/login/login.wxss`：

```css
.login {
  min-height: 100vh;
  padding: 160rpx 56rpx 0;
  background: #f6f3ee;
  display: flex;
  flex-direction: column;
}
.brand { font-size: 48rpx; font-weight: 600; color: #3b3128; }
.sub { margin-top: 8rpx; font-size: 26rpx; color: #8a7a66; }
.checking { margin-top: 120rpx; text-align: center; color: #8a7a66; font-size: 28rpx; }
.field {
  margin-top: 72rpx;
  height: 96rpx;
  padding: 0 32rpx;
  border-radius: 24rpx;
  background: #ffffff;
  font-size: 30rpx;
}
.error { margin-top: 16rpx; font-size: 24rpx; color: #dc2626; }
.submit { margin-top: 40rpx; }
.tip { margin-top: 20rpx; text-align: center; font-size: 24rpx; color: #a39a8e; }
```

- [ ] **Step 2: 注册页面**

`app.json` 的 `pages` 数组末尾加 `"pages/login/login"`。

- [ ] **Step 3: 语法检查**

Run（在 `xiaojing-mp/`）：`node --check pages/login/login.js && python3 -c "import json;json.load(open('app.json'));json.load(open('pages/login/login.json'))"`
Expected: 无输出

---

### Task 14: 小程序「我的」页（替换「联系我们」tab）

**Files:**
- Create: `xiaojing-mp/pages/mine/mine.{js,json,wxml,wxss}`
- Modify: `xiaojing-mp/app.json`（`pages`、`tabBar.list[2]`）

- [ ] **Step 1: 页面**

`pages/mine/mine.json`：

```json
{
  "navigationBarTitleText": "我的",
  "usingComponents": {}
}
```

`pages/mine/mine.js`：

```js
const { USER_KEY } = require('../../config/index');
const { get } = require('../../utils/request');
const { getToken, getUser, clearSession } = require('../../utils/auth');

Page({
  data: {
    user: null,
    loggedIn: false,
  },

  onShow: function () {
    const that = this;
    if (!getToken()) {
      this.setData({ user: null, loggedIn: false });
      return;
    }
    this.setData({ user: getUser(), loggedIn: true });
    get('/api/mall/auth/me')
      .then(function (user) {
        wx.setStorageSync(USER_KEY, user);
        that.setData({ user: user });
      })
      .catch(function () {});
  },

  goLogin: function () {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goContact: function () {
    wx.navigateTo({ url: '/pages/contact/contact' });
  },

  goUsers: function () {
    wx.navigateTo({ url: '/pages/manage-users/manage-users' });
  },

  callSales: function () {
    const phone = this.data.user && this.data.user.salesPhone;
    if (phone) wx.makePhoneCall({ phoneNumber: phone });
  },

  logout: function () {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新输入手机号登录',
      success: function (r) {
        if (!r.confirm) return;
        clearSession();
        wx.reLaunch({ url: '/pages/login/login' });
      },
    });
  },
});
```

`pages/mine/mine.wxml`：

```xml
<view class="page mine">
  <view class="head">
    <block wx:if="{{loggedIn && user}}">
      <text class="name">{{user.name}}</text>
      <view class="meta">
        <text class="role">{{user.roleLabel}}</text>
        <text class="phone">{{user.phone}}</text>
      </view>
    </block>
    <block wx:else>
      <text class="name">未登录</text>
      <button class="btn btn-gold login-btn" bindtap="goLogin">手机号登录</button>
    </block>
  </view>

  <view class="card list">
    <view wx:if="{{user && user.role === 'CUSTOMER' && user.salesName}}" class="row" bindtap="callSales">
      <text class="row-label">我的业务员</text>
      <text class="row-value">{{user.salesName}} · 拨打</text>
    </view>
    <view wx:if="{{user && (user.role === 'OWNER' || user.role === 'SALES')}}" class="row" bindtap="goUsers">
      <text class="row-label">{{user.role === 'OWNER' ? '用户管理' : '我的客户'}}</text>
      <text class="row-arrow">›</text>
    </view>
    <view class="row" bindtap="goContact">
      <text class="row-label">联系店铺</text>
      <text class="row-arrow">›</text>
    </view>
  </view>

  <view wx:if="{{loggedIn}}" class="card list">
    <view class="row" bindtap="logout">
      <text class="row-label logout">退出登录</text>
    </view>
  </view>
</view>
```

`pages/mine/mine.wxss`：

```css
.mine { background: #f6f3ee; padding-bottom: 40rpx; }
.head { background: #ede5d9; padding: 48rpx 32rpx 56rpx; }
.name { display: block; font-size: 40rpx; font-weight: 600; color: #3b3128; }
.meta { margin-top: 12rpx; display: flex; align-items: center; }
.role {
  padding: 2rpx 14rpx;
  border: 1rpx solid #a8864f;
  border-radius: 8rpx;
  font-size: 22rpx;
  color: #8c6b3b;
}
.phone { margin-left: 16rpx; font-size: 26rpx; color: #8a7a66; }
.login-btn { margin-top: 24rpx; width: 280rpx; }
.list { margin: 24rpx 24rpx 0; padding: 0 32rpx; }
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 104rpx;
  border-bottom: 1rpx solid #f0ebe3;
}
.row:last-child { border-bottom: none; }
.row-label { font-size: 30rpx; color: #2e261f; }
.row-value { font-size: 26rpx; color: #8c6b3b; }
.row-arrow { font-size: 36rpx; color: #c4b8a6; }
.logout { color: #dc2626; }
```

- [ ] **Step 2: tab 改为「我的」**

`app.json`：`pages` 数组末尾加 `"pages/mine/mine"`；`tabBar.list` 第 3 项改为：

```json
      {
        "pagePath": "pages/mine/mine",
        "text": "我的",
        "iconPath": "assets/tabbar/contact.png",
        "selectedIconPath": "assets/tabbar/contact-active.png"
      }
```

`pages/contact/contact` 保留在 `pages` 中，作为普通页面从「我的 → 联系店铺」进入。

- [ ] **Step 3: 联系我们页去掉 tab 页底部留白**

`pages/contact/contact.wxml` 第一行 `<view class="page page-tab">` 改为 `<view class="page">`。

- [ ] **Step 4: 语法检查**

Run（在 `xiaojing-mp/`）：`node --check pages/mine/mine.js && python3 -c "import json;json.load(open('app.json'))"`
Expected: 无输出

---

### Task 15: 小程序用户管理页

**Files:**
- Create: `xiaojing-mp/pages/manage-users/manage-users.{js,json,wxml,wxss}`
- Create: `xiaojing-mp/pages/manage-user-edit/manage-user-edit.{js,json,wxml,wxss}`
- Modify: `xiaojing-mp/app.json`（`pages`）

- [ ] **Step 1: 列表页**

`pages/manage-users/manage-users.json`：

```json
{
  "navigationBarTitleText": "用户管理",
  "enablePullDownRefresh": true,
  "usingComponents": {
    "state-view": "/components/state-view/state-view"
  }
}
```

`pages/manage-users/manage-users.js`：

```js
const { get, errMsg } = require('../../utils/request');
const { getUser } = require('../../utils/auth');

const TABS = [
  { key: '', label: '全部' },
  { key: 'CUSTOMER', label: '客户' },
  { key: 'SALES', label: '业务员' },
  { key: 'OWNER', label: '老板' },
];

Page({
  data: {
    tabs: TABS,
    role: '',
    isOwner: false,
    list: [],
    viewState: 'loading',
    errorText: '',
  },

  onLoad: function () {
    const me = getUser();
    const isOwner = Boolean(me && me.role === 'OWNER');
    this.setData({ isOwner: isOwner });
    if (!isOwner) wx.setNavigationBarTitle({ title: '我的客户' });
  },

  onShow: function () {
    this.load();
  },

  onPullDownRefresh: function () {
    this.load(function () {
      wx.stopPullDownRefresh();
    });
  },

  load: function (done) {
    const that = this;
    this.setData({ viewState: 'loading' });
    get('/api/mall/manage/users', { role: this.data.isOwner ? this.data.role : '' })
      .then(function (list) {
        that.setData({ list: list, viewState: list.length ? 'ready' : 'empty' });
      })
      .catch(function (e) {
        that.setData({ viewState: 'error', errorText: errMsg(e) });
      })
      .then(function () {
        if (typeof done === 'function') done();
      });
  },

  onTab: function (e) {
    this.setData({ role: e.currentTarget.dataset.key });
    this.load();
  },

  onAdd: function () {
    wx.navigateTo({ url: '/pages/manage-user-edit/manage-user-edit' });
  },

  onItem: function (e) {
    if (!this.data.isOwner) {
      const phone = e.currentTarget.dataset.phone;
      wx.makePhoneCall({ phoneNumber: phone });
      return;
    }
    wx.navigateTo({ url: '/pages/manage-user-edit/manage-user-edit?id=' + e.currentTarget.dataset.id });
  },
});
```

`pages/manage-users/manage-users.wxml`：

```xml
<view class="page users">
  <view wx:if="{{isOwner}}" class="tabs">
    <view
      wx:for="{{tabs}}"
      wx:key="key"
      class="tab {{role === item.key ? 'tab-on' : ''}}"
      data-key="{{item.key}}"
      bindtap="onTab"
    >{{item.label}}</view>
  </view>

  <state-view wx:if="{{viewState !== 'ready'}}" state="{{viewState}}" text="{{viewState === 'empty' ? '还没有用户' : errorText}}" bind:retry="load" />

  <view wx:else class="card list">
    <view
      wx:for="{{list}}"
      wx:key="id"
      class="item"
      data-id="{{item.id}}"
      data-phone="{{item.phone}}"
      bindtap="onItem"
    >
      <view class="item-main">
        <text class="item-name">{{item.name}}</text>
        <text class="item-sub">{{item.phone}}{{item.salesName ? ' · 业务员 ' + item.salesName : ''}}</text>
      </view>
      <view class="item-side">
        <text class="tag {{item.status === 1 ? 'tag-gold' : ''}}">{{item.status === 1 ? item.roleLabel : '已停用'}}</text>
        <text wx:if="{{item.wxBound}}" class="wx">已绑微信</text>
      </view>
    </view>
  </view>

  <view wx:if="{{isOwner}}" class="add-bar">
    <button class="btn btn-gold" bindtap="onAdd">新增用户</button>
  </view>
</view>
```

`pages/manage-users/manage-users.wxss`：

```css
.users { background: #f6f3ee; padding-bottom: 180rpx; }
.tabs { display: flex; padding: 20rpx 24rpx; background: #ffffff; }
.tab { margin-right: 16rpx; padding: 10rpx 28rpx; border-radius: 999rpx; font-size: 26rpx; color: #52525b; background: #f4f4f5; }
.tab-on { background: #a8864f; color: #ffffff; }
.list { margin: 24rpx; padding: 0 28rpx; }
.item { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 0; border-bottom: 1rpx solid #f0ebe3; }
.item:last-child { border-bottom: none; }
.item-main { min-width: 0; flex: 1; }
.item-name { display: block; font-size: 30rpx; color: #2e261f; }
.item-sub { display: block; margin-top: 6rpx; font-size: 24rpx; color: #8a7a66; }
.item-side { display: flex; flex-direction: column; align-items: flex-end; }
.wx { margin-top: 8rpx; font-size: 20rpx; color: #16a34a; }
.add-bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom)); background: #ffffff; }
```

- [ ] **Step 2: 编辑页**

`pages/manage-user-edit/manage-user-edit.json`：

```json
{
  "navigationBarTitleText": "新增用户",
  "usingComponents": {}
}
```

`pages/manage-user-edit/manage-user-edit.js`：

```js
const { get, post, put, errMsg } = require('../../utils/request');

const ROLES = [
  { key: 'CUSTOMER', label: '客户' },
  { key: 'SALES', label: '业务员' },
  { key: 'OWNER', label: '老板' },
];

Page({
  data: {
    id: 0,
    roles: ROLES,
    roleIndex: 0,
    salesList: [{ id: 0, name: '不绑定' }],
    salesIndex: 0,
    form: { phone: '', name: '', status: 1 },
    saving: false,
  },

  onLoad: function (options) {
    const that = this;
    const id = Number(options.id || 0);
    this.setData({ id: id });
    if (id) wx.setNavigationBarTitle({ title: '编辑用户' });

    get('/api/mall/manage/users', { role: 'SALES' }).then(function (sales) {
      const salesList = [{ id: 0, name: '不绑定' }].concat(sales);
      that.setData({ salesList: salesList });
      if (!id) return;
      get('/api/mall/manage/users/' + id).then(function (u) {
        that.setData({
          form: { phone: u.phone, name: u.name, status: u.status },
          roleIndex: Math.max(0, ROLES.findIndex(function (r) { return r.key === u.role; })),
          salesIndex: Math.max(0, salesList.findIndex(function (s) { return s.id === (u.salesId || 0); })),
        });
      });
    });
  },

  onInput: function (e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  onRole: function (e) {
    this.setData({ roleIndex: Number(e.detail.value) });
  },

  onSales: function (e) {
    this.setData({ salesIndex: Number(e.detail.value) });
  },

  onStatus: function (e) {
    this.setData({ 'form.status': e.detail.value ? 1 : 0 });
  },

  save: function () {
    const that = this;
    const role = ROLES[this.data.roleIndex].key;
    const sales = this.data.salesList[this.data.salesIndex];
    const body = {
      phone: (this.data.form.phone || '').trim(),
      name: (this.data.form.name || '').trim(),
      role: role,
      salesId: role === 'CUSTOMER' && sales.id ? sales.id : null,
      status: this.data.form.status,
    };
    this.setData({ saving: true });
    const task = this.data.id ? put('/api/mall/manage/users/' + this.data.id, body) : post('/api/mall/manage/users', body);
    task
      .then(function () {
        wx.showToast({ title: '已保存', icon: 'success' });
        setTimeout(function () {
          wx.navigateBack();
        }, 600);
      })
      .catch(function (e) {
        that.setData({ saving: false });
        wx.showToast({ title: errMsg(e), icon: 'none' });
      });
  },
});
```

`pages/manage-user-edit/manage-user-edit.wxml`：

```xml
<view class="page edit">
  <view class="card form">
    <view class="field">
      <text class="label">手机号</text>
      <input class="input" type="number" maxlength="11" placeholder="11 位手机号" value="{{form.phone}}" data-field="phone" bindinput="onInput" />
    </view>
    <view class="field">
      <text class="label">姓名</text>
      <input class="input" maxlength="20" placeholder="称呼或店名" value="{{form.name}}" data-field="name" bindinput="onInput" />
    </view>
    <picker range="{{roles}}" range-key="label" value="{{roleIndex}}" bindchange="onRole">
      <view class="field">
        <text class="label">角色</text>
        <text class="value">{{roles[roleIndex].label}} ›</text>
      </view>
    </picker>
    <picker wx:if="{{roles[roleIndex].key === 'CUSTOMER'}}" range="{{salesList}}" range-key="name" value="{{salesIndex}}" bindchange="onSales">
      <view class="field">
        <text class="label">业务员</text>
        <text class="value">{{salesList[salesIndex].name}} ›</text>
      </view>
    </picker>
    <view class="field">
      <text class="label">启用</text>
      <switch checked="{{form.status === 1}}" color="#a8864f" bindchange="onStatus" />
    </view>
  </view>
  <view class="actions">
    <button class="btn btn-gold" loading="{{saving}}" disabled="{{saving}}" bindtap="save">保存</button>
  </view>
</view>
```

`pages/manage-user-edit/manage-user-edit.wxss`：

```css
.edit { background: #f6f3ee; }
.form { margin: 24rpx; padding: 0 28rpx; }
.field { display: flex; align-items: center; justify-content: space-between; height: 104rpx; border-bottom: 1rpx solid #f0ebe3; }
.label { width: 140rpx; font-size: 28rpx; color: #52525b; }
.input { flex: 1; text-align: right; font-size: 28rpx; }
.value { font-size: 28rpx; color: #2e261f; }
.actions { padding: 32rpx; }
```

- [ ] **Step 3: 注册页面**

`app.json` 的 `pages` 数组末尾加 `"pages/manage-users/manage-users"`、`"pages/manage-user-edit/manage-user-edit"`。

- [ ] **Step 4: 语法检查**

Run（在 `xiaojing-mp/`）：

```bash
node --check pages/manage-users/manage-users.js && node --check pages/manage-user-edit/manage-user-edit.js && python3 -c "import json;[json.load(open(p)) for p in ['app.json','pages/manage-users/manage-users.json','pages/manage-user-edit/manage-user-edit.json']]"
```

Expected: 无输出

---

### Task 16: 演示用户脚本

**Files:**
- Create: `scripts/seed-demo-users.ts`

- [ ] **Step 1: 脚本**

`scripts/seed-demo-users.ts`：

```ts
// 写入演示用户（按手机号幂等，已存在则只更新姓名/角色/绑定）
// 用法（在 huangjin-web 目录下）：
//   npx tsx --env-file=.env.local scripts/seed-demo-users.ts --owner-phone=<你的手机号>
import { mutate, nextId } from '../lib/store'
import { normalizePhone } from '../lib/mall-user-service'
import type { MallRole, MallUser } from '../lib/types'

const arg = process.argv.find((a) => a.startsWith('--owner-phone='))
if (!arg) throw new Error('请用 --owner-phone=<手机号> 指定老板账号')
const ownerPhone = normalizePhone(arg.split('=')[1])

const DEMO: Array<{ phone: string; name: string; role: MallRole; sales?: string }> = [
  { phone: ownerPhone, name: '老板', role: 'OWNER' },
  { phone: '13800000011', name: '业务员小王', role: 'SALES' },
  { phone: '13800000012', name: '业务员小李', role: 'SALES' },
  { phone: '13800000021', name: '深圳金福珠宝', role: 'CUSTOMER', sales: '13800000011' },
  { phone: '13800000022', name: '广州周记金行', role: 'CUSTOMER', sales: '13800000011' },
  { phone: '13800000023', name: '东莞福满堂', role: 'CUSTOMER', sales: '13800000012' },
  { phone: '13800000024', name: '佛山金玉坊', role: 'CUSTOMER', sales: '13800000012' },
]

async function main() {
  const out = await mutate((db) => {
    const ts = new Date().toISOString()
    const byPhone = (p: string) => db.mallUser.find((u) => !u.deleted && u.phone === p)
    const lines: string[] = []
    for (const d of DEMO) {
      let u = byPhone(d.phone)
      if (!u) {
        u = { id: nextId(db, 'mallUser'), createdAt: ts, updatedAt: ts, createdBy: 'script', phone: d.phone, name: d.name, role: d.role, salesId: null, openid: null, status: 1 } as MallUser
        db.mallUser.push(u)
        lines.push(`新增 ${d.role} ${d.name} ${d.phone}`)
      } else {
        lines.push(`更新 ${d.role} ${d.name} ${d.phone}`)
      }
      u.name = d.name
      u.role = d.role
      u.status = 1
      u.updatedAt = ts
    }
    for (const d of DEMO) {
      const u = byPhone(d.phone)!
      u.salesId = d.sales ? byPhone(d.sales)!.id : null
    }
    return lines
  })
  out.forEach((l) => console.log(l))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck`
Expected: 无输出

- [ ] **Step 3: 提交**

```bash
git add scripts/seed-demo-users.ts
git commit -m "chore: 演示用户脚本"
```

---

### Task 17: 上线与验收（顺序很重要）

- [ ] **Step 1: 全量检查**

Run: `npm test && npm run typecheck && npm run build`
Expected: 全部通过

- [ ] **Step 2: 推送部署（此时 `mall.login.required` 仍为 false，线上旧版小程序不受影响）**

```bash
git push origin main
```

等待 `curl -s -X POST https://xiaojing.keyseal.top/api/mall/auth/wx-login -H 'content-type: application/json' -d '{"code":"x"}'` 返回 `"code":0`。

- [ ] **Step 3: 写入演示用户**（需要用户提供手机号）

```bash
npx tsx --env-file=.env.local scripts/seed-demo-users.ts --owner-phone=<用户手机号>
```

- [ ] **Step 4: 用户操作：配置微信密钥**

请用户在 Vercel 项目 Settings → Environment Variables 添加 `WX_APPID=wxe7b25696c52f2624`、`WX_SECRET=<公众平台生成的 AppSecret>`，然后 Redeploy。未配置也能用手机号登录。

- [ ] **Step 5: 用户操作：上传小程序体验版**

用户在开发者工具打开 `xiaojing-mp/` 上传。验收点：
1. 未登录打开 → 首页正常（门槛未开）；「我的」显示「手机号登录」。
2. 用白名单外手机号登录 → 提示「该手机号未开通」。
3. 用 `13800000021` 登录 → 「我的」显示客户、业务员小王，可拨号。
4. 退出，用老板手机号登录 → 「用户管理」可见全部 7 人，新增一个客户成功。
5. 用 `13800000011` 登录 → 「我的客户」只有 2 个客户。

- [ ] **Step 6: 打开登录门槛**（第 5 步验收通过后）

```bash
npx tsx --env-file=.env.local scripts/set-config.ts "mall.login.required=true"
```

验收：小程序未登录冷启动 → 自动跳登录页；H5 打开首页 → 跳 `/login`；`curl -s https://xiaojing.keyseal.top/api/mall/home` 返回 `"code":401`。

回滚：`scripts/set-config.ts "mall.login.required=false"`，无需部署。
