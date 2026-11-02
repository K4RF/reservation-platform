import { useState } from 'react'
import { mediaContentUrl, type MediaResponse } from '../../api/media'

export function CatalogImage({
  image,
  priority = false,
  className = '',
  label = '사진',
}: {
  image: MediaResponse | null
  priority?: boolean
  className?: string
  label?: string
}) {
  return image ? (
    <Image key={image.url} image={image} priority={priority} className={className} />
  ) : (
    <div className={`catalog-image catalog-image-empty ${className}`}>
      <span>{label} 미제공</span>
    </div>
  )
}
function Image({
  image,
  priority,
  className,
}: {
  image: MediaResponse
  priority: boolean
  className: string
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  return (
    <div
      className={`catalog-image ${className}`}
      data-state={state}
      aria-busy={state === 'loading'}
    >
      {state === 'failed' ? (
        <span role="status">사진을 불러오지 못했습니다.</span>
      ) : (
        <img
          src={mediaContentUrl(image)}
          alt={image.altText}
          width={image.width}
          height={image.height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
        />
      )}
    </div>
  )
}
