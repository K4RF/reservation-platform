import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { MediaResponse } from '../../api/media'
import { CatalogImage } from './CatalogImage'
import { SearchLayer } from '../room/SearchLayer'

export function CatalogGallery({
  images,
  label,
  inline = false,
}: {
  images: MediaResponse[]
  label: string
  inline?: boolean
}) {
  // Never carry a previous owner's selection/draft into a new album or replaced URL.
  return (
    <Gallery
      key={images.map((image) => image.url).join(',')}
      images={images}
      label={label}
      inline={inline}
    />
  )
}
function Gallery({
  images,
  label,
  inline,
}: {
  images: MediaResponse[]
  label: string
  inline: boolean
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const close = useCallback(() => setOpen(false), [])
  if (!images.length) return <CatalogImage image={null} label={label} />
  if (inline) return <PhotoBrowser images={images} label={label} />
  return (
    <section className="catalog-gallery" aria-label={`${label} Gallery`}>
      <div
        className={`catalog-gallery-mosaic${images.length === 1 ? ' catalog-gallery-single' : ''}`}
      >
        {images.slice(0, 3).map((image, index) => (
          <CatalogImage key={image.mediaId} image={image} priority={index === 0} />
        ))}
      </div>
      <button
        ref={trigger}
        type="button"
        className="catalog-gallery-open"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {label} {images.length}장 보기
      </button>
      {open && (
        <SearchLayer id={id} title={`${label} 전체 보기`} anchor={trigger} onClose={close}>
          <PhotoBrowser images={images} label={label} />
        </SearchLayer>
      )}
    </section>
  )
}
function PhotoBrowser({ images, label }: { images: MediaResponse[]; label: string }) {
  const [index, setIndex] = useState(0)
  const previous = useRef<HTMLButtonElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const restoreNavigationFocus = useRef(false)
  useEffect(() => {
    if (!restoreNavigationFocus.current) return
    // A focused button becoming disabled must not drop keyboard focus onto the inert body.
    ;(index === 0 ? next : previous).current?.focus()
    restoreNavigationFocus.current = false
  }, [index])
  function move(value: number) {
    restoreNavigationFocus.current = value === 0 || value === images.length - 1
    setIndex(value)
  }
  const current = images[index]
  return (
    <div className="catalog-photo-browser" role="region" aria-label={`${label} 탐색`}>
      <CatalogImage image={current} priority className="catalog-photo-full" />
      <p role="status">
        {index + 1} / {images.length} · {current.altText}
      </p>
      <div className="action-group">
        <button ref={previous} type="button" disabled={index === 0} onClick={() => move(index - 1)}>
          이전 사진
        </button>
        <button
          type="button"
          disabled={index === images.length - 1}
          ref={next}
          onClick={() => move(index + 1)}
        >
          다음 사진
        </button>
      </div>
    </div>
  )
}
