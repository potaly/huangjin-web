'use client'

import Link from 'next/link'
import type { MallProductCard } from '@/lib/api-types'
import type { StockDisplayMode } from '@/lib/types'
import { fmtRefWeightRange, fmtWeight } from '@/lib/format'
import { StockBadge, Tag } from '@/components/ui'

/** 双列卡片：主图、名称、材质、库存克数（或等级）；一期不显示价格 */
export function ProductCard({
  product,
  mode,
}: {
  product: MallProductCard
  mode: StockDisplayMode
}) {
  const refRange = fmtRefWeightRange(product.refWeightMin, product.refWeightMax)

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
        <h3 className="line-clamp-2 min-h-[38px] text-[13px] font-medium leading-[19px] text-neutral-900">
          {product.name}
        </h3>

        <div className="flex flex-wrap items-center gap-1">
          <Tag tone="gold">{product.materialName}</Tag>
          {product.skuCount > 1 && <Tag>{product.skuCount} 个规格</Tag>}
        </div>

        <p className="truncate text-[11px] text-neutral-400">
          款号 {product.styleNo}
          {refRange ? ` · ${refRange}` : ''}
        </p>

        <div className="flex items-center justify-between pt-0.5">
          {mode === 'EXACT' && product.availableWeight !== undefined ? (
            <span className="text-[12px] font-medium text-gold-700">
              库存 {fmtWeight(product.availableWeight)} g
            </span>
          ) : (
            <StockBadge level={product.stockLevel} />
          )}
          {mode === 'EXACT' && <StockBadge level={product.stockLevel} />}
        </div>
      </div>
    </Link>
  )
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
