'use client'

import { useEffect, useState } from 'react'
import { api, errMsg } from '@/lib/client'
import { useToast } from '@/components/Toast'
import { Button, ErrorBox, Tag } from '@/components/ui'
import {
  Field, Modal, PageTitle, StatusDot, Switch, Table, Td, inputCls, selectCls, useConfirm,
} from '@/components/admin/AdminUI'
import { useMe } from '@/components/admin/AdminShell'
import { fmtDateTime } from '@/lib/format'
import { ROLE_LABEL, type RoleCode } from '@/lib/types'

interface Row {
  id: number
  username: string
  realName: string
  phone: string
  roleCode: RoleCode
  roleName: string
  status: 0 | 1
  lastLoginAt: string | null
  locked: boolean
  createdAt: string
}

const ROLES: RoleCode[] = ['SUPER', 'OPERATOR', 'WAREHOUSE']

const ROLE_DESC: Record<RoleCode, string> = {
  SUPER: '全部功能，含管理员账号与系统参数',
  OPERATOR: '分类、商品、公告、轮播',
  WAREHOUSE: '库存入库、出库、盘点',
}

const EMPTY = { username: '', realName: '', phone: '', password: '', roleCode: 'OPERATOR' as RoleCode, status: 1 as 0 | 1 }

export default function AdminAccountPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [resetFor, setResetFor] = useState<Row | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const me = useMe()
  const toast = useToast()
  const { confirm, dialog } = useConfirm()

  const load = () => {
    setError('')
    api.get<Row[]>('/api/admin/admins').then(setRows).catch((e) => setError(errMsg(e)))
  }
  useEffect(load, [])

  const openNew = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }

  const openEdit = (row: Row) => {
    setEditing(row)
    setForm({
      username: row.username,
      realName: row.realName,
      phone: row.phone,
      password: '',
      roleCode: row.roleCode,
      status: row.status,
    })
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/api/admin/admins/${editing.id}`, {
          realName: form.realName,
          phone: form.phone,
          roleCode: form.roleCode,
          status: form.status,
        })
      } else {
        await api.post('/api/admin/admins', form)
      }
      toast.success('保存成功')
      setOpen(false)
      load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (row: Row, status: boolean) => {
    try {
      await api.put(`/api/admin/admins/${row.id}`, { status: status ? 1 : 0 })
      toast.success(status ? '已启用' : '已禁用')
      load()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const doReset = async () => {
    if (!resetFor) return
    try {
      await api.post(`/api/admin/admins/${resetFor.id}/reset-password`, { password: newPassword })
      toast.success(`已重置「${resetFor.realName}」的密码`)
      setResetFor(null)
      setNewPassword('')
      load()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const remove = async (row: Row) => {
    if (!(await confirm(`确定删除管理员「${row.realName}」吗？`, { danger: true }))) return
    try {
      await api.del(`/api/admin/admins/${row.id}`)
      toast.success('删除成功')
      load()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  return (
    <div>
      <PageTitle
        title="管理员账号"
        desc="连续 5 次登录失败将锁定 15 分钟；启用账号会同时解除锁定"
        actions={<Button onClick={openNew}>新增管理员</Button>}
      />

      {error && <ErrorBox text={error} onRetry={load} />}

      <Table
        columns={[
          { key: 'user', label: '账号' },
          { key: 'role', label: '角色', width: '220px' },
          { key: 'phone', label: '手机号', width: '130px' },
          { key: 'login', label: '最近登录', width: '150px' },
          { key: 'status', label: '状态', width: '130px' },
          { key: 'ops', label: '操作', align: 'right', width: '180px' },
        ]}
        loading={rows === null}
        empty={rows?.length === 0}
      >
        {rows?.map((row) => (
          <tr key={row.id} className="hover:bg-neutral-50/60">
            <Td>
              <p className="font-medium text-neutral-800">
                {row.realName}
                {row.id === me.id && <Tag tone="gold" className="ml-1.5">当前账号</Tag>}
              </p>
              <p className="mt-0.5 text-[11.5px] text-neutral-400">{row.username}</p>
            </Td>
            <Td>
              <Tag tone={row.roleCode === 'SUPER' ? 'red' : row.roleCode === 'OPERATOR' ? 'blue' : 'green'}>
                {ROLE_LABEL[row.roleCode]}
              </Tag>
              <p className="mt-0.5 text-[11px] text-neutral-400">{ROLE_DESC[row.roleCode]}</p>
            </Td>
            <Td className="text-[12.5px] text-neutral-500">{row.phone || '—'}</Td>
            <Td className="text-[12px] text-neutral-400">{fmtDateTime(row.lastLoginAt)}</Td>
            <Td>
              <span className="flex items-center gap-2">
                <Switch checked={row.status === 1} onChange={(v) => toggle(row, v)} disabled={row.id === me.id} />
                <StatusDot on={row.status === 1} />
              </span>
              {row.locked && <p className="mt-0.5 text-[11px] text-rose-500">登录已锁定</p>}
            </Td>
            <Td align="right">
              <span className="flex justify-end gap-2 text-[12.5px]">
                <button type="button" onClick={() => openEdit(row)} className="text-gold-600 hover:underline">编辑</button>
                <button type="button" onClick={() => { setResetFor(row); setNewPassword('') }} className="text-neutral-500 hover:underline">重置密码</button>
                {row.id !== me.id && (
                  <button type="button" onClick={() => remove(row)} className="text-rose-600 hover:underline">删除</button>
                )}
              </span>
            </Td>
          </tr>
        ))}
      </Table>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `编辑管理员 · ${editing.realName}` : '新增管理员'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button loading={saving} onClick={save}>保存</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="用户名" required hint={editing ? '创建后不可修改' : '3–50 位字母、数字、下划线'}>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className={inputCls}
              disabled={Boolean(editing)}
            />
          </Field>
          <Field label="姓名" required>
            <input value={form.realName} onChange={(e) => setForm({ ...form, realName: e.target.value })} className={inputCls} />
          </Field>
          {!editing && (
            <Field label="初始密码" required hint="至少 8 位">
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} />
            </Field>
          )}
          <Field label="手机号">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
          </Field>
          <Field label="角色" required hint={ROLE_DESC[form.roleCode]}>
            <select value={form.roleCode} onChange={(e) => setForm({ ...form, roleCode: e.target.value as RoleCode })} className={selectCls}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </Field>
          <Field label="状态">
            <span className="flex items-center gap-2 pt-1">
              <Switch checked={form.status === 1} onChange={(v) => setForm({ ...form, status: v ? 1 : 0 })} />
              <StatusDot on={form.status === 1} />
            </span>
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(resetFor)}
        onClose={() => setResetFor(null)}
        title={`重置密码 · ${resetFor?.realName ?? ''}`}
        width="max-w-sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetFor(null)}>取消</Button>
            <Button onClick={doReset}>确认重置</Button>
          </>
        }
      >
        <Field label="新密码" required hint="至少 8 位，请线下告知该管理员">
          <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} autoFocus />
        </Field>
      </Modal>

      {dialog}
    </div>
  )
}
