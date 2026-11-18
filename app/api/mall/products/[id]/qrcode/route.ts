// GET /api/mall/products/{id}/qrcode — 商品详情页的小程序码，供小程序端画进分享图
//
// 一个商品的码永不变化，所以用固定 COS key 缓存：先探测对象是否已存在，
// 命中就直接返回地址，只有第一次才真正调微信接口。
import { handle, notFound, ok, requireId, BizError } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { requireMallAccess } from '@/lib/mall-auth'
import { cosConfig, cosPutObject } from '@/lib/cos'
import { getUnlimitedQrCode } from '@/lib/wechat'

export const dynamic = 'force-dynamic'

/** 小程序端商品详情页路径，与 xiaojing-mp/app.json 中的注册路径保持一致 */
const DETAIL_PAGE = 'pages/goods-detail/goods-detail'

/** 对象已存在就不用再找微信要图 */
async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const db = await loadDB()
    requireMallAccess(db)
    const id = requireId(params.id, '商品 ID')
    // 已下架商品的详情页仍可访问，码也照常生成
    const product = db.product.find((p) => p.id === id && !p.deleted)
    if (!product) throw notFound('商品不存在')

    const cos = cosConfig()
    if (!cos) throw new BizError('图片存储未配置：请设置 TENCENT_COS_* 环境变量', 500)

    const key = `${cos.prefix}qrcode/p${id}.png`
    const url = `${cos.publicUrl}/${key}`
    if (await exists(url)) return ok({ url })

    const result = await getUnlimitedQrCode({ scene: String(id), page: DETAIL_PAGE })
    if ('errcode' in result) {
      // 41030：page 在已发布版本里不存在。正式发版后自动消失，开发期用 WX_QRCODE_ENV=trial 绕过
      const hint =
        result.errcode === 41030
          ? '商品详情页尚未发布，小程序码暂时无法生成（发布正式版后自动可用）'
          : `生成小程序码失败（${result.errcode}：${result.errmsg}）`
      throw new BizError(hint, 500)
    }

    return ok({ url: await cosPutObject(cos, key, result.png, 'image/png') })
  })
}
