'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, errMsg } from '@/lib/client'
import type { MallHome } from '@/lib/api-types'
import { Carousel } from '@/components/mall/Carousel'
import { ProductCard, ProductCardSkeleton } from '@/components/mall/ProductCard'
import { useMall } from '@/components/mall/MallProvider'
import { ErrorBox, Skeleton } from '@/components/ui'

const POPUP_KEY = 'hj_popup_date'

export default function HomePage() {
  const [data, setData] = useState<MallHome | null>(null)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [popup, setPopup] = useState<MallHome['popupNotice']>(null)
  const router = useRouter()
  const { settings } = useMall()

  const load = useCallback(() => {
    setError('')
    api
      .get<MallHome>('/api/mall/home')
      .then((res) => {
        setData(res)
        // §4.2：标记「首页弹窗」的公告，访客每天首次进入首页时弹出一次
        if (res.popupNotice) {
          const today = new Date().toISOString().slice(0, 10)
          try {
            if (localStorage.getItem(POPUP_KEY) !== today) {
              setPopup(res.popupNotice)
              localStorage.setItem(POPUP_KEY, today)
            }
          } catch {
            // 隐私模式下 localStorage 不可用，直接跳过弹窗
          }
        }
      })
      .catch((e) => setError(errMsg(e)))
  }, [])

  useEffect(load, [load])

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(keyword.trim() ? `/goods?keyword=${encodeURIComponent(keyword.trim())}` : '/goods')
  }

  return (
    <div className="pb-4">
      {/* 顶部搜索 */}
      <header className="sticky top-0 z-30 bg-gradient-to-b from-gold-500 to-gold-400 px-3 pb-3 pt-3">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h1 className="text-[17px] font-semibold text-white">
            {data?.siteName ?? settings.siteName}
          </h1>
          <span className="text-[11px] text-white/85">{data?.siteSlogan ?? settings.siteSlogan}</span>
        </div>
        <form onSubmit={search} className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2">
          <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0 text-neutral-400" aria-hidden>
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索商品名称或款号"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-neutral-400"
          />
          <button type="submit" className="shrink-0 text-[13px] font-medium text-gold-600">
            搜索
          </button>
        </form>
      </header>

      {error && <ErrorBox text={error} onRetry={load} />}

      {!data && !error && (
        <div className="space-y-3 p-3">
          <Skeleton className="aspect-[2/1] w-full" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {data && (
        <>
          {data.banners.length > 0 && (
            <div className="overflow-hidden bg-white">
              <Carousel banners={data.banners} />
            </div>
          )}

          {/* 公告滚动条：最新 3 条 */}
          {data.notices.length > 0 && (
            <Link
              href="/notice"
              className="mx-3 mt-3 flex items-center gap-2 rounded-xl bg-gold-50 px-3 py-2.5 ring-1 ring-gold-100 active:bg-gold-100"
            >
              <span className="shrink-0 rounded bg-gold-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                公告
              </span>
              <div className="notice-roll h-[18px] min-w-0 flex-1 overflow-hidden">
                <div>
                  {[...data.notices, data.notices[0]].map((n, i) => (
                    <p key={`${n.id}-${i}`} className="h-[18px] truncate text-[13px] leading-[18px] text-gold-900">
                      {n.isTop && <span className="mr-1 text-[10px] text-rose-500">[置顶]</span>}
                      {n.title}
                    </p>
                  ))}
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 16 16" className="shrink-0 text-gold-500" aria-hidden>
                <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </Link>
          )}

          {/* 二期：此处插入今日金价卡片 */}

          {/* 分类入口 */}
          {data.categories.length > 0 && (
            <section className="mx-3 mt-3 rounded-xl bg-white p-3 shadow-card">
              <div className="grid grid-cols-5 gap-y-3">
                {data.categories.slice(0, 10).map((c) => (
                  <Link
                    key={c.id}
                    href={`/goods?categoryId=${c.id}`}
                    className="flex flex-col items-center gap-1.5 active:opacity-70"
                  >
                    {c.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.icon} alt="" className="h-11 w-11 rounded-xl" loading="lazy" />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-50 text-[15px] text-gold-600">
                        {c.name.slice(0, 1)}
                      </span>
                    )}
                    <span className="max-w-full truncate text-[11px] text-neutral-700">{c.name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 推荐商品 */}
          {data.recommend.length > 0 && (
            <section className="mt-4">
              <SectionTitle title="推荐款式" desc="现货按克批发" href="/goods?recommend=1" />
              <div className="grid grid-cols-2 gap-2.5 px-3">
                {data.recommend.map((p) => (
                  <ProductCard key={p.id} product={p} mode={data.stockDisplayMode} />
                ))}
              </div>
            </section>
          )}

          {/* 最新上架 */}
          {data.newest.length > 0 && (
            <section className="mt-5">
              <SectionTitle title="最新上架" desc="全部款式" href="/goods?sort=new" />
              <div className="grid grid-cols-2 gap-2.5 px-3">
                {data.newest.map((p) => (
                  <ProductCard key={p.id} product={p} mode={data.stockDisplayMode} />
                ))}
              </div>
            </section>
          )}

          <p className="px-6 pt-6 text-center text-[11px] leading-relaxed text-neutral-400">
            本站所有商品按克批发，库存以克计（保留 3 位小数）。
            <br />
            前台不展示价格，请联系客服获取当日报价。
          </p>
        </>
      )}

      {/* 首页弹窗公告 */}
      {popup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-8" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="关闭公告"
            onClick={() => setPopup(null)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative z-10 w-full max-w-[320px] overflow-hidden rounded-2xl bg-white">
            {popup.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={popup.cover} alt="" className="aspect-[2/1] w-full object-cover" />
            )}
            <div className="p-4">
              <h2 className="text-[16px] font-semibold text-neutral-900">{popup.title}</h2>
              <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-neutral-500">
                {popup.summary}
              </p>
              <div className="mt-4 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setPopup(null)}
                  className="flex-1 rounded-lg bg-neutral-100 py-2.5 text-sm text-neutral-600"
                >
                  我知道了
                </button>
                <Link
                  href={`/notice/${popup.id}`}
                  onClick={() => setPopup(null)}
                  className="flex-1 rounded-lg bg-gold-500 py-2.5 text-center text-sm text-white"
                >
                  查看详情
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionTitle({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <div className="mb-2.5 flex items-end justify-between px-3">
      <div className="flex items-baseline gap-2">
        <span className="h-4 w-1 rounded-full bg-gold-500" />
        <h2 className="text-[16px] font-semibold text-neutral-900">{title}</h2>
      </div>
      <Link href={href} className="flex items-center text-[12px] text-neutral-400">
        {desc}
        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
          <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </Link>
    </div>
  )
}
