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
        const created: MallUser = {
          id: nextId(db, 'mallUser'),
          createdAt: ts,
          updatedAt: ts,
          createdBy: 'script',
          phone: d.phone,
          name: d.name,
          role: d.role,
          salesId: null,
          openid: null,
          status: 1,
        }
        db.mallUser.push(created)
        u = created
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
