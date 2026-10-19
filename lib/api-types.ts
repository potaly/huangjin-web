// ────────────────────────────────────────────────────────────────
// 前端使用的接口返回类型（与 lib/mall.ts 的视图模型保持一致）
// 一期前台 DTO 中不存在任何价格字段
// ────────────────────────────────────────────────────────────────

import type { BannerLinkType, ProductAttr, StockDisplayMode, StockLevel } from './types'

export interface MallBanner {
  id: number
  image: string
  title: string
  linkType: BannerLinkType
  linkValue: string
}

export interface MallNoticeCard {
  id: number
  title: string
  cover?: string
  summary: string
  isTop: boolean
  publishAt: string
}

export interface MallNoticeDetail {
  id: number
  title: string
  cover?: string
  contentHtml: string
  isTop: boolean
  publishAt: string
}

export interface MallCategoryNode {
  id: number
  name: string
  icon?: string
  productCount: number
  children: Array<{ id: number; name: string; icon?: string; productCount: number }>
}

export interface MallProductCard {
  id: number
  name: string
  styleNo: string
  cover?: string
  categoryId: number
  categoryName: string
  materialId: number
  materialName: string
  isRecommend: boolean
  refWeightMin: number | null
  refWeightMax: number | null
  skuCount: number
  stockLevel: StockLevel
  soldOut: boolean
  availableWeight?: number
  createdAt: string
}

export interface MallSku {
  id: number
  skuCode: string
  specName: string
  refWeight: number | null
  refQty: number | null
  level: StockLevel
  availableWeight?: number
}

export interface MallProductDetail {
  id: number
  name: string
  styleNo: string
  cover?: string
  images: string[]
  categoryId: number
  categoryName: string
  parentCategoryName: string
  materialName: string
  purity: string
  sizeDesc: string
  attrs: ProductAttr[]
  detailHtml: string
  isRecommend: boolean
  stockLevel: StockLevel
  stockDisplayMode: StockDisplayMode
  skus: MallSku[]
  offSale: boolean
  related: MallProductCard[]
}

export interface MallHome {
  siteName: string
  siteSlogan: string
  banners: MallBanner[]
  notices: MallNoticeCard[]
  popupNotice: MallNoticeCard | null
  categories: MallCategoryNode[]
  recommend: MallProductCard[]
  newest: MallProductCard[]
  stockDisplayMode: StockDisplayMode
}

export interface MallMaterial {
  id: number
  code: string
  name: string
  purity: string
}

export interface PageResult<T> {
  records: T[]
  total: number
  pageNum: number
  pageSize: number
}

export interface MallProductPage extends PageResult<MallProductCard> {
  stockDisplayMode: StockDisplayMode
}
