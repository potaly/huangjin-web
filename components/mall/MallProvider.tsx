'use client'

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import { api } from '@/lib/client'
import { copyText } from '@/lib/clipboard'
import { useToast } from '@/components/Toast'
import { Sheet } from '@/components/ui'

export interface PublicSettings {
  siteName: string
  siteSlogan: string
  contactPhone: string
  contactWechat: string
  contactWechatQrcode: string
  contactWorkTime: string
  companyAddress: string
  stockDisplayMode: 'EXACT' | 'LEVEL'
}

const FALLBACK: PublicSettings = {
  siteName: '黄金首饰批发商城',
  siteSlogan: '',
  contactPhone: '',
  contactWechat: '',
  contactWechatQrcode: '',
  contactWorkTime: '',
  companyAddress: '',
  stockDisplayMode: 'EXACT',
}

interface MallContextValue {
  settings: PublicSettings
  /** 打开客服弹窗；copy 为需要自动复制到剪贴板的文本（§4.3 咨询客服） */
  openContact: (copy?: string) => void
}

const MallContext = createContext<MallContextValue | null>(null)

export function MallProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>(FALLBACK)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    api
      .get<PublicSettings>('/api/mall/settings/public')
      .then(setSettings)
      .catch(() => setSettings(FALLBACK))
  }, [])

  const openContact = useCallback(
    (copy?: string) => {
      setOpen(true)
      if (copy) {
        void copyText(copy).then((ok) => {
          if (ok) setCopied(copy)
        })
      } else {
        setCopied(null)
      }
    },
    [],
  )

  const value = useMemo<MallContextValue>(() => ({ settings, openContact }), [settings, openContact])

  const copyWechat = async () => {
    if (!settings.contactWechat) return
    const ok = await copyText(settings.contactWechat)
    toast[ok ? 'success' : 'error'](ok ? '微信号已复制' : '复制失败，请手动长按复制')
  }

  return (
    <MallContext.Provider value={value}>
      {children}

      <Sheet open={open} onClose={() => setOpen(false)} title="联系客服">
        {copied && (
          <div className="mb-3 rounded-lg bg-gold-50 px-3 py-2.5 text-[13px] leading-relaxed text-gold-800 ring-1 ring-gold-100">
            已复制商品信息，可直接粘贴发给客服：
            <span className="mt-1 block font-medium text-gold-900">{copied}</span>
          </div>
        )}

        <div className="space-y-2.5">
          {settings.contactPhone && (
            <a
              href={`tel:${settings.contactPhone}`}
              className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3.5 active:bg-neutral-100"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M4.5 2.5A2 2 0 002.6 5c1 4.6 4.8 8.4 9.4 9.4a2 2 0 002.5-1.9v-1.6a1 1 0 00-.8-1l-2.3-.5a1 1 0 00-1 .3l-.7.8a11 11 0 01-3.5-3.5l.8-.7a1 1 0 00.3-1l-.5-2.3a1 1 0 00-1-.8H4.5z" />
                  </svg>
                </span>
                <span>
                  <span className="block text-[13px] text-neutral-500">客服电话</span>
                  <span className="block text-[15px] font-medium text-neutral-900">{settings.contactPhone}</span>
                </span>
              </span>
              <span className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs text-white">一键拨打</span>
            </a>
          )}

          {settings.contactWechat && (
            <button
              type="button"
              onClick={copyWechat}
              className="flex w-full items-center justify-between rounded-xl bg-neutral-50 px-4 py-3.5 text-left active:bg-neutral-100"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50 text-green-600">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M7.6 2.5C4.2 2.5 1.5 4.8 1.5 7.6c0 1.6.9 3 2.3 4L3.2 13.4l2.1-1.1c.7.2 1.5.3 2.3.3h.5a4.6 4.6 0 01-.2-1.3c0-2.7 2.6-4.9 5.8-4.9h.5c-.5-2.2-2.9-3.9-6.6-3.9zm-2 2.3a.8.8 0 110 1.6.8.8 0 010-1.6zm4.3 0a.8.8 0 110 1.6.8.8 0 010-1.6z" />
                    <path d="M18.5 11.3c0-2.2-2.2-4-4.9-4s-4.9 1.8-4.9 4 2.2 4 4.9 4c.6 0 1.1-.1 1.6-.2l1.7.9-.4-1.5c1.2-.7 2-1.9 2-3.2zm-6.5-1.2a.7.7 0 110 1.3.7.7 0 010-1.3zm3.3 0a.7.7 0 110 1.3.7.7 0 010-1.3z" />
                  </svg>
                </span>
                <span>
                  <span className="block text-[13px] text-neutral-500">客服微信</span>
                  <span className="block text-[15px] font-medium text-neutral-900">{settings.contactWechat}</span>
                </span>
              </span>
              <span className="rounded-full bg-green-600 px-3 py-1.5 text-xs text-white">复制微信号</span>
            </button>
          )}

          {settings.contactWechatQrcode && (
            <div className="rounded-xl bg-neutral-50 px-4 py-4 text-center">
              <p className="mb-2 text-[13px] text-neutral-500">长按识别二维码添加客服</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.contactWechatQrcode}
                alt="客服微信二维码"
                className="mx-auto h-44 w-auto rounded-lg bg-white p-1.5 ring-1 ring-neutral-200"
              />
            </div>
          )}

          <div className="rounded-xl bg-neutral-50 px-4 py-3.5 text-[13px] leading-relaxed text-neutral-600">
            {settings.contactWorkTime && (
              <p>
                <span className="text-neutral-400">工作时间：</span>
                {settings.contactWorkTime}
              </p>
            )}
            {settings.companyAddress && (
              <p>
                <span className="text-neutral-400">公司地址：</span>
                {settings.companyAddress}
              </p>
            )}
            <p className="mt-1 text-neutral-400">本站商品按克批发，价格请联系客服获取</p>
          </div>
        </div>
      </Sheet>
    </MallContext.Provider>
  )
}

export function useMall(): MallContextValue {
  const ctx = useContext(MallContext)
  if (!ctx) throw new Error('useMall 必须在 MallProvider 内使用')
  return ctx
}
