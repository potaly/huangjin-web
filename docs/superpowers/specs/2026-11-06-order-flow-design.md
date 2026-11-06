# 演示版下单闭环 · 设计

- 日期：2026-11-06
- 范围：`huangjin-web`（Next.js 后端 + H5 + PC 后台）与 `xiaojing-mp`（原生微信小程序）
- 目的：在给客户演示前补齐「登录 → 选货 → 下单扣库存 → 业务员跟进」闭环，用来收集真实需求。属于演示版，不是正式交付。

## 1. 已确认的规则

| 议题 | 结论 |
|---|---|
| 识别客户 | 管理员预先录入白名单手机号；首次手机号登录并绑定微信 openid，之后微信一键登录；不在白名单无法登录 |
| 浏览门槛 | 一进来就必须登录（后端接口同样校验）；由系统参数 `mall.login.required` 控制，关掉即恢复免登录 |
| 扣库存时机 | 提交即扣；库存不足整单失败；取消时恢复 |
| 下单单位 | 按件；库存仍按克存储，扣减克重 = 件数 × SKU 单件参考克重 |
| 订单处理 | 小程序内管理入口（老板 + 业务员）；PC 后台只读订单列表 |
| 管理登录 | 与客户同一套手机号登录，按角色显示入口 |
| 用户录入 | 小程序老板端可新增/改绑/停用用户 |
| 客户看到的数字 | 件数、预估克重、预估工费（克重 × 每克工费），注明「不含金价，以业务员确认为准」 |
| 订单状态 | 待确认 → 已确认 → 已完成；已取消。客户仅「待确认」可取消；业务员/老板在完成前可取消（必填原因）；取消恢复库存 |
| 新单提醒 | 仅小程序内红点，不做微信订阅消息 |

## 2. 方案

在现有 Next.js + Redis 单文档存储上扩展。`lib/store.ts` 的 `mutate()` 用 Redis 分布式锁串行化整库读改写，一次回调内的「校验 → 扣库存 → 写订单 → 写流水」要么全部写入要么全部不写，天然满足原子性与防超卖。演示阶段不迁移数据库。

## 3. 数据模型（`lib/types.ts`）

新增两张表，`DB` 增加 `mallUser: MallUser[]`、`order: Order[]`；`store.ts` 的 `migrate()` 为老数据补空数组。

```ts
type MallRole = 'OWNER' | 'SALES' | 'CUSTOMER'          // 老板 / 业务员 / 客户
interface MallUser extends BaseEntity {
  phone: string            // 11 位，唯一（未删除范围内）
  name: string
  role: MallRole
  salesId?: number | null  // 仅客户：绑定的业务员（MallUser.id，role=SALES）
  openid?: string | null   // 绑定的微信 openid，唯一
  status: 0 | 1            // 0 停用
  lastLoginAt?: string
}

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
interface OrderItem {
  productId: number; skuId: number
  name: string; styleNo: string; specName: string; cover: string   // 快照
  unitWeight: number       // 单件参考克重（快照）
  laborFeePerG: number | null
  qty: number              // 件数
  weight: number           // qty × unitWeight，3 位小数
  laborFee: number | null  // weight × laborFeePerG，2 位小数
}
interface Order extends BaseEntity {
  orderNo: string          // 例：FS20261106-0001
  customerId: number; customerName: string; customerPhone: string
  salesId: number | null   // 下单时客户绑定的业务员
  status: OrderStatus
  items: OrderItem[]
  totalQty: number; totalWeight: number; totalLaborFee: number | null
  remark?: string
  clientToken: string      // 防重复提交
  confirmedAt?: string; completedAt?: string
  cancelledAt?: string; cancelledBy?: string; cancelReason?: string
  /** 管理端是否已查看，用于红点 */
  seenBySales?: boolean
}
```

库存流水新增类型 `ORDER_OUT`（下单扣减）、`ORDER_BACK`（取消回库），`refNo` 记订单号。

## 4. 登录与会话（`lib/mall-auth.ts`）

- 会话：沿用 `lib/auth.ts` 的 HMAC 签名，载荷 `{ uid, role, exp }`，有效期 30 天；小程序放 `wx.setStorageSync`，H5 放 localStorage；请求头 `Authorization: Bearer <token>`。
- `POST /api/mall/auth/wx-login { code }`：用 `WX_APPID`/`WX_SECRET` 调 `jscode2session` 取 openid；已绑定且启用 → 返回 token；未绑定 → 返回 `{ needPhone: true, bindTicket }`（bindTicket 为签名的短期 openid 凭证，10 分钟）。未配置密钥时返回 `needPhone: true` 且无 bindTicket。
- `POST /api/mall/auth/phone-login { phone, bindTicket? }`：白名单中存在且启用 → 登录；带 bindTicket 时把 openid 绑到该用户（若 openid 已绑别人则先解绑旧的）。不存在 → 「该手机号未开通，请联系店家」；停用 → 「账号已停用」。同一 IP 每分钟最多 10 次（单实例内存计数，演示用的尽力限制）。
- `GET /api/mall/auth/me`：当前用户 + 角色 + 绑定业务员信息（姓名、电话、微信）。
- 门槛：`requireMallUser(req, roles?)`。`mall.login.required=true` 时，所有 `/api/mall/*` 商品类接口要求有效 token（`auth/*` 与 `settings/public` 除外）；返回 `code=401` 时前端跳登录页。
- 安全边界：演示版手机号登录无短信验证码，正式版需改为短信验证或微信授权手机号（写入 README 风险说明）。

