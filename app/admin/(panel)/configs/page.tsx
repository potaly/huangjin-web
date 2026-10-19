'use client'

import { useEffect, useState } from 'react'
import { api, errMsg } from '@/lib/client'
import { useToast } from '@/components/Toast'
import { Button, ErrorBox, Loading, Tag } from '@/components/ui'
import { Card, Field, PageTitle, inputCls, selectCls } from '@/components/admin/AdminUI'
import { ImageUpload } from '@/components/admin/ImageUpload'
import type { Config } from '@/lib/types'

/** 参数分组与渲染方式，未列出的键以普通文本框展示 */
const GROUPS: Array<{
  title: string
  desc: string
  keys: string[]
  phase2?: boolean
}> = [
  {
    title: '站点信息',
    desc: '前台顶部展示',
    keys: ['site.name', 'site.slogan'],
  },
  {
    title: '客服与公司信息',
    desc: '前台「联系我们」与悬浮客服弹窗使用',
    keys: ['contact.phone', 'contact.wechat', 'contact.wechat.qrcode', 'contact.work.time', 'company.address'],
  },
  {
    title: '库存展示',
    desc: '控制前台展示精确克数还是「充足 / 少量 / 售罄」',
    keys: ['stock.display.mode'],
  },
  {
    title: '二期参数（交易相关）',
    desc: '一期不生效，先行保留，二期上线交易功能时启用',
    keys: [
      'order.pay.timeout.minutes',
      'order.auto.confirm.days',
      'order.weigh.tolerance.percent',
      'price.allow.order.without.today',
    ],
    phase2: true,
  },
]

const LABELS: Record<string, string> = {
  'site.name': '站点名称',
  'site.slogan': '站点标语',
  'contact.phone': '客服电话',
  'contact.wechat': '客服微信号',
  'contact.wechat.qrcode': '客服微信二维码',
  'contact.work.time': '工作时间',
  'company.address': '公司地址',
  'stock.display.mode': '库存展示方式',
  'order.pay.timeout.minutes': '待支付超时自动取消（分钟）',
  'order.auto.confirm.days': '发货后自动确认收货（天）',
  'order.weigh.tolerance.percent': '称重容差比例（%）',
  'price.allow.order.without.today': '当天未录入金价是否允许下单',
}

export default function ConfigPage() {
  const [configs, setConfigs] = useState<Config[] | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = () => {
    setError('')
    api
      .get<Config[]>('/api/admin/configs')
      .then((res) => {
        setConfigs(res)
        setValues(Object.fromEntries(res.map((c) => [c.configKey, c.configValue])))
      })
      .catch((e) => setError(errMsg(e)))
  }
  useEffect(load, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/admin/configs', {
        items: Object.entries(values).map(([configKey, configValue]) => ({ configKey, configValue })),
      })
      toast.success('参数已保存')
      load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  const set = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }))

  const known = new Set(GROUPS.flatMap((g) => g.keys))
  const others = (configs ?? []).filter((c) => !known.has(c.configKey))

  const renderField = (key: string) => {
    const remark = configs?.find((c) => c.configKey === key)?.remark
    const value = values[key] ?? ''

    if (key === 'contact.wechat.qrcode') {
      return (
        <Field key={key} label={LABELS[key] ?? key} hint={remark}>
          <ImageUpload value={value} onChange={(v) => set(key, v)} label="上传二维码" />
        </Field>
      )
    }
    if (key === 'stock.display.mode') {
      return (
        <Field key={key} label={LABELS[key] ?? key} hint={remark}>
          <select value={value} onChange={(e) => set(key, e.target.value)} className={selectCls}>
            <option value="EXACT">EXACT — 显示精确克数，如「库存 1,250.360 g」</option>
            <option value="LEVEL">LEVEL — 只显示「充足 / 少量 / 售罄」</option>
          </select>
        </Field>
      )
    }
    if (key === 'price.allow.order.without.today') {
      return (
        <Field key={key} label={LABELS[key] ?? key} hint={remark}>
          <select value={value} onChange={(e) => set(key, e.target.value)} className={selectCls}>
            <option value="false">否（默认）</option>
            <option value="true">是</option>
          </select>
        </Field>
      )
    }
    return (
      <Field key={key} label={LABELS[key] ?? key} hint={remark}>
        <input value={value} onChange={(e) => set(key, e.target.value)} className={inputCls} />
      </Field>
    )
  }

  return (
    <div>
      <PageTitle
        title="系统参数"
        desc="修改后立即对前台生效"
        actions={<Button loading={saving} onClick={save}>保存全部</Button>}
      />

      {error && <ErrorBox text={error} onRetry={load} />}
      {!configs && !error && <Loading />}

      {configs && (
        <div className="space-y-4">
          {GROUPS.map((group) => (
            <Card key={group.title}>
              <div className="mb-3">
                <h2 className="text-[15px] font-semibold text-neutral-900">
                  {group.title}
                  {group.phase2 && <Tag className="ml-2">二期</Tag>}
                </h2>
                <p className="mt-0.5 text-[12px] text-neutral-400">{group.desc}</p>
              </div>
              <div className={`grid gap-3 ${group.phase2 ? 'opacity-70' : ''} sm:grid-cols-2`}>
                {group.keys.map(renderField)}
              </div>
            </Card>
          ))}

          {others.length > 0 && (
            <Card>
              <h2 className="mb-3 text-[15px] font-semibold text-neutral-900">其他参数</h2>
              <div className="grid gap-3 sm:grid-cols-2">{others.map((c) => renderField(c.configKey))}</div>
            </Card>
          )}

          <div className="flex justify-end">
            <Button loading={saving} onClick={save}>保存全部</Button>
          </div>
        </div>
      )}
    </div>
  )
}
