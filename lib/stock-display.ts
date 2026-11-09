// 商品详情页的库存展示规则：有数字时 qty 非空（配 prefix），否则显示 word

import type { StockDisplayMode, StockLevel } from './types'

export type StockTone = StockLevel | 'OFF_SALE'

export interface StockDisplay {
  tone: StockTone
  qty: number | null
  prefix: string
  word: string
}

interface SkuStock {
  level: StockLevel
  availableQty?: number | null
}

interface ProductStock {
  stockLevel: StockLevel
  stockDisplayMode: StockDisplayMode
  offSale: boolean
  skus: SkuStock[]
}

const LEVEL_WORD: Record<StockLevel, string> = {
  ENOUGH: '现货充足',
  LOW: '库存紧张',
  SOLD_OUT: '已售罄',
}

const wordOnly = (tone: StockTone, word: string): StockDisplay => ({ tone, qty: null, prefix: '', word })

/** 规格行的库存展示 */
export function skuStockDisplay(sku: SkuStock, mode: StockDisplayMode, offSale: boolean): StockDisplay {
  if (offSale) return wordOnly('OFF_SALE', '已下架')
  if (sku.level !== 'SOLD_OUT' && mode === 'EXACT' && typeof sku.availableQty === 'number') {
    return { tone: sku.level, qty: sku.availableQty, prefix: sku.level === 'LOW' ? '仅剩' : '库存', word: '' }
  }
  return wordOnly(sku.level, LEVEL_WORD[sku.level])
}

/** 首屏的总件数条：任一规格无法换算件数时退回等级文字 */
export function productStockDisplay(p: ProductStock): StockDisplay {
  if (p.offSale) return wordOnly('OFF_SALE', '该商品已下架')
  if (p.stockLevel === 'SOLD_OUT') return wordOnly('SOLD_OUT', '已售罄，可咨询补货')
  const qtys = p.skus.map((s) => s.availableQty)
  if (p.stockDisplayMode === 'EXACT' && qtys.length && qtys.every((q) => typeof q === 'number')) {
    const qty = (qtys as number[]).reduce((sum, q) => sum + q, 0)
    return { tone: p.stockLevel, qty, prefix: p.stockLevel === 'LOW' ? '仅剩' : '共', word: '' }
  }
  return wordOnly(p.stockLevel, LEVEL_WORD[p.stockLevel])
}

/** 不能购买时底部主按钮的文案，可购买时返回空串 */
export function mainActionLabel(p: Pick<ProductStock, 'stockLevel' | 'offSale'>): string {
  if (p.offSale) return '已下架 · 咨询客服'
  return p.stockLevel === 'SOLD_OUT' ? '已售罄 · 咨询补货' : ''
}
