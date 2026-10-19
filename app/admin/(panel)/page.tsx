'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, errMsg } from '@/lib/client'
import { PageTitle, Card, Table, Td } from '@/components/admin/AdminUI'
import { useMe } from '@/components/admin/AdminShell'
import { ErrorBox, Loading, StockBadge, Tag } from '@/components/ui'
import { fmtWeight, fmtAgo } from '@/lib/format'
import { STOCK_LOG_TYPE_LABEL, type StockLevel, type StockLog } from '@/lib/types'

interface MaterialStat {
  materialId: number
  code: string
  name: string
  status: 0 | 1
  productCount: number
  skuCount: number
  stockWeight: number
  availableWeight: number
}

interface WarnRow {
  skuId: number
  productId: number
  productName: string
  styleNo: string
  skuCode: string
  specName: string
  stockWeight: number
  availableWeight: number
  warnWeight: number
  level: StockLevel
}

interface Dashboard {
  productTotal: number
  productOnSale: number
  productOffSale: number
  skuTotal: number
  stockWeightTotal: number
  availableWeightTotal: number
  categoryTotal: number
  noticeVisible: number
  bannerActive: number
  byMaterial: MaterialStat[]
  warnCount: number
  warnings: WarnRow[]
  recentLogs: StockLog[]
  storageDriver: 'redis' | 'memory'
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')
  const me = useMe()

  const load = () => {
    setError('')
    api.get<Dashboard>('/api/admin/dashboard').then(setData).catch((e) => setError(errMsg(e)))
  }

  useEffect(load, [])

  return (
    <div>
      <PageTitle title={`${me.realName}，欢迎回来`} desc="黄金首饰批发商城 · 一期工作台" />

      {data?.storageDriver === 'memory' && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800 ring-1 ring-amber-100">
          当前使用<strong>内存存储</strong>，数据在服务实例回收后会重置。正式使用请在环境变量中配置
          <code className="mx-1 rounded bg-amber-100 px-1">UPSTASH_REDIS_REST_URL</code>与
          <code className="mx-1 rounded bg-amber-100 px-1">UPSTASH_REDIS_REST_TOKEN</code>。
        </div>
      )}

      {error && <ErrorBox text={error} onRetry={load} />}
      {!data && !error && <Loading />}

