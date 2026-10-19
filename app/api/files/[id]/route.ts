// GET /api/files/{id} — 读取后台上传的图片
import { readFile } from '@/lib/files'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const file = await readFile(params.id)
  if (!file) return new Response('Not Found', { status: 404 })

  return new Response(Buffer.from(file.data, 'base64'), {
    headers: {
      'Content-Type': file.mime,
      'Content-Length': String(file.size),
      // 内容按 id 寻址，不会变更，可长期缓存
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
