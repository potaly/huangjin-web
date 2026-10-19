'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { useMall } from './MallProvider'
import { isWeixin } from '@/lib/clipboard'

const TABS = [
  {
    href: '/',
    label: '首页',
    icon: (active: boolean) => (
      <path
        d="M3 9.5L10 4l7 5.5V16a1 1 0 01-1 1h-4v-4H8v4H4a1 1 0 01-1-1V9.5z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: '/category',
    label: '分类',
    icon: (active: boolean) => (
      <>
        <rect x="3" y="3" width="6" height="6" rx="1.5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" />
        <rect x="11" y="3" width="6" height="6" rx="1.5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" />
        <rect x="3" y="11" width="6" height="6" rx="1.5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" />
        <rect x="11" y="11" width="6" height="6" rx="1.5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" />
      </>
    ),
  },
  {
    href: '/contact',
    label: '联系我们',
    icon: (active: boolean) => (
      <>
        <circle cx="10" cy="7" r="3" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 17c0-3 2.7-5 6-5s6 2 6 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
]

export function MallShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { openContact } = useMall()

  const isTabPage = TABS.some((t) => t.href === pathname)
  // 商品详情页有自己的底部按钮栏，同样需要预留高度
  const hasBottomBar = isTabPage || /^\/goods\/[^/]+$/.test(pathname)

  return (
    <div className={`mall-shell ${hasBottomBar ? 'pb-[60px]' : ''}`}>
      {children}

      {/* 悬浮联系客服按钮（§4.2：所有页面右下角）*/}
      <div className="mall-fixed-bar pointer-events-none" style={{ bottom: hasBottomBar ? 72 : 20 }}>
        <div className="flex justify-end px-4">
          <button
            type="button"
            onClick={() => openContact()}
            aria-label="联系客服"
            className="pointer-events-auto flex h-12 w-12 flex-col items-center justify-center rounded-full bg-gold-500 text-white shadow-lg shadow-gold-500/30 active:bg-gold-600"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M10 2a7 7 0 00-7 7v3.2A2.8 2.8 0 005.8 15h.4a1 1 0 001-1V10a1 1 0 00-1-1h-1.1A5.1 5.1 0 0110 3.9 5.1 5.1 0 0114.9 9H13.8a1 1 0 00-1 1v4a1 1 0 001 1h.2a2 2 0 01-1.9 1.4H11a.9.9 0 100 1.8h1.1A3.8 3.8 0 0015.8 15 2.8 2.8 0 0017 12.6V9a7 7 0 00-7-7z" />
            </svg>
            <span className="text-[9px] leading-none">客服</span>
          </button>
        </div>
      </div>

      {/* 底部 tabBar：与小程序一致，仅在 tab 页展示 */}
      {isTabPage && (
      <nav className="mall-fixed-bar safe-bottom border-t border-neutral-100 bg-white/95 backdrop-blur">
        <ul className="flex">
          {TABS.map((tab) => {
            const active =
              tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                    active ? 'text-gold-600' : 'text-neutral-400'
                  }`}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                    {tab.icon(active)}
                  </svg>
                  {tab.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      )}
    </div>
  )
}

/** 二级页面顶部导航条 */
export function PageHeader({
  title,
  right,
  sticky = true,
}: {
  title: string
  right?: ReactNode
  sticky?: boolean
}) {
  const router = useRouter()
  const [inWeixin, setInWeixin] = useState(false)

  // §2.3：微信内置浏览器使用微信自带标题栏，隐藏自定义返回按钮
  useEffect(() => setInWeixin(isWeixin()), [])

  return (
    <header
      className={`${sticky ? 'sticky top-0 z-30' : ''} flex h-12 items-center gap-2 border-b border-neutral-100 bg-white/95 px-2 backdrop-blur`}
    >
      {!inWeixin && (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="返回"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 active:bg-neutral-100"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
            <path d="M12.5 4L6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <h1 className={`flex-1 truncate text-[16px] font-semibold text-neutral-900 ${inWeixin ? 'pl-2' : ''}`}>
        {title}
      </h1>
      {right}
    </header>
  )
}
