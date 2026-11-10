// 浏览器端上传前压缩（仅在客户端组件里调用）
//
// 建议值：长边 1280px、JPEG 质量 0.8，商品实拍图一般 150–350KB。
// 依据：手机双列卡片约 170 CSS px 宽，3 倍屏需 ~520px；详情页满屏大图
// 约 375–430 CSS px 宽，3 倍屏需 ~1200–1290px。1280 兼顾两者，再大肉眼
// 看不出差别，只会拖慢加载。

export const UPLOAD_MAX_SIDE = 1280
export const UPLOAD_QUALITY = 0.8

async function compressBlob(file: File, maxSide: number, quality: number): Promise<Blob> {
  // SVG 是矢量、GIF 可能是动图，原样上传
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  // 转 JPEG 会丢透明通道，先铺白底，免得透明 PNG 变成黑底
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  // 原图已经更小（比如本来就压过的小图）就用原图
  return blob && blob.size < file.size ? blob : file
}

/** 压缩后包装成 File，可直接 append 到 FormData */
export async function compressForUpload(
  file: File,
  maxSide = UPLOAD_MAX_SIDE,
  quality = UPLOAD_QUALITY,
): Promise<File> {
  const blob = await compressBlob(file, maxSide, quality)
  if (blob === file) return file
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}