## 5. 下单与取消（`lib/order-service.ts`，纯函数，均在 `mutate` 回调内调用）

`placeOrder(db, user, { items: [{skuId, qty}], remark, clientToken })`
1. 校验：用户为启用的 CUSTOMER；`items` 非空、件数为 1–999 的整数、同一 SKU 合并；`clientToken` 必填。
2. 幂等：存在同一 `customerId + clientToken` 的订单 → 直接返回该订单，不重复扣减。
3. 逐项校验商品上架、SKU 启用、`refWeight > 0`、可售件数 ≥ qty（可售件数 = floor((stockWeight − lockedWeight) / refWeight)）；任一失败抛出「<商品名> <规格> 库存不足，剩余 N 件」，整单不写入。
4. 全部通过后：逐项 `applyStockChange(type: ORDER_OUT, changeWeight: −qty×refWeight, refNo: orderNo)`，写订单（快照 + 合计），`seenBySales=false`。

`changeOrderStatus(db, actor, orderId, action, reason?)`

| 动作 | 允许的当前状态 | 允许的人 |
|---|---|---|
| confirm | PENDING | 该单业务员、老板 |
| complete | CONFIRMED | 该单业务员、老板 |
| cancel | PENDING（客户本人）；PENDING/CONFIRMED（业务员、老板，原因必填） | 见左 |

取消时逐项 `applyStockChange(type: ORDER_BACK, +weight)`；状态已是 CANCELLED/COMPLETED 时拒绝，保证库存不会被重复恢复。其余非法流转返回中文错误。

可见范围：客户只看自己的订单；业务员看 `salesId = 自己` 的订单；老板看全部。

## 6. 接口

客户（需 CUSTOMER）：`POST /api/mall/orders`、`GET /api/mall/orders`、`GET /api/mall/orders/{id}`、`POST /api/mall/orders/{id}/cancel`

管理（需 OWNER/SALES）：`GET /api/mall/manage/orders?status=`、`GET /api/mall/manage/orders/{id}`、`POST /api/mall/manage/orders/{id}/{confirm|complete|cancel}`、`GET /api/mall/manage/badge`（待确认且未查看数）

用户管理（OWNER 可写，SALES 只读自己的客户）：`GET/POST /api/mall/manage/users`、`PUT /api/mall/manage/users/{id}`（改姓名、角色、绑定业务员、启停；不能停用自己）

PC 后台：`GET /api/admin/orders`（只读，SUPER）

选购清单只存在客户端本地（小程序 storage / H5 不做），提交时由服务端重新校验，不信任客户端的库存与价格。

## 7. 小程序页面（`xiaojing-mp`）

- `pages/login`：启动先 `wx.login` → wx-login；需要手机号时显示输入框；成功后 `reLaunch` 首页。`app.js` 启动和 `request.js` 收到 401 时跳这里。
- 商品详情：底部新增「加入选购清单」，弹层选规格 + 件数（步进器，上限为可售件数）。商品接口需额外返回每个 SKU 的可售件数 `availableQty`。
- `pages/cart`（tab「选购清单」，角标显示件数）：改件数、删除、备注、合计件数/预估克重/预估工费，提交按钮在请求中禁用；成功后清空并跳订单详情。
- `pages/mine`（tab「我的」，替换「联系我们」，联系信息挪进来）：我的订单、我的业务员（拨号/复制微信）、联系店铺、退出登录；老板/业务员额外显示「订单管理」（带红点）与「用户管理」（老板）。
- `pages/order-list`、`pages/order-detail`：客户订单；待确认可取消（二次确认）。
- `pages/manage-orders`、`pages/manage-order-detail`：状态标签、确认/完成/取消（取消需填原因）。
- `pages/manage-users`、`pages/manage-user-edit`：手机号、姓名、角色、绑定业务员、启停。
- H5：新增手机号登录页，`mall.login.required` 打开时未登录跳转；H5 不做下单与管理。

## 8. 演示数据（`scripts/seed-demo-users.ts`，可重复执行）

- 老板 1、业务员 2、客户 4，手机号用 `1380000xxxx` 段；客户分别绑两名业务员。
- 你本人的手机号作为老板（执行脚本时传入）。
- 造 4 笔订单：待确认 2、已确认 1、已完成 1，走 `placeOrder` 正常扣库存。
- 打开 `mall.login.required`。

## 9. 测试

用 `tsx --test`（Node 内置测试，无需新依赖）对 `order-service` 与 `mall-auth` 写单元测试，基于内存 `DB` 构造数据：
- 整单库存不足时不扣任何库存、不生成订单；
- 同一 clientToken 重复提交只生成一单、只扣一次；
- 取消恢复库存，二次取消被拒绝且库存不变；
- 客户不能取消已确认订单，业务员取消必须填原因；
- 业务员看不到其他业务员客户的订单；
- 白名单外手机号、停用用户无法登录；openid 绑定与换绑。

验收：本地 H5 走登录；小程序由你在开发者工具里走一遍「登录 → 加清单 → 提交 → 管理端确认 → 完成 / 取消」。

## 10. 交付批次

1. 登录与用户：数据模型、mall-auth、登录接口与门槛、小程序登录页与「我的」、老板端用户管理、H5 登录页。
2. 选购清单与下单：order-service、客户订单接口、详情页加购、清单页、我的订单。
3. 管理端：订单管理页面与接口、红点、PC 后台只读订单、演示数据脚本。

## 11. 不做

在线支付、物流、金价计价、短信验证码、微信订阅消息、订单改数量、PC 后台用户管理、H5 下单。
