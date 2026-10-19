// GET /api/mall/home — 轮播、有效公告前 3 条、弹窗公告、推荐商品
import { handle, ok } from '@/lib/api'
import { loadDB } from '@/lib/store'
import {
  noticeCard, onSaleProducts, productCard, stockDisplayMode, visibleNotices, categoryTree, configMap,
} from '@/lib/mall'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const db = await loadDB()
    const mode = stockDisplayMode(db)
    const notices = visibleNotices(db)
    const cfg = configMap(db)

    const banners = db.banner
      .filter((b) => !b.deleted && b.status === 1)
      .sort((a, b) => a.sort - b.sort || a.id - b.id)
      .map((b) => ({
        id: b.id,
        image: b.image,
        title: b.title ?? '',
        linkType: b.linkType,
        linkValue: b.linkValue ?? '',
      }))

    const recommend = onSaleProducts(db)
      .filter((p) => p.isRecommend)
      .sort((a, b) => a.sort - b.sort || b.id - a.id)
      .slice(0, 8)
      .map((p) => productCard(db, p, mode))

    const newest = onSaleProducts(db)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)
      .map((p) => productCard(db, p, mode))

    return ok({
      siteName: cfg['site.name'] ?? '黄金首饰批发商城',
      siteSlogan: cfg['site.slogan'] ?? '',
      banners,
      notices: notices.slice(0, 3).map(noticeCard),
      popupNotice: notices.find((n) => n.isPopup) ? noticeCard(notices.find((n) => n.isPopup)!) : null,
      categories: categoryTree(db).slice(0, 10),
      recommend,
      newest,
      stockDisplayMode: mode,
      // 二期：今日金价卡片在此补充 goldPrices 字段
    })
  })
}
