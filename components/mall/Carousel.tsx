'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MallBanner } from '@/lib/api-types'

/** 首页轮播：横向 scroll-snap + 自动播放 + 指示点 */
export function Carousel({ banners }: { banners: MallBanner[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (banners.length <= 1 || paused) return
    const timer = setInterval(() => {
      const track = trackRef.current
      if (!track) return
      const next = (Math.round(track.scrollLeft / track.clientWidth) + 1) % banners.length
      track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' })
    }, 4000)
    return () => clearInterval(timer)
  }, [banners.length, paused])

  if (banners.length === 0) return null

  const go = (banner: MallBanner) => {
    if (banner.linkType === 'PRODUCT' && banner.linkValue) router.push(`/goods/${banner.linkValue}`)
    else if (banner.linkType === 'NOTICE' && banner.linkValue) router.push(`/notice/${banner.linkValue}`)
    else if (banner.linkType === 'URL' && banner.linkValue) window.open(banner.linkValue, '_blank', 'noopener')
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget
          setIndex(Math.round(el.scrollLeft / el.clientWidth))
        }}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="no-scrollbar snap-x-mandatory flex overflow-x-auto"
      >
        {banners.map((banner) => (
          <button
            key={banner.id}
            type="button"
            onClick={() => go(banner)}
            aria-label={banner.title || '轮播图'}
            className="snap-center w-full flex-shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner.image}
              alt={banner.title || '轮播图'}
              className="aspect-[2/1] w-full object-cover"
            />
          </button>
        ))}
      </div>

      {banners.length > 1 && (
        <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
          {banners.map((b, i) => (
            <span
              key={b.id}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/55'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
