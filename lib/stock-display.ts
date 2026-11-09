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

/** 不能购买时底部主按钮的文案，可购买时返回空串 */
export function mainActionLabel(p: { stockLevel: StockLevel; offSale: boolean }): string {
  if (p.offSale) return '已下架 · 咨询客服'
  return p.stockLevel === 'SOLD_OUT' ? '已售罄 · 咨询补货' : ''
}
