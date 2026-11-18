// POST /api/mall/manage/upload — 小程序上传商品图（multipart，字段 file），服务端转存腾讯云 COS
import { bad, handle, ok } from '@/lib/api'
import { MAX_FILE_BYTES, saveFile, sniffImageMime } from '@/lib/files'
import { MANAGE_ROLES, requireMallUser } from '@/lib/mall-auth'
import { loadDB } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handle(async () => {
    requireMallUser(await loadDB(), MANAGE_ROLES)

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
      throw bad(`图片不能超过 ${Math.round(MAX_FILE_BYTES / 1024)} KB`)
    }

    const buffer = Buffer.from(await entry.arrayBuffer())
    const mime = sniffImageMime(buffer)
    if (!mime) throw bad('只支持 JPG / PNG / WEBP 图片')

    try {
      const file = await saveFile({ mime, buffer, name: entry.name })
      return ok({ url: file.url, size: file.size, mime: file.mime }, '上传成功')
    } catch (e) {
      throw bad(e instanceof Error ? e.message : '上传失败')
    }
  })
}
