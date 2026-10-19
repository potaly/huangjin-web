'use client'

import { useMall } from '@/components/mall/MallProvider'
import { useToast } from '@/components/Toast'
import { copyText } from '@/lib/clipboard'

export default function ContactPage() {
  const { settings } = useMall()
  const toast = useToast()

  const copy = async (text: string, label: string) => {
    const ok = await copyText(text)
    toast[ok ? 'success' : 'error'](ok ? `${label}已复制` : '复制失败，请手动长按复制')
  }

  return (
    <div className="pb-6">
      <header className="bg-gradient-to-b from-gold-500 to-gold-400 px-4 pb-6 pt-5">
        <h1 className="text-[18px] font-semibold text-white">联系我们</h1>
        <p className="mt-1 text-[12.5px] text-white/85">
          {settings.siteSlogan || '源头工厂 · 按克批发 · 当日发货'}
        </p>
      </header>

      <div className="-mt-4 space-y-2.5 px-3">
        {settings.contactPhone && (
          <a
            href={`tel:${settings.contactPhone}`}
            className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-card active:opacity-90"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M4.5 2.5A2 2 0 002.6 5c1 4.6 4.8 8.4 9.4 9.4a2 2 0 002.5-1.9v-1.6a1 1 0 00-.8-1l-2.3-.5a1 1 0 00-1 .3l-.7.8a11 11 0 01-3.5-3.5l.8-.7a1 1 0 00.3-1l-.5-2.3a1 1 0 00-1-.8H4.5z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-neutral-400">客服电话</p>
              <p className="text-[16px] font-semibold text-neutral-900">{settings.contactPhone}</p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-600 px-3.5 py-1.5 text-[12px] text-white">
              一键拨打
            </span>
          </a>
        )}

        {settings.contactWechat && (
          <button
            type="button"
            onClick={() => copy(settings.contactWechat, '微信号')}
            className="flex w-full items-center gap-3 rounded-xl bg-white p-4 text-left shadow-card active:opacity-90"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M7.6 2.5C4.2 2.5 1.5 4.8 1.5 7.6c0 1.6.9 3 2.3 4L3.2 13.4l2.1-1.1c.7.2 1.5.3 2.3.3h.5a4.6 4.6 0 01-.2-1.3c0-2.7 2.6-4.9 5.8-4.9h.5c-.5-2.2-2.9-3.9-6.6-3.9zm-2 2.3a.8.8 0 110 1.6.8.8 0 010-1.6zm4.3 0a.8.8 0 110 1.6.8.8 0 010-1.6z" />
                <path d="M18.5 11.3c0-2.2-2.2-4-4.9-4s-4.9 1.8-4.9 4 2.2 4 4.9 4c.6 0 1.1-.1 1.6-.2l1.7.9-.4-1.5c1.2-.7 2-1.9 2-3.2zm-6.5-1.2a.7.7 0 110 1.3.7.7 0 010-1.3zm3.3 0a.7.7 0 110 1.3.7.7 0 010-1.3z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-neutral-400">客服微信</p>
              <p className="text-[16px] font-semibold text-neutral-900">{settings.contactWechat}</p>
            </div>
            <span className="shrink-0 rounded-full bg-green-600 px-3.5 py-1.5 text-[12px] text-white">
              复制微信号
            </span>
          </button>
        )}

        {settings.contactWechatQrcode && (
          <div className="rounded-xl bg-white p-4 text-center shadow-card">
            <p className="mb-3 text-[13px] text-neutral-500">长按识别二维码，添加客服微信看货</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={settings.contactWechatQrcode}
              alt="客服微信二维码"
              className="mx-auto h-52 w-auto rounded-xl bg-white p-2 ring-1 ring-neutral-200"
            />
          </div>
        )}

        <div className="rounded-xl bg-white p-4 shadow-card">
          <h2 className="mb-2.5 text-[15px] font-semibold text-neutral-900">服务信息</h2>
          <dl className="space-y-2.5 text-[13px]">
            {settings.contactWorkTime && (
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-neutral-400">工作时间</dt>
                <dd className="flex-1 text-neutral-800">{settings.contactWorkTime}</dd>
              </div>
            )}
            {settings.companyAddress && (
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-neutral-400">公司地址</dt>
                <dd className="flex-1 leading-relaxed text-neutral-800">
                  {settings.companyAddress}
                  <button
                    type="button"
                    onClick={() => copy(settings.companyAddress, '地址')}
                    className="ml-1.5 text-[12px] text-gold-600 underline"
                  >
                    复制
                  </button>
                </dd>
              </div>
            )}
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-neutral-400">批发说明</dt>
              <dd className="flex-1 leading-relaxed text-neutral-800">
                所有商品按克批发，库存以克计。前台不展示价格，当日报价请联系客服。
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-neutral-400">发货方式</dt>
              <dd className="flex-1 leading-relaxed text-neutral-800">
                顺丰保价到付 / 物流专线 / 水贝档口自提，发货前统一复称。
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-card">
          <h2 className="mb-2 text-[15px] font-semibold text-neutral-900">采购流程</h2>
          <ol className="space-y-2.5">
            {[
              ['浏览款式', '在首页或分类中查看款式、规格与库存克重'],
              ['联系客服', '复制款号发给客服，获取当日金价与工费报价'],
              ['确认订单', '确认克重与规格，客服开单并安排配货'],
              ['复称发货', '发货前统一复称，按实际克重结算，多退少补'],
            ].map(([title, desc], i) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-500 text-[11px] font-medium text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-neutral-800">{title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-500">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
