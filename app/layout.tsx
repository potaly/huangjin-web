import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/Toast'

export const metadata: Metadata = {
  title: '黄金首饰批发商城',
  description:
    '面向全国批发客户的黄金首饰商城：足金、18K 金、铂金现货按克批发，免登录浏览款式、规格与库存克重，有意向请联系客服。',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#c9a227',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
