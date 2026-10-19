'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, errMsg } from '@/lib/client'
import { useToast } from '@/components/Toast'
import { Button, Loading } from '@/components/ui'
import { Modal, Field, inputCls } from './AdminUI'
import type { RoleCode } from '@/lib/types'

export interface Me {
  id: number
  username: string
  realName: string
  roleCode: RoleCode
  roleName: string
  phone: string
  lastLoginAt: string | null
  modules: Record<string, boolean>
  storageDriver: 'redis' | 'memory'
}

const MeContext = createContext<Me | null>(null)
export function useMe(): Me {
  const me = useContext(MeContext)
  if (!me) throw new Error('useMe 必须在 AdminShell 内使用')
  return me
}

interface NavItem {
  href: string
  label: string
  module: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  { title: '概览', items: [{ href: '/admin', label: '工作台', module: 'dashboard' }] },
  {
    title: '商品',
    items: [
      { href: '/admin/categories', label: '商品分类', module: 'category' },
      { href: '/admin/materials', label: '材质字典', module: 'material' },
      { href: '/admin/products', label: '商品管理', module: 'product' },
    ],
  },
  {
    title: '库存',
    items: [
      { href: '/admin/stocks', label: '库存管理', module: 'stock' },
      { href: '/admin/stock-logs', label: '库存流水', module: 'stock' },
    ],
  },
  {
    title: '内容',
    items: [
      { href: '/admin/notices', label: '公告管理', module: 'content' },
      { href: '/admin/banners', label: '轮播图管理', module: 'content' },
    ],
  },
  {
    title: '系统',
    items: [
      { href: '/admin/admins', label: '管理员账号', module: 'system' },
      { href: '/admin/configs', label: '系统参数', module: 'system' },
      { href: '/admin/logs', label: '操作日志', module: 'system' },
    ],
  },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [checked, setChecked] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    api
      .get<Me>('/api/admin/auth/me')
      .then(setMe)
      .catch(() => router.replace(`/admin/login?from=${encodeURIComponent(pathname)}`))
      .finally(() => setChecked(true))
    // 只在首次挂载时校验登录态
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => setMenuOpen(false), [pathname])

  if (!checked || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loading text="正在校验登录状态…" />
      </div>
    )
  }

  const logout = async () => {
    await api.post('/api/admin/auth/logout').catch(() => {})
    router.replace('/admin/login')
  }

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => me.modules[i.module]),
  })).filter((g) => g.items.length > 0)

  return (
    <MeContext.Provider value={me}>
      <div className="min-h-screen bg-neutral-50 lg:flex">
        {/* 侧边栏 */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-60 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white transition-transform lg:static lg:translate-x-0 ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-14 items-center gap-2 border-b border-neutral-100 px-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold-500 text-[13px] font-bold text-white">
              金
            </span>
            <span className="text-[14.5px] font-semibold text-neutral-900">批发商城后台</span>
          </div>

          <nav className="p-3">
            {groups.map((group) => (
              <div key={group.title} className="mb-4">
                <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                  {group.title}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active =
                      item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`block rounded-lg px-3 py-2 text-[13.5px] transition ${
                            active
                              ? 'bg-gold-50 font-medium text-gold-700'
                              : 'text-neutral-600 hover:bg-neutral-50'
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="border-t border-neutral-100 p-3 text-[11px] text-neutral-400">
            <p>
              存储：
              {me.storageDriver === 'redis' ? (
                <span className="text-emerald-600">Redis 持久化</span>
              ) : (
                <span className="text-amber-600">内存（重启丢失）</span>
              )}
            </p>
            <Link href="/" target="_blank" className="mt-1 inline-block text-gold-600 hover:underline">
              打开前台商城 ↗
            </Link>
          </div>
        </aside>

        {menuOpen && (
          <button
            type="button"
            aria-label="关闭菜单"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          />
        )}

        {/* 主区域 */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white/95 px-4 backdrop-blur">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="打开菜单"
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 lg:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-[13px] text-neutral-500 sm:inline">
                {me.realName}
                <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">
                  {me.roleName}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setPwdOpen(true)}
                className="text-[13px] text-neutral-500 hover:text-neutral-900"
              >
                修改密码
              </button>
              <button
                type="button"
                onClick={logout}
                className="text-[13px] text-neutral-500 hover:text-rose-600"
              >
                退出
              </button>
            </div>
          </header>

          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>

      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </MeContext.Provider>
  )
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [oldPassword, setOld] = useState('')
  const [newPassword, setNew] = useState('')
  const [confirmPassword, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const router = useRouter()

  const submit = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致')
      return
    }
    setSaving(true)
    try {
      await api.post('/api/admin/admins/change-password', { oldPassword, newPassword })
      toast.success('密码已修改，请重新登录')
      router.replace('/admin/login')
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="修改密码"
      width="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button loading={saving} onClick={submit}>
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="原密码" required>
          <input type="password" value={oldPassword} onChange={(e) => setOld(e.target.value)} className={inputCls} />
        </Field>
        <Field label="新密码" required hint="至少 8 位">
          <input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} className={inputCls} />
        </Field>
        <Field label="确认新密码" required>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
    </Modal>
  )
}
