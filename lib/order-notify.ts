// 新订单通知：客户下单后给对应业务员发小程序订阅消息（模版「订单确认通知」）
// 一次性订阅：业务员每在小程序里同意一次，才能收到一条；没有次数时微信返回 43101，静默跳过
import { sendSubscribeMessage, wechatConfigured, type SubscribeMessage } from './wechat'
import { ORDER_STATUS_LABEL, type DB, type MallUser, type Order } from './types'

/** 模版 ID 不是密钥；可用环境变量 WX_TMPL_NEW_ORDER 覆盖 */
export const NEW_ORDER_TEMPLATE_ID =
  process.env.WX_TMPL_NEW_ORDER || 'KpYWhxxJBzLa89XCTDZiyiefGQv8WAhNvoiiplny6kI'

/** 通知对象：本单业务员；没绑业务员的单通知老板（与管理端红点口径一致）。只返回已绑微信的启用账号 */
export function orderNotifyTargets(db: DB, order: Order): MallUser[] {
  const usable = (u: MallUser) => !u.deleted && u.status === 1 && Boolean(u.openid)
  if (order.salesId !== null && order.salesId !== undefined) {
    return db.mallUser.filter((u) => u.id === order.salesId && u.role === 'SALES' && usable(u))
  }
  return db.mallUser.filter((u) => u.role === 'OWNER' && usable(u))
}

/** name 类型字段：只能是 10 个以内纯汉字，或 20 个以内纯字母，混排会被微信拒收 */
export function nameValue(raw: string): string {
  const han = raw.replace(/[^一-龥]/g, '')
  if (han) return han.slice(0, 10)
  const letters = raw.replace(/[^A-Za-z ]/g, '').trim()
  return letters ? letters.slice(0, 20) : '客户'
}

/** time 类型字段：北京时间「2026年11月10日 17:30」 */
export function timeValue(iso: string): string {
  const t = new Date(new Date(iso).getTime() + 8 * 3600 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getUTCFullYear()}年${t.getUTCMonth() + 1}月${t.getUTCDate()}日 ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`
}

function mpState(): SubscribeMessage['miniprogram_state'] {
  const s = process.env.WX_MP_STATE
  return s === 'developer' || s === 'trial' ? s : 'formal'
}

export function newOrderMessage(order: Order, openid: string): SubscribeMessage {
  return {
    touser: openid,
    template_id: NEW_ORDER_TEMPLATE_ID,
    page: `pages/order-detail/order-detail?id=${order.id}&mode=manage`,
    miniprogram_state: mpState(),
    lang: 'zh_CN',
    data: {
      character_string1: { value: order.orderNo.slice(0, 32) },
      name2: { value: nameValue(order.customerName) },
      phone_number5: { value: order.customerPhone.replace(/[^\d+\-]/g, '').slice(0, 17) },
      phrase6: { value: ORDER_STATUS_LABEL[order.status].slice(0, 5) },
      time7: { value: timeValue(order.createdAt) },
    },
  }
}

/** 发送通知；最多等 timeoutMs，任何失败都不影响下单结果 */
export async function notifyNewOrder(order: Order, targets: MallUser[], timeoutMs = 3000): Promise<void> {
  if (!wechatConfigured() || targets.length === 0) return
  const sending = Promise.all(
    targets.map((u) => sendSubscribeMessage(newOrderMessage(order, u.openid!)).catch(() => -1)),
  )
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    sending,
    new Promise((resolve) => {
      timer = setTimeout(resolve, timeoutMs)
    }),
  ])
  if (timer) clearTimeout(timer)
}