      {data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="商品总数" value={data.productTotal} sub={`上架 ${data.productOnSale} · 下架 ${data.productOffSale}`} href="/admin/products" />
            <StatCard label="SKU 数" value={data.skuTotal} sub={`${data.categoryTotal} 个分类`} href="/admin/stocks" />
            <StatCard
              label="库存总克重"
              value={`${fmtWeight(data.stockWeightTotal)} g`}
              sub={`可售 ${fmtWeight(data.availableWeightTotal)} g`}
              href="/admin/stocks"
              small
            />
            <StatCard
              label="库存预警"
              value={data.warnCount}
              sub={data.warnCount > 0 ? '需要及时补货' : '库存状态良好'}
              href="/admin/stocks?onlyWarn=1"
              tone={data.warnCount > 0 ? 'warn' : 'ok'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <h2 className="mb-3 text-[15px] font-semibold text-neutral-900">各材质库存</h2>
              <Table
                columns={[
                  { key: 'name', label: '材质' },
                  { key: 'product', label: '商品', align: 'right' },
                  { key: 'sku', label: 'SKU', align: 'right' },
                  { key: 'stock', label: '总克重 (g)', align: 'right' },
                  { key: 'avail', label: '可售 (g)', align: 'right' },
                ]}
                empty={data.byMaterial.length === 0}
              >
                {data.byMaterial.map((m) => (
                  <tr key={m.materialId} className="hover:bg-neutral-50/60">
                    <Td>
                      <span className="font-medium text-neutral-800">{m.name}</span>
                      <span className="ml-1.5 text-[11px] text-neutral-400">{m.code}</span>
                      {m.status === 0 && <Tag className="ml-1.5">已停用</Tag>}
                    </Td>
                    <Td align="right">{m.productCount}</Td>
                    <Td align="right">{m.skuCount}</Td>
                    <Td align="right" className="font-medium text-neutral-800">{fmtWeight(m.stockWeight)}</Td>
                    <Td align="right" className="text-gold-700">{fmtWeight(m.availableWeight)}</Td>
                  </tr>
                ))}
              </Table>
            </Card>

            <Card className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-neutral-900">库存预警</h2>
                <Link href="/admin/stocks?onlyWarn=1" className="text-[12px] text-gold-600 hover:underline">
                  全部 {data.warnCount} 条 ›
                </Link>
              </div>
              {data.warnings.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-neutral-400">暂无预警，库存充足</p>
              ) : (
                <ul className="space-y-2">
                  {data.warnings.map((w) => (
                    <li key={w.skuId} className="rounded-lg bg-neutral-50 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-neutral-800">{w.productName}</p>
                          <p className="mt-0.5 truncate text-[11px] text-neutral-400">
                            {w.specName} · {w.skuCode}
                          </p>
                        </div>
                        <StockBadge level={w.level} />
                      </div>
                      <p className="mt-1.5 text-[11.5px] text-neutral-500">
                        可售 <span className="font-medium text-amber-700">{fmtWeight(w.availableWeight)} g</span>
                        <span className="mx-1 text-neutral-300">/</span>
                        预警 {fmtWeight(w.warnWeight)} g
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-neutral-900">最近库存变动</h2>
              <Link href="/admin/stock-logs" className="text-[12px] text-gold-600 hover:underline">
                查看全部流水 ›
              </Link>
            </div>
            <Table
              columns={[
                { key: 'time', label: '时间', width: '110px' },
                { key: 'product', label: '商品 / 规格' },
                { key: 'type', label: '类型', width: '90px' },
                { key: 'change', label: '变动 (g)', align: 'right', width: '110px' },
                { key: 'after', label: '变动后 (g)', align: 'right', width: '110px' },
                { key: 'operator', label: '操作人', width: '100px' },
              ]}
              empty={data.recentLogs.length === 0}
            >
              {data.recentLogs.map((l) => (
                <tr key={l.id} className="hover:bg-neutral-50/60">
                  <Td className="whitespace-nowrap text-neutral-400">{fmtAgo(l.createdAt)}</Td>
                  <Td>
                    <span className="text-neutral-800">{l.productName}</span>
                    <span className="ml-1.5 text-[11px] text-neutral-400">{l.specName}</span>
                  </Td>
                  <Td>
                    <Tag tone={l.changeWeight > 0 ? 'green' : 'red'}>
                      {STOCK_LOG_TYPE_LABEL[l.type] ?? l.type}
                    </Tag>
                  </Td>
                  <Td align="right" className={l.changeWeight > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {l.changeWeight > 0 ? '+' : ''}
                    {fmtWeight(l.changeWeight)}
                  </Td>
                  <Td align="right" className="text-neutral-700">{fmtWeight(l.afterWeight)}</Td>
                  <Td className="text-neutral-500">{l.operator}</Td>
                </tr>
              ))}
            </Table>
          </Card>

          <p className="mt-6 text-center text-[12px] text-neutral-400">
            二期将在工作台增加今日金价提醒、订单与销售统计
          </p>
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  href,
  tone = 'default',
  small = false,
}: {
  label: string
  value: string | number
  sub: string
  href: string
  tone?: 'default' | 'warn' | 'ok'
  small?: boolean
}) {
  return (
    <Link
      href={href}
      className={`block rounded-xl bg-white p-4 shadow-card ring-1 transition hover:shadow-md ${
        tone === 'warn' ? 'ring-amber-200' : 'ring-neutral-100'
      }`}
    >
      <p className="text-[12.5px] text-neutral-500">{label}</p>
      <p
        className={`mt-1 font-semibold tabular-nums ${small ? 'text-[19px]' : 'text-[26px]'} ${
          tone === 'warn' ? 'text-amber-600' : 'text-neutral-900'
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-neutral-400">{sub}</p>
    </Link>
  )
}
