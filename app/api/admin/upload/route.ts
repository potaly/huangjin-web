// POST /api/admin/upload — 图片上传，服务端转存腾讯云 COS，返回完整 https 地址
import { bad, handle, ok, requireAdmin } from '@/lib/api'
import { MAX_FILE_BYTES, saveFile } from '@/lib/files'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handle(async () => {
    requireAdmin()

    let form: FormData
    try {
      form = await req.formData()
    } catch {
      throw bad('请使用 multipart/form-data 上传')
    }

    const entry = form.get('file')
    if (!(entry instanceof File)) throw bad('请选择要上传的图片')
    if (entry.size === 0) throw bad('图片内容为空')
    if (entry.size > MAX_FILE_BYTES) {
      throw bad(`图片不能超过 ${Math.round(MAX_FILE_BYTES / 1024)} KB，请压缩后重试`)
    }

    const buffer = Buffer.from(await entry.arrayBuffer())
    try {
      const file = await saveFile({ mime: entry.type, buffer, name: entry.name })
      return ok({ url: file.url, size: file.size, mime: file.mime }, '上传成功')
    } catch (e) {
      throw bad(e instanceof Error ? e.message : '上传失败')
    }
  })
}
