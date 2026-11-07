'use client'

import Link from 'next/link'
import type { MallProductCard } from '@/lib/api-types'
import type { StockDisplayMode } from '@/lib/types'
import { fmtLaborFee, fmtRefWeightShort, fmtWeight } from '@/lib/format'
import { StockBadge } from '@/components/ui'

/** 双列卡片：主图、名称、克重 + 工费（最醒目）、库存；材质与款号只在详情页展示；不显示金价 / 总价 */
export function ProductCard({
  product,
  mode,
}: {
  product: MallProductCard
  mode: StockDisplayMode
}) {
  const weight = fmtRefWeightShort(product.refWeightMin, product.refWeightMax)

  return (
    <Link
      href={`/goods/${product.id}`}
      className="block overflow-hidden rounded-xl bg-white shadow-card active:opacity-90"
    >
      <div className="relative aspect-square bg-neutral-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.cover || '/img/placeholder.svg'}
          alt={product.name}
          loading="lazy"
          className={`h-full w-full object-cover ${product.soldOut ? 'opacity-45 grayscale' : ''}`}
        />
        {product.soldOut && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white">
            已售罄
          </span>
        )}
        {product.isRecommend && !product.soldOut && (
          <span className="absolute left-2 top-2 rounded bg-gold-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
            推荐
          </span>
        )}
      </div>

      <div className="space-y-1.5 p-2.5">
        <h3 className="line-clamp-2 text-[13px] font-medium leading-[19px] text-neutral-900">
          {product.name}
        </h3>

        {/* 最重要的两个信息：克重、工费 */}
        <div className="grid grid-cols-2 rounded-lg bg-gold-50 py-1.5">
          <div className="min-w-0 px-2">
            <p className="text-[10px] leading-none text-neutral-400">克重</p>
            <p className="mt-1 truncate text-[14px] font-semibold leading-none text-neutral-900">{weight || '—'}</p>
          </div>
          <div className="min-w-0 border-l border-gold-200/70 px-2">
            <p className="text-[10px] leading-none text-neutral-400">工费</p>
            <p
              className={`mt-1 truncate text-[14px] font-semibold leading-none ${
                product.laborFeePerG == null ? 'text-neutral-400' : 'text-gold-700'
              }`}
            >
              {fmtLaborFee(product.laborFeePerG)}
            </p>
          </div>
        </div>

        {/* 库存：次要信息，单独一行；左侧状态点 + 件数，右侧规格数 */}
        <div className="flex items-center justify-between pt-0.5 text-[12px] leading-none">
          <StockLine product={product} mode={mode} />
          {product.skuCount > 1 && <span className="shrink-0 text-neutral-400">{product.skuCount} 个规格</span>}
        </div>
      </div>
    </Link>
  )
}

const DOT: Record<MallProductCard['stockLevel'], string> = {
  ENOUGH: 'bg-emerald-500',
  LOW: 'bg-orange-500',
  SOLD_OUT: 'bg-neutral-300',
}

function StockLine({ product, mode }: { product: MallProductCard; mode: StockDisplayMode }) {
  const level = product.stockLevel
  // 精确模式且能换算出件数：「● 库存 18 件」；少量时橙色「仅剩 3 件」
  if (mode === 'EXACT' && typeof product.availableQty === 'number') {
    const q = product.availableQty
    return (
      <span className="inline-flex items-center gap-1.5 text-neutral-500">
        <i className={`h-1.5 w-1.5 rounded-full ${DOT[level]}`} />
        {level === 'SOLD_OUT' ? (
          '已售罄'
        ) : level === 'LOW' ? (
          <span className="font-medium text-orange-600">仅剩 {q} 件</span>
        ) : (
          <span>
            库存 <b className="font-semibold text-neutral-800">{q}</b> 件
          </span>
        )}
      </span>
    )
  }
  if (mode === 'EXACT' && product.availableWeight !== undefined) {
    return <span className="font-medium text-gold-700">库存 {fmtWeight(product.availableWeight)} g</span>
  }
  return <StockBadge level={level} />
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-card">
      <div className="skeleton aspect-square rounded-none" />
      <div className="space-y-2 p-2.5">
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-2/3" />
        <div className="skeleton h-3 w-1/2" />
      </div>
    </div>
  )
}
